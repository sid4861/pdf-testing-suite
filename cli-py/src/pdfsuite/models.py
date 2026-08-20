"""Typed results, so callers work with objects rather than raw dicts.

These mirror the report.json / manifest.json the Node CLI writes. Parsing them
into dataclasses is most of the value of using this package as a library instead
of calling subprocess yourself.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from pathlib import Path
from typing import List, Optional


# -- generate -------------------------------------------------------------
@dataclass
class GeneratedDoc:
    """One document's trip through the render API."""

    payload: str
    payload_sha256: str
    pdf: Optional[str] = None
    pdf_sha256: Optional[str] = None
    bytes: Optional[int] = None
    http_status: Optional[int] = None
    duration_ms: int = 0
    attempts: int = 0
    ok: bool = False
    skipped: bool = False
    error: Optional[str] = None

    def to_manifest_entry(self) -> dict:
        """Serialised with the Node CLI's field names, so a manifest written by
        either implementation is readable by both."""
        entry = {
            "payload": self.payload,
            "payloadSha256": self.payload_sha256,
            "pdf": self.pdf,
            "pdfSha256": self.pdf_sha256,
            "bytes": self.bytes,
            "httpStatus": self.http_status,
            "durationMs": self.duration_ms,
            "attempts": self.attempts,
            "ok": self.ok,
        }
        if self.skipped:
            entry["skipped"] = True
        if self.error:
            entry["error"] = self.error
        return entry


@dataclass
class GenerateResult:
    total: int = 0
    succeeded: int = 0
    failed: int = 0
    skipped: int = 0
    duration_ms: int = 0
    out_dir: Optional[Path] = None
    manifest_path: Optional[Path] = None
    documents: List[GeneratedDoc] = field(default_factory=list)

    @property
    def ok(self) -> bool:
        return self.failed == 0

    @property
    def failures(self) -> List[GeneratedDoc]:
        return [d for d in self.documents if not d.ok]

    def summary(self) -> str:
        return "%d/%d generated, %d failed" % (self.succeeded, self.total, self.failed)


# -- compare --------------------------------------------------------------
@dataclass
class PageVerdict:
    page: int
    verdict: str  # PASS | FAIL | SKIPPED | MISSING
    content_match: float = 0.0
    pixel_ratio: float = 0.0
    max_offset_inches: float = 0.0
    breaches: List[str] = field(default_factory=list)

    @property
    def passed(self) -> bool:
        return self.verdict in ("PASS", "SKIPPED")


@dataclass
class PairResult:
    id: str
    name: str
    reference: str
    candidate: str
    verdict: str  # PASS | FAIL | ERROR
    error: Optional[str] = None
    duration_ms: int = 0
    pages: List[PageVerdict] = field(default_factory=list)

    @property
    def passed(self) -> bool:
        return self.verdict == "PASS"

    @property
    def failed_pages(self) -> List[PageVerdict]:
        return [p for p in self.pages if not p.passed]

    @property
    def worst_page(self) -> Optional[PageVerdict]:
        """The failing page with the most breaches — the one to look at first."""
        failed = self.failed_pages
        return max(failed, key=lambda p: len(p.breaches)) if failed else None


@dataclass
class CompareResult:
    exit_code: int = 0
    overall: str = "PASS"
    pair_count: int = 0
    pass_count: int = 0
    report_dir: Optional[Path] = None
    pairs: List[PairResult] = field(default_factory=list)

    @property
    def passed(self) -> bool:
        return self.exit_code == 0

    @property
    def failures(self) -> List[PairResult]:
        return [p for p in self.pairs if not p.passed]

    @property
    def html_report(self) -> Optional[Path]:
        if self.report_dir is None:
            return None
        candidate = self.report_dir / "report.html"
        return candidate if candidate.is_file() else None

    def summary(self) -> str:
        if not self.pairs:
            return "no pairs compared"
        lines = ["%d/%d pair(s) passed" % (self.pass_count, self.pair_count)]
        for pair in self.failures:
            if pair.error:
                lines.append("  %s — %s" % (pair.id, pair.error))
                continue
            for page in pair.failed_pages:
                lines.append("  %s page %d: %s" % (pair.id, page.page, ", ".join(page.breaches)))
        return "\n".join(lines)


def parse_report(payload: dict, report_dir: Optional[Path], exit_code: int) -> CompareResult:
    """Build a CompareResult from the Node CLI's report.json."""
    pairs = []
    for raw in payload.get("pairs", []):
        pages = [
            PageVerdict(
                page=p.get("page", 0),
                verdict=p.get("verdict", "FAIL"),
                content_match=p.get("contentMatch", 0.0),
                pixel_ratio=p.get("pixelRatio", 0.0),
                max_offset_inches=p.get("maxOffsetInches", 0.0),
                breaches=list(p.get("breaches") or []),
            )
            for p in raw.get("pages", [])
        ]
        pairs.append(
            PairResult(
                id=raw.get("id", "?"),
                name=raw.get("name", raw.get("id", "?")),
                reference=raw.get("reference", ""),
                candidate=raw.get("candidate", ""),
                verdict=raw.get("verdict", "FAIL"),
                error=raw.get("error"),
                duration_ms=raw.get("durationMs", 0),
                pages=pages,
            )
        )

    return CompareResult(
        exit_code=exit_code,
        overall=payload.get("overall", "FAIL"),
        pair_count=payload.get("pairCount", len(pairs)),
        pass_count=payload.get("passCount", sum(1 for p in pairs if p.passed)),
        report_dir=report_dir,
        pairs=pairs,
    )
