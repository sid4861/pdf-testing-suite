"""Exit codes and the tool-level error type.

These MUST match the Node CLI exactly. A pipeline that switches between the two
implementations should not have to change how it interprets a result.
"""

from __future__ import annotations


class Exit:
    """Process exit codes — the primary contract with CI."""

    OK = 0
    """Every pair passed."""

    COMPARISON_FAILED = 1
    """At least one pair breached its thresholds. The PDFs changed."""

    TOOL_ERROR = 2
    """Bad args, unreachable API, unreadable file, nothing to compare.

    Kept distinct from COMPARISON_FAILED so a pipeline can tell "the PDFs
    regressed" (investigate the documents) from "the job is broken"
    (investigate the pipeline).
    """


class ToolError(Exception):
    """A tool-level failure. Rendered without a traceback and exits 2.

    `hint` carries the actionable next step — what to change, not just what broke.
    """

    def __init__(self, message: str, hint: str | None = None) -> None:
        super().__init__(message)
        self.hint = hint
