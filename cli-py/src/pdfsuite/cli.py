"""`pdfsuitepy` — the command line entry point.

Mirrors the Node CLI's surface (same commands, same flags, same config file,
same exit codes) so a pipeline can switch between them without changing how it
interprets a result.
"""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

from . import __version__
from .compare import compare as run_compare, pairs_preview
from .config import (
    CONFIG_FILENAME,
    build_url,
    load_config,
    merge_headers,
    normalize_method,
    normalize_response_mode,
    pick,
)
from .errors import Exit, ToolError
from .generate import generate as run_generate, generate_exit_code
from .node import describe_backend

EPILOG = """
Typical run
  # 1. fill a directory with candidate PDFs (native Python, no Node needed)
  pdfsuitepy generate --payloads ./payloads --out ./candidates

  # 2. check them against the goldens, write reports
  pdfsuitepy compare --reference ./golden --candidate ./candidates --pairs ./pairs.json --report ./reports

  # 3. preview the pairing without comparing anything
  pdfsuitepy pairs --reference ./golden --candidate ./candidates --pairs ./pairs.json

Exit codes
  0  every pair passed
  1  a pair breached its thresholds — the PDFs changed
  2  tool error — bad args, API unreachable, unmatched pair, nothing to compare

Configuration
  The API url, headers and timeouts come from {config}, found by walking up
  from the current directory — the SAME file the Node CLI reads. Only the paths
  to process are passed as flags. An explicit flag always overrides the file.

Engine
  `generate` is native Python. `compare` delegates to the Node engine so its
  verdicts match the React app exactly; run `pdfsuitepy --version` to see which
  engine was found.
""".format(config=CONFIG_FILENAME)


