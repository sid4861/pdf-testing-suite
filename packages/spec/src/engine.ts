/**
 * The spec-driven feature's headless surface.
 *
 * `index.ts` is the UI barrel: it pulls in React components and a stylesheet,
 * which a Node process cannot use. The CLI needs the checker and nothing else,
 * so it imports this file instead of reaching at a file inside the folder.
 *
 * Both barrels are the contract. Anything not exported from one of them is
 * internal and may be renamed or removed by whoever is working on this folder,
 * without warning to the rest of the repository.
 */

export { runSpec, validateSpec, loadPdf, canonical } from './specCheck';

// Binding the Pages List to the PDF's pages (W-04 DoD 2).
export { bindPages, hasPagesList, normalizePageText } from './specPages';
export type { PageBinding, BindResult } from './specPages';

// Spec intake (W-02): the one workbook reader, over @sheetpane/import.
export {
  readSpecWorkbook,
  uploadKind,
  SpecIntakeError,
  colName,
  cellRef,
} from './specIntake';
export type { SpecWorkbook, SpecUploadKind, IntakeNote } from './specIntake';

// Template v2 parsing (W-02 DoD 3).
export { readTemplate, readLists, readSettings, readPagesList, readPageSheet } from './specTemplate';
export type { Extraction, Vocabulary, Settings, PageListEntry, SpecRow, ParameterRule } from './specTemplate';
export { compileSpec } from './specCompile';
export type { CompiledSpec, CoverageEntry, SourceCell } from './specCompile';
export { parseNumber, parseNumericValue, bandOf } from './specValues';
export { buildValidationReport, explainSpec, coverageLine } from './specValidate';
// The same findings in the shape everything but the tab reads (W-48).
export {
  toValidationResult, validationJsonText, VALIDATION_SCHEMA,
  type ValidationResult, type ValidationLine,
} from './specValidate';
export { INTAKE_CODES, type IntakeCode } from './specIntake';
// The legacy nested layout (W-02 DoD 4) — a draft workbook, never a spec.
export { looksLegacy, readLegacy, parseProse, draftCounts } from './specLegacy';
export type { LegacyDraft, DraftRow, DraftCell, Origin } from './specLegacy';
export { writeDraftWorkbook, draftFileName, writeBlankTemplate } from './specDraft';

// The workbook's own cells, marked — the join between what the spec engine
// found and what sheetpane draws (W-46 DoD 2). No judgment of its own.
export {
  validationMarks, resultMarks, allMarks, splitRef, LAYERS, type SheetMark,
} from './sheetMarks';
// The four downloadable outputs (W-02 DoD 7, decision 14).
export {
  validationReportHtml, extractionJson, specJsonText, annotateWorkbook, outputNames,
} from './specOutputs';
export type { ValidationReport, ExplainedAssertion } from './specValidate';
export { parseFontName, compareFont, weightDistance } from './specFonts';
export type { FontName, FontVerdict } from './specFonts';
export { parseHex, toHex, deltaE2000, compareColour, cmykToRgb, grayToRgb } from './specColour';
export type { Rgb } from './specColour';
export type { ParsedValue } from './specValues';
// The three files of a run (W-04 DoD 5) — one builder each, called by the
// tab today and by `pdfsuite spec` when W-11 lands (L3).
export { buildResultJson, resultJsonText, RESULT_SCHEMA } from './specResult';
export type { ResultJson, ResultMeta, ResultPage, ResultElement, ResultCheck } from './specResult';
export { buildReportHtml } from './specReportHtml';
export type { ReportHtmlOptions } from './specReportHtml';
export { buildManifest, manifestText, MANIFEST_SCHEMA } from '@pdfsuite/core';
export type { Manifest, ManifestEntry, ManifestFile } from '@pdfsuite/core';
export { buildFixList } from './specFixList';

export type {
  PdfSpec, SpecPage, SpecRepeats, SpecElement, SpecUnit, SpecTolerance, SpecAnchor,
  PageFinding,
  TextSpec, ImageSpec, TableSpec, ParagraphSpec,
  SpecReport, SpecPageResult, ElementResult, CheckResult, Box,
} from './types';
