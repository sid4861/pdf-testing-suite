"""`compare` — delegates to the Node engine, returns typed results.

See node.py for why this delegates rather than reimplementing.

The Node CLI already writes report.json; this reads it back and turns it into
dataclasses, which is what makes the package useful as a library rather than a
subprocess call you write yourself.
"""

from __future__ import annotations

import json
from pathlib import Path
from typing import List, Optional

from .errors import Exit, ToolError
from .models import CompareResult, parse_report
from .node import run_node


def _flag(args: List[str], name: str, value) -> None:
    if value is not None:
        args.extend([name, str(value)])


def compare(
    reference,
    candidate,
    pairs,
    report,
    fmt: Optional[str] = None,
    pixel_threshold: Optional[float] = None,
    include_aa: bool = False,
    fail_on: Optional[str] = None,
    config: Optional[str] = None,
    no_config: bool = False,
    verbose: bool = False,
    quiet: bool = False,
) -> CompareResult:
    """Compare candidate PDFs against golden references.

    Returns a CompareResult whose `exit_code` mirrors the Node CLI's:
    0 all passed, 1 a pair breached its thresholds, 2 tool error.

    Raises ToolError only for problems detected before Node runs (missing
    engine, unusable Node). Anything Node itself rejects arrives as exit_code 2.
    """
    report_dir = Path(report)

    args = ["compare"]
    if no_config:
        args.append("--no-config")
    _flag(args, "--config", config)
    if verbose:
        args.append("--verbose")

    _flag(args, "--reference", reference)
    _flag(args, "--candidate", candidate)
    _flag(args, "--pairs", pairs)
    _flag(args, "--report", report)
    _flag(args, "--format", fmt)
    _flag(args, "--pixel-threshold", pixel_threshold)
    if include_aa:
        args.append("--include-aa")
    _flag(args, "--fail-on", fail_on)

    # json is what this function parses to build its result; ask for it whenever
    # the caller did not pin an explicit format.
    if fmt is not None and "json" not in fmt.split(","):
        parsed_report = None
    else:
        parsed_report = report_dir / "report.json"

    exit_code = run_node(args, quiet=quiet)

    if parsed_report is not None and parsed_report.is_file():
        try:
            payload = json.loads(parsed_report.read_text(encoding="utf-8"))
        except json.JSONDecodeError as exc:
            raise ToolError("Could not parse %s: %s" % (parsed_report, exc))
        return parse_report(payload, report_dir, exit_code)

    # No machine-readable report to read back (a tool error, or a format that
    # excluded json). The exit code is still authoritative.
    return CompareResult(
        exit_code=exit_code,
        overall="PASS" if exit_code == Exit.OK else "FAIL",
        report_dir=report_dir if report_dir.is_dir() else None,
    )


def pairs_preview(
    reference,
    candidate,
    pairs,
    config: Optional[str] = None,
    no_config: bool = False,
    quiet: bool = False,
) -> int:
    """Resolve and print the pairing table without comparing anything.

    Answers "why did it compare those two?" without waiting for a full run.
    """
    args = ["pairs"]
    if no_config:
        args.append("--no-config")
    _flag(args, "--config", config)
    _flag(args, "--reference", reference)
    _flag(args, "--candidate", candidate)
    _flag(args, "--pairs", pairs)
    return run_node(args, quiet=quiet)
