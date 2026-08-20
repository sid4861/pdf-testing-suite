"""Native Python implementation of `generate`.

This half needs no Node at all: it is HTTP, base64 and file writes, with no
comparison logic. Reimplementing it in Python carries zero fidelity risk, and it
means a Python-only workflow can fetch candidates without a JS runtime.

Behaviour deliberately mirrors the Node implementation — same defaults, same
retry policy, same heartbeat, same manifest — because the two must be
interchangeable in a pipeline.

Tuned for a SLOW render API (20-40s per document is typical):
  * The timeout sits well above the worst response time. A timeout that fires on
    a healthy-but-slow response is more damaging than waiting.
  * Timeouts are NOT retried by default. If a request exceeded an already
    generous timeout, the retry almost always exceeds it too, tripling the wall
    clock for nothing.
  * A heartbeat is mandatory: with 40s calls a run is otherwise silent for
    minutes, which reads as a hang and trips CI inactivity watchdogs.
"""

from __future__ import annotations

import hashlib
import json
import re
import threading
import time
import urllib.error
import urllib.request
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone
from pathlib import Path
from typing import List, Optional

from .errors import Exit, ToolError
from .models import GeneratedDoc, GenerateResult

MANIFEST_FILENAME = "manifest.json"
PDF_MAGIC = b"%PDF-"

# Query-string credentials would otherwise be echoed into the run log and the
# manifest — both routinely archived as CI artifacts. Header values are never
# printed at all.
SECRET_PARAMS = re.compile(
    r"^(token|key|api[-_]?key|access[-_]?token|password|secret|sig|signature|auth)$",
    re.IGNORECASE,
)


def redact_url(raw: str) -> str:
    from urllib.parse import urlencode, urlparse, urlunparse, parse_qsl

    try:
        parsed = urlparse(raw)
        if not parsed.query:
            return raw
        params = [
            (k, "***" if SECRET_PARAMS.match(k) else v)
            for k, v in parse_qsl(parsed.query, keep_blank_values=True)
        ]
        # safe='*' keeps the redaction marker readable as *** rather than %2A%2A%2A,
        # matching what the Node CLI prints.
        return urlunparse(parsed._replace(query=urlencode(params, safe='*')))
    except Exception:
        return raw