def _add_common(parser: argparse.ArgumentParser) -> None:
    parser.add_argument("--config", metavar="FILE", help="path to %s (default: discovered)" % CONFIG_FILENAME)
    parser.add_argument("--no-config", action="store_true", help="ignore any config file")
    parser.add_argument("-v", "--verbose", action="store_true", help="show engine rendering warnings")
    parser.add_argument("-q", "--quiet", action="store_true", help="suppress progress output")


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        prog="pdfsuitepy",
        description="Generate PDFs from JSON payloads and check them against golden references.",
        epilog=EPILOG,
        formatter_class=argparse.RawDescriptionHelpFormatter,
    )
    parser.add_argument("-V", "--version", action="store_true", help="show the version and the engine in use")

    sub = parser.add_subparsers(dest="command", metavar="<command>")

    # -- generate ---------------------------------------------------------
    gen = sub.add_parser(
        "generate",
        help="POST each JSON payload to the render API and save the returned PDFs",
        description="Runs natively in Python — no Node required for this step.",
        epilog=(
            "Examples\n"
            "  pdfsuitepy generate --payloads ./payloads --out ./candidates\n"
            "  pdfsuitepy generate -p ./payloads -o ./candidates --api https://staging.example.com/render\n"
            "  pdfsuitepy generate -p ./payloads -o ./candidates --skip-existing\n"
            "\n"
            "Each <name>.json in --payloads becomes <name>.pdf in --out; that name is what\n"
            "pairs.json refers to, so keep it stable. Discovery is not recursive, and the\n"
            "payload body is sent verbatim — no particular field is required."
        ),
        formatter_class=argparse.RawDescriptionHelpFormatter,
    )
    # Defaults are None so "not passed" stays distinguishable from "passed the
    # default", which is what lets the config file fill the gap.
    gen.add_argument("-p", "--payloads", metavar="DIR", help="directory of .json payloads [config: paths.payloads]")
    gen.add_argument("-o", "--out", metavar="DIR", help="directory to write PDFs into [config: paths.out]")
    gen.add_argument("-a", "--api", metavar="URL", help="render endpoint [config: api.url]")
    gen.add_argument("-X", "--method", metavar="VERB", help="HTTP method [config: api.method]")
    gen.add_argument("--response-mode", choices=["json", "binary", "base64"], help="[config: api.responseMode]")
    gen.add_argument("--response-path", metavar="PATH", help="dot-path to the base64 PDF [config: api.responsePath]")
    gen.add_argument("-c", "--concurrency", type=int, metavar="N", help="requests in flight [config: api.concurrency]")
    gen.add_argument("-t", "--timeout", type=int, metavar="MS", help="per-request timeout [config: api.timeout]")
    gen.add_argument("-r", "--retries", type=int, metavar="N", help="retries on 5xx/network [config: api.retries]")
    gen.add_argument(
        "--retry-on-timeout",
        action="store_true",
        default=None,
        help="also retry timeouts (off by default — against a slow API the retry usually times out too)",
    )
    gen.add_argument("--retry-backoff", type=int, metavar="MS", help="base backoff, doubled per attempt")
    gen.add_argument("--heartbeat", type=int, metavar="MS", help="progress interval; 0 disables")
    gen.add_argument("-H", "--header", action="append", metavar="H", help='extra header ("Name: value")')
    gen.add_argument("--skip-existing", action="store_true", help="reuse PDFs already on disk (resume a partial run)")
    gen.add_argument("--fail-fast", action="store_true", help="stop at the first failure")
    _add_common(gen)

    # -- compare ----------------------------------------------------------
    cmp_ = sub.add_parser(
        "compare",
        help="compare candidate PDFs against golden references and write reports",
        description="Delegates to the Node engine so verdicts match the React app exactly.",
        epilog=(
            "A page fails if any threshold is breached:\n"
            "  content match   must be >= contentPct   (wording changed)\n"
            "  pixels differ   must be <= pixelPct     (colour / spacing / graphics changed)\n"
            "  max offset      must be <= offsetIn     (layout drifted)\n"
            "A page present on only one side always fails.\n"
            "\n"
            "Thresholds live in pairs.json — globally under \"defaults\", per pair under\n"
            "\"thresholds\"."
        ),
        formatter_class=argparse.RawDescriptionHelpFormatter,
    )
    cmp_.add_argument("-r", "--reference", metavar="DIR", help="golden PDFs [config: paths.reference]")
    cmp_.add_argument("-c", "--candidate", metavar="DIR", help="PDFs to check [config: paths.candidate]")
    cmp_.add_argument("-P", "--pairs", metavar="FILE", help="pairs.json [config: paths.pairs]")
    cmp_.add_argument("-o", "--report", metavar="DIR", help="where to write reports [config: paths.report]")
    cmp_.add_argument("-f", "--format", metavar="LIST", help="html,json,csv,junit [config: compare.format]")
    cmp_.add_argument("--pixel-threshold", type=float, metavar="N", help="[config: compare.pixelThreshold]")
    cmp_.add_argument("--include-aa", action="store_true", help="count anti-aliased pixels as differences")
    cmp_.add_argument("--fail-on", choices=["any", "none"], help="none = report only, always exit 0")
    _add_common(cmp_)

    # -- pairs ------------------------------------------------------------
    prs = sub.add_parser(
        "pairs",
        help="resolve and print the pairing table without comparing anything",
        formatter_class=argparse.RawDescriptionHelpFormatter,
    )
    prs.add_argument("-r", "--reference", metavar="DIR", help="golden PDFs [config: paths.reference]")
    prs.add_argument("-c", "--candidate", metavar="DIR", help="PDFs to check [config: paths.candidate]")
    prs.add_argument("-P", "--pairs", metavar="FILE", help="pairs.json [config: paths.pairs]")
    _add_common(prs)

    return parser


def _require(values) -> None:
    """Fail with one message listing every missing path, rather than one at a time."""
    missing = [(flag, key) for flag, value, key in values if not value]
    if missing:
        raise ToolError(
            "Missing required path(s): %s" % ", ".join(flag for flag, _ in missing),
            "Pass the flag, or set %s under \"paths\" in %s."
            % (" / ".join('"%s"' % key for _, key in missing), CONFIG_FILENAME),
        )


