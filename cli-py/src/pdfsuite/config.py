"""Reads the SAME pdfsuite.config.json the Node CLI uses.

One source of truth for configuration regardless of which implementation drives
it — the same file, the same discovery rule, the same ${ENV_VAR} expansion, the
same validation. If the two disagreed about config, choosing an implementation
would silently change behaviour, which defeats the point of having both.
"""

from __future__ import annotations

import base64
import json
import os
import re
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Mapping, Optional, Tuple
from urllib.parse import urlencode, urlparse, urlunparse, parse_qsl

from .errors import ToolError

CONFIG_FILENAME = "pdfsuite.config.json"

# Mirrors the Node loader's KNOWN_KEYS. Keys beginning with "$" are metadata
# ($schema, $comment, $comment_anything) and are ignored everywhere.
KNOWN_KEYS = {
    "": {"api", "compare", "paths"},
    "api": {
        "url", "method", "headers", "query", "auth",
        "responseMode", "responsePath",
        "timeout", "retries", "retryOnTimeout", "retryBackoff",
        "concurrency", "heartbeat",
    },
    "compare": {"format", "pixelThreshold", "includeAA", "failOn"},
    "paths": {"payloads", "out", "reference", "candidate", "pairs", "report"},
}

RESPONSE_MODES = {"json", "binary", "base64"}
HTTP_METHODS = {"GET", "POST", "PUT", "PATCH", "DELETE"}

_ENV_PATTERN = re.compile(r"\$\{([A-Za-z_][A-Za-z0-9_]*)\}")


# -- discovery ------------------------------------------------------------
def discover_config(start: Optional[Path] = None) -> Optional[Path]:
    """Walk up from `start` looking for the config file, as git and eslint do.

    Lets commands work from anywhere inside the project rather than only its root.
    """
    directory = (start or Path.cwd()).resolve()
    while True:
        candidate = directory / CONFIG_FILENAME
        if candidate.is_file():
            return candidate
        if directory.parent == directory:  # filesystem root
            return None
        directory = directory.parent


# -- ${ENV_VAR} expansion -------------------------------------------------
def _expand_env(value: str, where: str) -> str:
    """Expand ${VAR} against the environment.

    A missing variable is a hard error rather than an empty string: silently
    sending an empty bearer token produces a 401 from the API and a confusing
    hunt far from the actual cause.
    """

    def replace(match):
        name = match.group(1)
        found = os.environ.get(name)
        if found is None:
            raise ToolError(
                "%s references ${%s}, which is not set in the environment." % (where, name),
                "Export %s before running, or replace the reference with a literal value." % name,
            )
        return found

    return _ENV_PATTERN.sub(replace, value)


def _expand_deep(node: Any, where: str) -> Any:
    if isinstance(node, str):
        return _expand_env(node, where)
    if isinstance(node, list):
        return [_expand_deep(v, "%s[%d]" % (where, i)) for i, v in enumerate(node)]
    if isinstance(node, dict):
        # "$"-prefixed keys are documentation and may mention env references literally.
        return {
            k: (v if k.startswith("$") else _expand_deep(v, "%s.%s" % (where, k)))
            for k, v in node.items()
        }
    return node


# -- validation -----------------------------------------------------------
def _validate_keys(node: Any, section: str, filename: str) -> None:
    """Reject unknown keys at every level, not just the top.

    A typo like `api.timout` is otherwise completely silent — the setting is
    ignored, the built-in default applies, and the run misbehaves in a way that
    points nowhere near the config file.
    """
    known = KNOWN_KEYS.get(section)
    if known is None or not isinstance(node, dict):
        return

    unknown = [k for k in node if not k.startswith("$") and k not in known]
    if unknown:
        where = '"%s"' % section if section else "top level"
        raise ToolError(
            "Unknown key(s) at %s in %s: %s" % (where, filename, ", ".join(unknown)),
            "Supported there: %s." % ", ".join(sorted(known)),
        )

    if section == "":
        for child in ("api", "compare", "paths"):
            if child in node:
                _validate_keys(node[child], child, filename)


# -- model ----------------------------------------------------------------
@dataclass
class LoadedConfig:
    data: dict = field(default_factory=dict)
    source: Optional[Path] = None

    @property
    def api(self) -> dict:
        return self.data.get("api") or {}

    @property
    def compare(self) -> dict:
        return self.data.get("compare") or {}

    @property
    def paths(self) -> dict:
        return self.data.get("paths") or {}


