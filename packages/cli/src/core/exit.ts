// The exit codes and the tool error now live in `@pdfsuite/core/node`.
//
// They moved there for **W-30**: a command module loaded at run time is a
// separate bundle, so the error type has to be recognised by a brand rather
// than by class identity, and both bundles share `core`. The file stays as
// the path the host's own modules import, and the note that mattered here —
// why a tool error is a different exit code from a comparison failure — is
// now at the top of `@pdfsuite/core/node`.

export { EXIT, ToolError, isToolError, TOOL_ERROR_BRAND } from '@pdfsuite/core/node';