def _cmd_generate(args) -> int:
    loaded = load_config(args.config, not args.no_config)
    api_cfg, paths_cfg = loaded.api, loaded.paths

    base_url = pick(args.api, api_cfg.get("url"))
    if not base_url:
        raise ToolError(
            "No render API URL.",
            'Set "api": { "url": "..." } in %s, or pass --api <url>.' % CONFIG_FILENAME,
        )

    payloads = pick(args.payloads, paths_cfg.get("payloads"))
    out = pick(args.out, paths_cfg.get("out"))
    _require([("--payloads", payloads, "paths.payloads"), ("--out", out, "paths.out")])

    if loaded.source and not args.quiet:
        print("config: %s" % loaded.source)

    result = run_generate(
        payloads=payloads,
        out=out,
        api=build_url(base_url, api_cfg.get("query"), api_cfg.get("auth")),
        method=normalize_method(pick(args.method, api_cfg.get("method"))),
        headers=merge_headers(api_cfg.get("headers"), args.header, api_cfg.get("auth")),
        response_mode=normalize_response_mode(pick(args.response_mode, api_cfg.get("responseMode"))),
        response_path=pick(args.response_path, api_cfg.get("responsePath"), "pdfBase64"),
        concurrency=pick(args.concurrency, api_cfg.get("concurrency"), 4),
        timeout_ms=pick(args.timeout, api_cfg.get("timeout"), 120000),
        retries=pick(args.retries, api_cfg.get("retries"), 2),
        retry_on_timeout=bool(pick(args.retry_on_timeout, api_cfg.get("retryOnTimeout"), False)),
        retry_backoff_ms=pick(args.retry_backoff, api_cfg.get("retryBackoff"), 2000),
        heartbeat_ms=pick(args.heartbeat, api_cfg.get("heartbeat"), 15000),
        skip_existing=args.skip_existing,
        fail_fast=args.fail_fast,
        quiet=args.quiet,
    )
    return generate_exit_code(result)


def _cmd_compare(args) -> int:
    loaded = load_config(args.config, not args.no_config)
    paths_cfg, cmp_cfg = loaded.paths, loaded.compare

    reference = pick(args.reference, paths_cfg.get("reference"))
    candidate = pick(args.candidate, paths_cfg.get("candidate"))
    pairs_file = pick(args.pairs, paths_cfg.get("pairs"))
    report = pick(args.report, paths_cfg.get("report"))
    _require([
        ("--reference", reference, "paths.reference"),
        ("--candidate", candidate, "paths.candidate"),
        ("--pairs", pairs_file, "paths.pairs"),
        ("--report", report, "paths.report"),
    ])

    result = run_compare(
        reference=reference,
        candidate=candidate,
        pairs=pairs_file,
        report=report,
        fmt=pick(args.format, cmp_cfg.get("format")),
        pixel_threshold=pick(args.pixel_threshold, cmp_cfg.get("pixelThreshold")),
        include_aa=args.include_aa or bool(cmp_cfg.get("includeAA")),
        fail_on=pick(args.fail_on, cmp_cfg.get("failOn")),
        config=args.config,
        no_config=args.no_config,
        verbose=args.verbose,
        quiet=args.quiet,
    )
    return result.exit_code


def _cmd_pairs(args) -> int:
    loaded = load_config(args.config, not args.no_config)
    paths_cfg = loaded.paths

    reference = pick(args.reference, paths_cfg.get("reference"))
    candidate = pick(args.candidate, paths_cfg.get("candidate"))
    pairs_file = pick(args.pairs, paths_cfg.get("pairs"))
    _require([
        ("--reference", reference, "paths.reference"),
        ("--candidate", candidate, "paths.candidate"),
        ("--pairs", pairs_file, "paths.pairs"),
    ])

    return pairs_preview(
        reference=reference,
        candidate=candidate,
        pairs=pairs_file,
        config=args.config,
        no_config=args.no_config,
        quiet=args.quiet,
    )


def _force_utf8_stdout() -> None:
    """Windows consoles default to a legacy codepage, which mangles the box and
    bullet characters used in progress output. Python 3.7+ can retarget the
    stream; older or exotic environments simply keep their default."""
    for stream in (sys.stdout, sys.stderr):
        reconfigure = getattr(stream, "reconfigure", None)
        if reconfigure is not None:
            try:
                reconfigure(encoding="utf-8", errors="replace")
            except (ValueError, OSError):
                pass


def main(argv=None) -> int:
    _force_utf8_stdout()
    parser = build_parser()
    args = parser.parse_args(argv)

    if getattr(args, "version", False):
        print("pdfsuitepy %s" % __version__)
        print("  engine: %s" % describe_backend())
        return Exit.OK

    # Running `pdfsuitepy` bare is someone asking what this does — a successful
    # outcome, not an error.
    if not args.command:
        parser.print_help()
        return Exit.OK

    handlers = {"generate": _cmd_generate, "compare": _cmd_compare, "pairs": _cmd_pairs}

    try:
        return handlers[args.command](args)
    except ToolError as exc:
        print("\nError: %s" % exc, file=sys.stderr)
        if exc.hint:
            print("  %s" % exc.hint, file=sys.stderr)
        return Exit.TOOL_ERROR
    except KeyboardInterrupt:
        print("\nInterrupted.", file=sys.stderr)
        return Exit.TOOL_ERROR


if __name__ == "__main__":
    sys.exit(main())
