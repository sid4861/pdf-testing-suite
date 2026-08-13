// Exit codes are the CLI's primary contract with CI.
//
// Separating COMPARISON_FAILED from TOOL_ERROR is what lets a pipeline distinguish
// "the PDFs regressed" (investigate the documents) from "the job is broken"
// (investigate the pipeline). Collapsing them into a single non-zero code is a decision
// people regret the first time a build goes red for the wrong reason.

export const EXIT = {
  OK: 0,
  COMPARISON_FAILED: 1,
  TOOL_ERROR: 2,
} as const;

/** A tool-level failure: bad args, unreachable API, unreadable file, nothing to compare. */
export class ToolError extends Error {
  readonly hint?: string;
  constructor(message: string, hint?: string) {
    super(message);
    this.name = 'ToolError';
    this.hint = hint;
  }
}