def human_ms(ms: float) -> str:
    if ms != ms or ms < 0:  # NaN guard
        return "-"
    if ms < 1000:
        return "%dms" % round(ms)
    seconds = ms / 1000.0
    if seconds < 90:
        return "%.1fs" % seconds
    return "%dm%02ds" % (int(seconds // 60), round(seconds % 60))


def _say(quiet: bool, message: str) -> None:
    """Per-document progress line. Suppressed under quiet=True, which library
    callers use when they want the returned result rather than a running log."""
    if not quiet:
        print(message, flush=True)


def sha256(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def _dig(obj, dot_path: str):
    """Walk a dot-path (`data.document.content`) into a parsed JSON response."""
    current = obj
    for key in dot_path.split("."):
        if not isinstance(current, dict):
            return None
        current = current.get(key)
        if current is None:
            return None
    return current


class _Progress:
    """Live view of what is in flight, shared with the heartbeat thread."""

    def __init__(self, total: int) -> None:
        self.lock = threading.Lock()
        self.in_flight = {}  # stem -> start time
        self.done = 0
        self.total = total
        self.durations: List[float] = []


def _extract_pdf(body: bytes, mode: str, response_path: str):
    """Pull the PDF out of a successful response. Returns bytes, or an
    explanatory string on failure.

    The magic-number check matters: a misconfigured endpoint frequently returns
    200 with an HTML error page or a JSON envelope, and writing that to a .pdf
    turns a clear configuration problem into a confusing "corrupt PDF" failure
    two commands later.
    """
    if mode == "binary":
        pdf = body
    elif mode == "base64":
        text = body.decode("utf-8", "replace").strip()
        if not text:
            return "Response body is empty"
        pdf = _b64(text)
    else:  # json
        try:
            parsed = json.loads(body.decode("utf-8", "replace"))
        except json.JSONDecodeError:
            if body.startswith(PDF_MAGIC):
                return 'Response is not JSON — it looks like a raw PDF; set api.responseMode to "binary"'
            return "Response is not JSON: %s" % body[:120].decode("utf-8", "replace")
        value = _dig(parsed, response_path)
        if not isinstance(value, str) or not value:
            keys = ", ".join(parsed.keys()) if isinstance(parsed, dict) else "(not an object)"
            return 'Response has no string at "%s". Keys: %s' % (response_path, keys or "(none)")
        pdf = _b64(value)

    if not pdf.startswith(PDF_MAGIC):
        preview = re.sub(rb"\s+", b" ", pdf[:60]).decode("utf-8", "replace")
        suffix = " — starts with: %s" % preview if pdf else ""
        return "Decoded response is not a PDF (no %%PDF- header, %d bytes)%s" % (len(pdf), suffix)
    return pdf


def _b64(text: str) -> bytes:
    import base64

    return base64.b64decode(text, validate=False)


def _is_retryable(kind: str, retry_on_timeout: bool) -> bool:
    """Retry only what a retry can plausibly fix.

    5xx and network faults are transient. A 4xx is a bad request — resending the
    identical body fails identically. A timeout against an already-generous
    limit means the server is genuinely too slow.
    """
    if kind == "timeout":
        return retry_on_timeout
    return kind in ("network", "http-5xx")


def _render_one(
    payload_file: Path,
    out_dir: Path,
    url: str,
    method: str,
    headers: dict,
    response_mode: str,
    response_path: str,
    timeout: float,
    retries: int,
    retry_on_timeout: bool,
    retry_backoff: float,
    skip_existing: bool,
    progress: _Progress,
    quiet: bool = False,
) -> GeneratedDoc:
    stem = payload_file.stem
    out_file = out_dir / ("%s.pdf" % stem)
    raw = payload_file.read_bytes()
    started = time.monotonic()

    doc = GeneratedDoc(payload=payload_file.name, payload_sha256=sha256(raw))

    def finish(result: GeneratedDoc) -> GeneratedDoc:
        with progress.lock:
            progress.in_flight.pop(stem, None)
            progress.done += 1
            # Only real API calls inform the ETA and the timing stats — a skipped
            # file is a sub-millisecond disk read and would drag both to zero.
            if result.ok and not result.skipped:
                progress.durations.append(result.duration_ms)
        return result

    if skip_existing and out_file.is_file():
        existing = out_file.read_bytes()
        _say(quiet, "  [skip]  %s - exists, skipped" % stem)
        doc.pdf = out_file.name
        doc.pdf_sha256 = sha256(existing)
        doc.bytes = len(existing)
        doc.duration_ms = int((time.monotonic() - started) * 1000)
        doc.ok = True
        doc.skipped = True
        return finish(doc)

    # A malformed payload is a tool error, not an API failure — fail it before
    # spending a 40-second round trip discovering the server dislikes it.
    try:
        json.loads(raw.decode("utf-8"))
    except (UnicodeDecodeError, json.JSONDecodeError) as exc:
        doc.duration_ms = int((time.monotonic() - started) * 1000)
        doc.error = "Invalid JSON: %s" % exc
        _say(quiet, "  [fail]  %s - %s" % (stem, doc.error))
        return finish(doc)

    with progress.lock:
        progress.in_flight[stem] = started

    last_error = ""
    last_kind = "network"
    status = None

    for attempt in range(1, retries + 2):
        doc.attempts = attempt
        attempt_started = time.monotonic()
        body = None if method in ("GET", "DELETE") else raw
        request = urllib.request.Request(url, data=body, headers=headers, method=method)

        try:
            with urllib.request.urlopen(request, timeout=timeout) as response:
                status = response.status
                payload = response.read()

            extracted = _extract_pdf(payload, response_mode, response_path)
            if isinstance(extracted, str):
                last_kind = "bad-response"
                last_error = extracted
            else:
                out_file.write_bytes(extracted)
                elapsed = (time.monotonic() - started) * 1000
                suffix = " (attempt %d)" % attempt if attempt > 1 else ""
                _say(
                    quiet,
                    "  [ok]    %s - %.1fKB in %s%s"
                    % (stem, len(extracted) / 1024.0, human_ms(elapsed), suffix),
                )
                doc.pdf = out_file.name
                doc.pdf_sha256 = sha256(extracted)
                doc.bytes = len(extracted)
                doc.http_status = status
                doc.duration_ms = int(elapsed)
                doc.ok = True
                return finish(doc)

        except urllib.error.HTTPError as exc:
            status = exc.code
            last_kind = "http-5xx" if exc.code >= 500 else "http-4xx"
            detail = exc.read()[:200].decode("utf-8", "replace")
            last_error = "HTTP %d: %s" % (exc.code, detail)
            # 401/403 almost always means the auth block or an env var is wrong,
            # and the server's own message rarely says so.
            if exc.code in (401, 403):
                last_error += " — check api.auth / api.headers and that any env reference is exported"

        except urllib.error.URLError as exc:
            reason = getattr(exc, "reason", exc)
            if isinstance(reason, TimeoutError) or "timed out" in str(reason).lower():
                last_kind = "timeout"
                last_error = "Timed out after %s" % human_ms(timeout * 1000)
            else:
                last_kind = "network"
                last_error = str(reason)

        except TimeoutError:
            last_kind = "timeout"
            last_error = "Timed out after %s" % human_ms(timeout * 1000)

        if attempt <= retries and _is_retryable(last_kind, retry_on_timeout):
            # Backoff scales with the API's own latency — a 250ms pause between
            # 40-second calls accomplishes nothing.
            wait = retry_backoff * (2 ** (attempt - 1))
            _say(
                quiet,
                "  [retry] %s - %s after %s, retry %d/%d in %s"
                % (
                    stem,
                    last_kind,
                    human_ms((time.monotonic() - attempt_started) * 1000),
                    attempt,
                    retries,
                    human_ms(wait * 1000),
                ),
            )
            time.sleep(wait)
            continue
        break

    hint = ""
    if last_kind == "timeout" and not retry_on_timeout:
        hint = " (raise --timeout, or --retry-on-timeout to retry)"
    _say(quiet, "  [fail]  %s - %s%s" % (stem, last_error, hint))

    doc.http_status = status
    doc.duration_ms = int((time.monotonic() - started) * 1000)
    doc.error = last_error
    return finish(doc)


def _heartbeat(progress: _Progress, every_ms: int, concurrency: int, stop: threading.Event) -> None:
    """Periodic "still alive" line.

    Without this a run against a slow API is silent for minutes at a time, which
    reads as a hang and trips CI inactivity watchdogs.
    """
    if every_ms <= 0:
        return
    interval = every_ms / 1000.0
    while not stop.wait(interval):
        with progress.lock:
            if not progress.in_flight:
                continue
            now = time.monotonic()
            longest_stem, longest_started = max(progress.in_flight.items(), key=lambda kv: now - kv[1])
            parts = [
                "%d in flight" % len(progress.in_flight),
                "longest %s %s" % (longest_stem, human_ms((now - longest_started) * 1000)),
                "%d/%d done" % (progress.done, progress.total),
            ]
            # Only project an ETA once there is a real sample to project from.
            if progress.durations:
                average = sum(progress.durations) / len(progress.durations)
                remaining = progress.total - progress.done
                if remaining > 0:
                    import math

                    parts.append("ETA ~%s" % human_ms(math.ceil(remaining / concurrency) * average))
        print("  [...]   %s" % " | ".join(parts), flush=True)


def generate(
    payloads,
    out,
    api,
    method: str = "POST",
    headers: Optional[dict] = None,
    response_mode: str = "json",
    response_path: str = "pdfBase64",
    concurrency: int = 4,
    timeout_ms: int = 120000,
    retries: int = 2,
    retry_on_timeout: bool = False,
    retry_backoff_ms: int = 2000,
    heartbeat_ms: int = 15000,
    skip_existing: bool = False,
    fail_fast: bool = False,
    quiet: bool = False,
) -> GenerateResult:
    """Call the render API once per payload and save the returned PDFs.

    Returns a GenerateResult; raises ToolError for tool-level problems.
    """
    payload_dir = Path(payloads)
    out_dir = Path(out)

    if not payload_dir.is_dir():
        raise ToolError("Payload directory not found: %s" % payload_dir)

    payload_files = sorted(p for p in payload_dir.iterdir() if p.is_file() and p.suffix.lower() == ".json")
    if not payload_files:
        raise ToolError(
            "No .json payloads in %s" % payload_dir,
            "Generating nothing and exiting 0 would let a broken pipeline look healthy.",
        )

    out_dir.mkdir(parents=True, exist_ok=True)
    headers = headers or {"Content-Type": "application/json"}
    run_started = time.monotonic()

    if not quiet:
        # Echo the resolved request shape — credentials are never printed, but
        # header names are, so "did my auth actually apply?" is answerable from
        # the log alone.
        print("Generating %d document(s)" % len(payload_files))
        print("  %-6s       %s" % (method, redact_url(api)))
        print("  out          %s" % out_dir.resolve())
        print("  headers      %s" % ", ".join(headers.keys()))
        detail = ' at "%s"' % response_path if response_mode == "json" else ""
        print("  response     %s%s" % (response_mode, detail))
        print(
            "  concurrency  %d | timeout %s | retries %d%s"
            % (concurrency, human_ms(timeout_ms), retries, " (incl. timeouts)" if retry_on_timeout else "")
        )
        print("")

    progress = _Progress(total=len(payload_files))
    stop = threading.Event()
    beat = threading.Thread(
        target=_heartbeat, args=(progress, 0 if quiet else heartbeat_ms, concurrency, stop), daemon=True
    )
    beat.start()

    def work(path: Path) -> GeneratedDoc:
        return _render_one(
            path, out_dir, api, method, headers, response_mode, response_path,
            timeout_ms / 1000.0, retries, retry_on_timeout, retry_backoff_ms / 1000.0,
            skip_existing, progress, quiet,
        )

    documents: List[GeneratedDoc] = []
    try:
        if fail_fast:
            for path in payload_files:
                doc = work(path)
                documents.append(doc)
                if not doc.ok:
                    break
        else:
            with ThreadPoolExecutor(max_workers=max(1, concurrency)) as pool:
                documents = list(pool.map(work, payload_files))
    finally:
        stop.set()

    succeeded = sum(1 for d in documents if d.ok)
    skipped = sum(1 for d in documents if d.skipped)
    failed = len(documents) - succeeded
    total_ms = int((time.monotonic() - run_started) * 1000)
    call_durations = [d.duration_ms for d in documents if d.ok and not d.skipped]

    manifest = {
        "generatedAt": datetime.now(timezone.utc).isoformat(),
        # Redacted — the manifest is an archived CI artifact.
        "api": redact_url(api),
        "payloadDir": str(payload_dir.resolve()),
        "outDir": str(out_dir.resolve()),
        "total": len(payload_files),
        "succeeded": succeeded,
        "failed": failed,
        "totalDurationMs": total_ms,
        "slowestMs": max(call_durations) if call_durations else None,
        "averageMs": int(sum(call_durations) / len(call_durations)) if call_durations else None,
        "entries": [d.to_manifest_entry() for d in documents],
        "producedBy": "pdfsuitepy",
    }
    manifest_path = out_dir / MANIFEST_FILENAME
    manifest_path.write_text(json.dumps(manifest, indent=2), encoding="utf-8")

    if not quiet:
        print("")
        reused = " (%d reused from disk)" % skipped if skipped else ""
        print("%d/%d generated in %s%s" % (succeeded, len(payload_files), human_ms(total_ms), reused))
        if call_durations:
            print(
                "  %d API call(s) | average %s | slowest %s"
                % (len(call_durations), human_ms(manifest["averageMs"]), human_ms(manifest["slowestMs"]))
            )
        print("  manifest: %s" % manifest_path)

        if failed:
            print("")
            print("%d document(s) failed:" % failed)
            for doc in documents:
                if not doc.ok:
                    print("  [fail] %s - %s" % (Path(doc.payload).stem, doc.error))
            print("")
            print("  Re-run with --skip-existing to retry only the failures.")

    return GenerateResult(
        total=len(payload_files),
        succeeded=succeeded,
        failed=failed,
        skipped=skipped,
        duration_ms=total_ms,
        out_dir=out_dir,
        manifest_path=manifest_path,
        documents=documents,
    )


def generate_exit_code(result: GenerateResult) -> int:
    """A partial generation must not look successful — the missing PDFs would
    otherwise surface later as unmatched pairs, far from the actual cause."""
    return Exit.OK if result.ok else Exit.TOOL_ERROR