def load_config(explicit=None, use_config: bool = True) -> LoadedConfig:
    if not use_config:
        return LoadedConfig()

    path = Path(explicit).resolve() if explicit else discover_config()
    if path is None:
        return LoadedConfig()

    # An explicitly named config that does not exist is an error; a missing
    # discovered one just means "no config", which is fine.
    if not path.is_file():
        raise ToolError("Config file not found: %s" % path)

    try:
        parsed = json.loads(path.read_text(encoding="utf-8"))
    except json.JSONDecodeError as exc:
        raise ToolError("Could not parse %s: %s" % (path, exc))

    if not isinstance(parsed, dict):
        raise ToolError("%s must contain a JSON object at the top level." % path)

    _validate_keys(parsed, "", path.name)
    return LoadedConfig(data=_expand_deep(parsed, path.name), source=path)


# -- precedence -----------------------------------------------------------
def pick(cli_value: Any, config_value: Any, default: Any = None) -> Any:
    """Precedence: explicit CLI value > config file > built-in default.

    argparse defaults are set to None so "not passed" stays distinguishable from
    "passed the same value as the default" — the same distinction the Node CLI
    gets from commander's getOptionValueSource.
    """
    if cli_value is not None:
        return cli_value
    if config_value is not None:
        return config_value
    return default


# -- request shaping ------------------------------------------------------
def apply_auth(auth: Optional[Mapping[str, Any]]):
    """Turn an `auth` block into the header or query parameter it represents.

    Returns (header, query), at most one of which is set. Kept declarative
    because `basic` needs base64-encoded credentials, which nobody should be
    hand-rolling into a committed config file.
    """
    if not auth:
        return None, None

    kind = auth.get("type")

    if kind == "bearer":
        token = auth.get("token")
        if not token:
            raise ToolError('auth.type "bearer" requires "token".')
        return ("Authorization", "Bearer %s" % token), None

    if kind == "basic":
        username = auth.get("username")
        password = auth.get("password")
        if not username or password is None:
            raise ToolError('auth.type "basic" requires "username" and "password".')
        encoded = base64.b64encode(("%s:%s" % (username, password)).encode("utf-8")).decode("ascii")
        return ("Authorization", "Basic %s" % encoded), None

    if kind == "header":
        name, value = auth.get("name"), auth.get("value")
        if not name or not value:
            raise ToolError('auth.type "header" requires "name" and "value".')
        return (name, value), None

    if kind == "query":
        name, value = auth.get("name"), auth.get("value")
        if not name or not value:
            raise ToolError('auth.type "query" requires "name" and "value".')
        return None, (name, value)

    raise ToolError(
        'Unknown auth.type "%s".' % kind,
        "Supported: bearer, basic, header, query.",
    )


def merge_headers(config_headers, cli_headers, auth=None) -> dict:
    """Precedence: CLI -H > auth > config headers. Case-insensitive on name."""
    merged = {"content-type": ("Content-Type", "application/json")}

    for name, value in (config_headers or {}).items():
        merged[name.lower()] = (name, str(value))

    auth_header, _ = apply_auth(auth)
    if auth_header:
        merged[auth_header[0].lower()] = auth_header

    for raw in cli_headers or []:
        if ":" not in raw:
            raise ToolError('Malformed --header "%s"' % raw, 'Expected "Name: value".')
        name, _, value = raw.partition(":")
        merged[name.strip().lower()] = (name.strip(), value.strip())

    return dict(merged.values())


def build_url(base: str, query, auth=None) -> str:
    """Config url plus `query` entries and any query-type auth parameter.

    Parsed and re-encoded so an existing query string merges rather than being
    clobbered by naive concatenation.
    """
    parsed = urlparse(base)
    if not parsed.scheme or not parsed.netloc:
        raise ToolError(
            "Invalid API url: %s" % base,
            "Include the scheme, e.g. https://render.example.com/v1/documents",
        )

    params = dict(parse_qsl(parsed.query, keep_blank_values=True))
    for key, value in (query or {}).items():
        params[key] = str(value)

    _, auth_query = apply_auth(auth)
    if auth_query:
        params[auth_query[0]] = auth_query[1]

    return urlunparse(parsed._replace(query=urlencode(params)))


def normalize_method(method) -> str:
    value = (method or "POST").upper()
    if value not in HTTP_METHODS:
        raise ToolError(
            'Unsupported api.method "%s".' % method,
            "Supported: %s." % ", ".join(sorted(HTTP_METHODS)),
        )
    return value


def normalize_response_mode(mode) -> str:
    value = mode or "json"
    if value not in RESPONSE_MODES:
        raise ToolError(
            'Unsupported api.responseMode "%s".' % mode,
            "Supported: json (base64 at responsePath), binary (body is the PDF), "
            "base64 (body is a bare base64 string).",
        )
    return value
