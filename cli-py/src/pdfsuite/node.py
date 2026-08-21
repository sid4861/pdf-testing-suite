"""Locating and invoking the Node comparison engine.

`compare` delegates rather than reimplementing, because every number it produces
comes from pdf.js rendering. A Python port using PyMuPDF or pypdfium2 would
rasterize differently — different anti-aliasing, font hinting and subpixel
positioning — so pixel ratios, content-match percentages and offsets would all
differ from what the React app shows for the same pair. Thresholds tuned in the
app would be wrong here, and goldens blessed with one tool would fail with the
other.

Delegating keeps a single source of truth: a verdict from this package is the
verdict the app would show.
"""

from __future__ import annotations

import os
import re
import shutil
import subprocess
import sys
from pathlib import Path
from typing import List, Optional

from .errors import ToolError

MIN_NODE_MAJOR = 20

# Env overrides, for when the bundle is not beside this checkout.
ENV_NODE = "PDFSUITE_NODE"
ENV_BUNDLE = "PDFSUITE_NODE_BUNDLE"


def find_node() -> str:
    """Absolute path to the node executable.

    shutil.which handles the Windows .cmd/.exe shim resolution that bites when
    invoking npm-installed tooling from Python.
    """
    override = os.environ.get(ENV_NODE)
    if override:
        if not Path(override).is_file():
            raise ToolError(
                "%s points at %s, which does not exist." % (ENV_NODE, override)
            )
        return override

    found = shutil.which("node")
    if not found:
        raise ToolError(
            "Node.js was not found on PATH.",
            "pdfsuitepy runs the comparison engine under Node (>=%d). Install it from "
            "https://nodejs.org, or set %s to the executable." % (MIN_NODE_MAJOR, ENV_NODE),
        )
    return found


def node_version(node: str) -> str:
    try:
        out = subprocess.run(
            [node, "--version"], capture_output=True, text=True, timeout=30, check=False
        )
    except (OSError, subprocess.SubprocessError) as exc:
        raise ToolError("Could not run %s --version: %s" % (node, exc))
    return (out.stdout or out.stderr or "").strip()


def check_node(node: str) -> str:
    """Fail early and clearly on an unsupported Node, rather than surfacing a
    cryptic syntax error from the bundle."""
    version = node_version(node)
    match = re.match(r"v(\d+)\.", version)
    if not match:
        raise ToolError("Could not determine the Node version (got %r)." % version)
    if int(match.group(1)) < MIN_NODE_MAJOR:
        raise ToolError(
            "Node %s is too old — the comparison engine needs >=%d." % (version, MIN_NODE_MAJOR),
            "Upgrade Node, or point %s at a newer executable." % ENV_NODE,
        )
    return version


def find_bundle() -> Path:
    """Locate the built Node CLI (cli/dist/index.js).

    Searched in order: env override, then upward from this file, then upward
    from the working directory — so it resolves both from a source checkout and
    from an installed package sitting next to the repo.
    """
    override = os.environ.get(ENV_BUNDLE)
    if override:
        path = Path(override)
        if not path.is_file():
            raise ToolError("%s points at %s, which does not exist." % (ENV_BUNDLE, override))
        return path

    candidates: List[Path] = []
    for start in (Path(__file__).resolve(), Path.cwd().resolve() / "_"):
        for parent in start.parents:
            candidates.append(parent / "cli" / "dist" / "index.js")
            candidates.append(parent / "dist" / "index.js")

    for candidate in candidates:
        if candidate.is_file():
            return candidate

    raise ToolError(
        "Could not find the Node comparison bundle (cli/dist/index.js).",
        "Build it with `cd cli && npm install && npm run build`, or set %s to the "
        "built index.js." % ENV_BUNDLE,
    )


def run_node(args: List[str], cwd: Optional[Path] = None, quiet: bool = False) -> int:
    """Run the Node CLI, streaming its output live, and return its exit code.

    Streaming rather than capturing is essential: the engine prints per-pair
    progress and, during generation, a heartbeat. Buffering it would make a long
    run look hung — the exact CI-watchdog problem the heartbeat exists to avoid.
    """
    node = find_node()
    check_node(node)
    bundle = find_bundle()

    command = [node, str(bundle)] + args

    try:
        process = subprocess.Popen(
            command,
            cwd=str(cwd) if cwd else None,
            stdout=None if not quiet else subprocess.DEVNULL,
            stderr=None if not quiet else subprocess.DEVNULL,
        )
    except OSError as exc:
        raise ToolError("Could not start Node: %s" % exc)

    try:
        return process.wait()
    except KeyboardInterrupt:
        # Let the child settle so it does not leave a half-written report behind.
        process.terminate()
        try:
            process.wait(timeout=10)
        except subprocess.TimeoutExpired:
            process.kill()
        raise


def describe_backend() -> str:
    """One-line description of the engine actually being used, for `--version`
    and for diagnosing 'why does this disagree with my other machine'."""
    try:
        node = find_node()
        version = node_version(node)
        bundle = find_bundle()
        return "node %s · %s" % (version, bundle)
    except ToolError as exc:
        return "unavailable — %s" % exc


def print_backend_error(exc: ToolError) -> None:
    print("Error: %s" % exc, file=sys.stderr)
    if exc.hint:
        print("  %s" % exc.hint, file=sys.stderr)
