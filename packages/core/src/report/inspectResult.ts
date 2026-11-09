/**
 * `result.json` for an inspect — SR-REPORT-JSON, `kind: "inspect"`.
 *
 * W-28 DoD 4. Built on the same envelope as a compare and a spec check, for
 * the reason SR-REPORT-JSON decision 1 gives: one format, not three that
 * look alike. A pipeline that reads a comparison's result already knows how
 * to find the schema, the run, the policy and the inputs in this one.
 *
 * **An inspect has no verdict.** Nothing here passes or fails: the command
 * answers "what is on this page and where", and a question has no exit code
 * beyond "it was answered" or "the file could not be read". So `summary`
 * counts what was found and `exitCode` is 0 whenever the document opened.
 * Inventing a failure condition — "no text layer" say — would make the
 * command refuse documents it had read perfectly well.
 *
 * Byte-stable outside `run`: the elements come out in document order, inches
 * are already rounded by `inspectPage`, and nothing here consults a clock.
 */

import { buildEnvelope, resultJsonText, type ResultEnvelope, type ResultInput, type RunMeta } from './envelope';
import { sha256 } from './sha256';
import type { InspectedElement, InspectedPage } from '../inspect';

export interface ResultInspectPage {
  /** 1-based, as a person counts pages. */
  page: number;
  widthIn: number;
  heightIn: number;
  /** False for a scan, or text drawn as outlines (SR-PDF-SUPPORT). */
  hasTextLayer: boolean;
  elements: InspectedElement[];
}

export interface InspectResultJson extends ResultEnvelope {
  kind: 'inspect';
  summary: {
    /** Always 0 when the document opened: an inspect has no verdict. */
    exitCode: 0;
    pages: number;
    elements: number;
    textElements: number;
    imageElements: number;
    /** Pages that yielded no text at all, 1-based — named, not just counted. */
    pagesWithoutText: number[];
  };
  pages: ResultInspectPage[];
  /** The body's hash, so two runs compare without the clock in `run`. */
  findingsSha256: string | null;
}

export interface InspectResultMeta extends RunMeta {
  /** The file, named and hashed by whoever opened it. */
  file?: ResultInput;
  /** Which pages were asked for, 1-based. Absent means every page. */
  pagesRequested?: number[];
}

export async function buildInspectResultJson(
  inspected: InspectedPage[],
  meta: InspectResultMeta = {},
): Promise<InspectResultJson> {
  const pages: ResultInspectPage[] = inspected.map((p) => ({
    page: p.pageIndex + 1,
    widthIn: p.widthIn,
    heightIn: p.heightIn,
    hasTextLayer: p.hasTextLayer,
    // The image is deliberately dropped: `report.html` carries it, and a
    // result.json with base64 pages in it is a file nobody can read in a
    // terminal or diff between runs.
    elements: p.elements,
  }));

  let text = 0;
  let image = 0;
  for (const p of pages) {
    for (const el of p.elements) {
      if (el.kind === 'text') text++;
      else image++;
    }
  }

  const body = { pages };
  const hash = await sha256(new TextEncoder().encode(JSON.stringify(body))).catch(() => undefined);

  return {
    ...buildEnvelope(
      'inspect',
      {
        ruleId: 'inspect.v1',
        // What the numbers mean, recorded with them: a reader who finds
        // `fromLeftIn: 1.25` should not have to know which corner or which
        // unit from somewhere else (SR-INSPECT decision 3).
        units: { positions: 'inches', fontSizes: 'points' },
        origin: 'page top-left',
        ...(meta.pagesRequested ? { pagesRequested: meta.pagesRequested } : {}),
      },
      meta.file ? [meta.file] : [],
      meta,
    ),
    kind: 'inspect',
    summary: {
      exitCode: 0,
      pages: pages.length,
      elements: text + image,
      textElements: text,
      imageElements: image,
      pagesWithoutText: pages.filter((p) => !p.hasTextLayer).map((p) => p.page),
    },
    pages,
    findingsSha256: hash ?? null,
  };
}

export { resultJsonText };
