"""pdfsuitepy — PDF regression testing from Python.

Two halves, split by whether Node is needed:

    generate   native Python. HTTP, base64, file writes — no comparison logic,
               so no JS runtime required.
    compare    delegates to the Node engine, which is the same code the React
               app runs. A verdict here is the verdict the app would show.

Library use:

    from pdfsuite import compare, generate

    generate(payloads="./payloads", out="./candidates", api="https://…/render")

    result = compare(
        reference="./golden",
        candidate="./candidates",
        pairs="./pairs.json",
        report="./reports",
    )
    if not result.passed:
        for pair in result.failures:
            print(pair.id, pair.worst_page.breaches)

Both read the same pdfsuite.config.json the Node CLI does, so configuration does
not fork between implementations.
"""

from .compare import compare, pairs_preview
from .errors import Exit, ToolError
from .generate import generate
from .models import (
    CompareResult,
    GeneratedDoc,
    GenerateResult,
    PageVerdict,
    PairResult,
)

__version__ = "1.0.0"

__all__ = [
    "compare",
    "generate",
    "pairs_preview",
    "CompareResult",
    "PairResult",
    "PageVerdict",
    "GenerateResult",
    "GeneratedDoc",
    "Exit",
    "ToolError",
    "__version__",
]
