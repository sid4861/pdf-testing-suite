import { create } from 'zustand';
import type { PDFDocumentProxy } from 'pdfjs-dist';

import type { PdfSpec, SpecReport } from './types';
import { loadPdf, runSpec, validateSpec } from './specCheck';
import { sha256 } from '@sheetpane/import';

import { readSpecWorkbook, SpecIntakeError } from './specIntake';
import { looksLegacy, readLegacy, draftCounts, type LegacyDraft } from './specLegacy';
import { writeDraftWorkbook, draftFileName, writeBlankTemplate } from './specDraft';
import {
  validationReportHtml, extractionJson, specJsonText, annotateWorkbook,
  outputNames, saveFile, MIME,
} from './specOutputs';
import { buildResultJson, resultJsonText } from './specResult';
import { buildReportHtml } from './specReportHtml';
import { buildManifest, manifestText } from '@pdfsuite/core';
import { buildFixList } from './specFixList';
import { readTemplate, type Extraction } from './specTemplate';
import { compileSpec, type CompiledSpec } from './specCompile';
import { buildValidationReport, type ValidationReport } from './specValidate';

interface SpecState {
  pdfDoc: PDFDocumentProxy | null;
  pdfName: string | null;
  /**
   * The SHA-256 of the PDF as loaded, so the report can name the pair it
   * tested (SR-SPEC-CHECK decision 14). Null where `crypto.subtle` is absent.
   */
  pdfSha256: string | null;
  pdfPageCount: number;
  loadingPdf: boolean;
  errorPdf: string | null;

  spec: PdfSpec | null;
  specName: string | null;
  errorSpec: string | null;

  loadingWorkbook: boolean;

  /**
   * A legacy workbook, read as far as it honestly can be (decision 8). It
   * yields a draft for a person to confirm and **never** a spec, so when this
   * is set `spec` is null and nothing is checked.
   */
  legacyDraft: LegacyDraft | null;
  legacyCounts: { inferred: number; unreadable: number; rows: number } | null;

  /**
   * The template v2 reading of the uploaded workbook: every row as written,
   * with its sheet and cell. Kept because the downloadable outputs
   * (SR-SPEC-INTAKE decision 14) are built from it, not from the spec.
   */
  extraction: Extraction | null;
  /** The compiled spec's coverage and counts, for the downloads. */
  compiled: CompiledSpec | null;
  /** The uploaded `.xlsx` as it arrived, for the annotated workbook. */
  workbookBytes: Uint8Array | null;
  /**
   * What the workbook said and what was refused — shown before any PDF is
   * opened (decision 13). Null when the spec came from JSON, which has no
   * workbook to validate.
   */
  validation: ValidationReport | null;

  report: SpecReport | null;
  running: boolean;
  progress: { current: number; total: number } | null;
  currentPage: number; // 0-based index into report.pages / spec.pages

  loadingExample: boolean;

  /**
   * 'all'    — check every page the spec declares, at the page it declares.
   * 'single' — check ONE spec page against ONE chosen PDF page.
   *
   * A spec exported from a single sheet always says `"page": 1`, but the page it
   * describes may sit anywhere in a long document. 'single' lets it be pointed at
   * the right place without editing the spec.
   */
  mode: 'all' | 'single';
  /** 1-based PDF page to check in 'single' mode. */
  targetPdfPage: number;
  /** 1-based position in spec.pages to use in 'single' mode. */
  targetSpecPage: number;

  setMode: (m: 'all' | 'single') => void;
  setTargetPdfPage: (n: number) => void;
  setTargetSpecPage: (n: number) => void;

  loadPdfFile: (file: File) => Promise<void>;
  loadSpecFile: (file: File) => Promise<void>;
  /** The draft workbook's bytes, for the download the tab offers. */
  downloadDraft: () => Promise<void>;
  /** A blank Template v2 workbook to start a spec from (decision 7). */
  downloadBlankTemplate: () => Promise<void>;
  /** The four outputs of SR-SPEC-INTAKE decision 14. */
  downloadOutput: (which: 'validation' | 'annotated' | 'extraction' | 'spec') => Promise<void>;
  /**
   * The three files of a run — `result.json`, `report.html`, `manifest.json`
   * — as one zip (SR-SPEC-CHECK decision 15), or the Markdown fix-list,
   * which is a view rather than a file of the run.
   */
  downloadRun: (which: 'files' | 'fix-list') => Promise<void>;
  loadSpecText: (text: string, name: string) => void;
  clearPdf: () => void;
  clearSpec: () => void;
  run: () => Promise<void>;
  setPage: (i: number) => void;
  loadExample: () => Promise<void>;
}

/** A file name without its extension, for naming what a run produced. */
const base = (name: string | null) => (name ?? 'spec').replace(/\.[a-z0-9]+$/i, '');

export const useSpecStore = create<SpecState>((set, get) => ({
  pdfDoc: null,
  pdfName: null,
  pdfSha256: null,
  pdfPageCount: 0,
  loadingPdf: false,
  errorPdf: null,

  spec: null,
  specName: null,
  errorSpec: null,

  loadingWorkbook: false,
  legacyDraft: null,
  legacyCounts: null,

  extraction: null,
  compiled: null,
  workbookBytes: null,
  validation: null,

  report: null,
  running: false,
  progress: null,
  currentPage: 0,

  loadingExample: false,

  mode: 'all',
  targetPdfPage: 1,
  targetSpecPage: 1,

  setMode(m) {
    // Changing what gets checked invalidates the previous result.
    set({ mode: m, report: null, currentPage: 0 });
  },
  setTargetPdfPage(n) {
    const max = Math.max(1, get().pdfPageCount);
    set({ targetPdfPage: Math.min(Math.max(1, n), max), report: null, currentPage: 0 });
  },
  setTargetSpecPage(n) {
    const max = Math.max(1, get().spec?.pages.length ?? 1);
    set({ targetSpecPage: Math.min(Math.max(1, n), max), report: null, currentPage: 0 });
  },

  async loadPdfFile(file) {
    set({ loadingPdf: true, errorPdf: null });
    try {
      const doc = await loadPdf(file);
      // Hashed once, here, where the bytes are already in hand.
      const hash = await sha256(await file.arrayBuffer()).catch(() => undefined);
      set({
        pdfDoc: doc, pdfName: file.name, pdfSha256: hash ?? null,
        pdfPageCount: doc.numPages, loadingPdf: false, report: null,
        currentPage: 0, targetPdfPage: 1,
      });
    } catch (err) {
      set({ loadingPdf: false, errorPdf: err instanceof Error ? err.message : 'Failed to read PDF' });
    }
  },

  async loadSpecFile(file) {
    // `.xlsx` is the main path and `.json` goes straight in; everything else
    // is refused by name (decision 1). A workbook with no Pages List is not
    // v2 — it is read as legacy, which yields a draft and no spec.
    if (/\.(xlsx|xlsm)$/i.test(file.name)) {
      set({ loadingWorkbook: true, errorSpec: null });
      try {
        const book = await readSpecWorkbook(file);

        if (looksLegacy(book)) {
          const draft = readLegacy(book);
          set({
            legacyDraft: draft,
            compiled: null,
            workbookBytes: book.bytes,
            legacyCounts: draftCounts(draft),
            loadingWorkbook: false,
            spec: null,
            specName: book.name,
            extraction: null,
            validation: null,
            report: null,
            currentPage: 0,
            errorSpec: null,
          });
          return;
        }

        const extraction = readTemplate(book);
        const compiled = compileSpec(extraction);
        const validation = buildValidationReport(extraction, compiled);

        set({
          extraction,
          compiled,
          workbookBytes: book.bytes,
          validation,
          legacyDraft: null,
          legacyCounts: null,
          // A blocked workbook yields no spec: decision 13 stops the run
          // rather than checking a PDF against half a spec.
          spec: validation.blocking ? null : compiled.spec,
          specName: book.name,
          loadingWorkbook: false,
          report: null,
          currentPage: 0,
          // The Pages List declares its own page numbers.
          mode: 'all',
          targetSpecPage: 1,
          errorSpec: null,
        });
      } catch (err) {
        set({
          loadingWorkbook: false,
          extraction: null,
          compiled: null,
          workbookBytes: null,
          validation: null,
          legacyDraft: null,
          errorSpec: err instanceof SpecIntakeError || err instanceof Error
            ? err.message
            : 'Failed to read the workbook',
        });
      }
      return;
    }

    try {
      const text = await file.text();
      get().loadSpecText(text, file.name);
    } catch (err) {
      set({ errorSpec: err instanceof Error ? err.message : 'Failed to read spec file' });
    }
  },

  async downloadOutput(which) {
    const { extraction, compiled, validation, workbookBytes, specName } = get();
    const name = specName ?? 'spec.xlsx';
    try {
      if (which === 'validation' && validation) {
        saveFile(outputNames.validation(name), validationReportHtml(validation), MIME.html);
      } else if (which === 'extraction' && extraction && compiled) {
        saveFile(outputNames.extraction(name), extractionJson(extraction, compiled), MIME.json);
      } else if (which === 'spec' && compiled) {
        saveFile(outputNames.spec(name), specJsonText(compiled.spec), MIME.json);
      } else if (which === 'annotated' && validation && workbookBytes) {
        // Surgery on the author's own file: if it cannot be done cleanly it is
        // not done at all, and the tab says so rather than handing over a
        // workbook Excel might refuse.
        saveFile(outputNames.annotated(name), await annotateWorkbook(workbookBytes, validation), MIME.xlsx);
      }
    } catch (err) {
      set({ errorSpec: err instanceof Error ? err.message : 'That download could not be produced' });
    }
  },

  async downloadRun(which) {
    const { report, pdfName, specName } = get();
    if (!report) return;
    try {
      const started = new Date().toISOString();
      const result = await buildResultJson(report, { startedAt: started });

      if (which === 'fix-list') {
        saveFile(`${base(specName)} — fix list.md`, buildFixList(result), 'text/markdown');
        return;
      }

      // Images only for the pages that failed (SR-REPORT-HTML decision 6).
      const images: Record<number, string> = {};
      for (const p of report.pages) if (p.failCount > 0 && p.dataUrl) images[p.page] = p.dataUrl;

      const resultText = resultJsonText(result);
      const html = buildReportHtml(result, { images });
      // Written last, over the final bytes of the other two (SR-MANIFEST
      // decision 2). The inputs keep the hashes result.json already recorded.
      const manifest = await buildManifest([
        ...result.inputs.map((i) => ({
          name: i.name, role: 'input' as const, bytes: i.bytes ?? 0, sha256: i.sha256,
        })),
        { name: 'result.json', role: 'output' as const, data: resultText },
        { name: 'report.html', role: 'output' as const, data: html },
      ]);

      const { default: JSZip } = await import('jszip');
      const zip = new JSZip();
      zip.file('result.json', resultText);
      zip.file('report.html', html);
      zip.file('manifest.json', manifestText(manifest));
      const bytes = await zip.generateAsync({ type: 'uint8array' });
      saveFile(`${base(pdfName ?? specName)} — spec run.zip`, bytes, 'application/zip');
    } catch (err) {
      set({ errorSpec: err instanceof Error ? err.message : 'That download could not be produced' });
    }
  },

  async downloadBlankTemplate() {
    saveFile('Template v2 — blank.xlsx', await writeBlankTemplate(), MIME.xlsx);
  },

  async downloadDraft() {
    const draft = get().legacyDraft;
    if (!draft) return;
    const bytes = await writeDraftWorkbook(draft);
    const blob = new Blob([bytes as unknown as BlobPart], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = draftFileName(draft.workbook);
    a.click();
    URL.revokeObjectURL(url);
  },

  loadSpecText(text, name) {
    try {
      const parsed = validateSpec(JSON.parse(text));
      set({
        spec: parsed, specName: name, errorSpec: null, report: null, currentPage: 0, targetSpecPage: 1,
        extraction: null, compiled: null, workbookBytes: null, validation: null,
        legacyDraft: null, legacyCounts: null,
      });
    } catch (err) {
      set({ errorSpec: err instanceof Error ? err.message : 'Invalid spec JSON' });
    }
  },

  clearPdf() {
    set({ pdfDoc: null, pdfName: null, pdfSha256: null, pdfPageCount: 0, errorPdf: null, report: null, currentPage: 0 });
  },
  clearSpec() {
    set({
      spec: null, specName: null, errorSpec: null, report: null, currentPage: 0,
      extraction: null, compiled: null, workbookBytes: null, validation: null,
        legacyDraft: null, legacyCounts: null,
    });
  },

  async run() {
    const { pdfDoc, spec, mode, targetPdfPage, targetSpecPage, compiled, pdfName, pdfSha256 } = get();
    if (!pdfDoc || !spec || get().running) return;

    const single = mode === 'single';
    set({ running: true, progress: { current: 0, total: single ? 1 : spec.pages.length } });
    try {
      const report = await runSpec(pdfDoc, spec, {
        onProgress: (current, total) => set({ progress: { current, total } }),
        // Coverage belongs to the result (decision 13): the checker sees
        // assertions, so the counts come from whoever compiled the workbook.
        ...(compiled ? { coverage: compiled.counts } : {}),
        ...(pdfName ? { pdfName } : {}),
        pdfSha256,
        specPageIndex: single ? targetSpecPage : undefined,
        pdfPageOverride: single ? targetPdfPage : undefined,
      });
      set({ report, running: false, progress: null, currentPage: 0 });
    } catch (err) {
      set({ running: false, progress: null, errorSpec: err instanceof Error ? err.message : 'Check failed' });
    }
  },

  setPage(i) {
    const total = get().report?.pages.length ?? 0;
    set({ currentPage: Math.max(0, Math.min(i, Math.max(0, total - 1))) });
  },

  async loadExample() {
    set({ loadingExample: true });
    try {
      const base = import.meta.env.BASE_URL;
      const [pdfRes, specRes] = await Promise.all([
        fetch(`${base}samples/spec-sample.pdf`),
        fetch(`${base}samples/spec-sample.json`),
      ]);
      if (!pdfRes.ok || !specRes.ok) throw new Error('Could not fetch the bundled spec example.');
      const pdfBlob = await pdfRes.blob();
      const specText = await specRes.text();
      await get().loadPdfFile(new File([pdfBlob], 'spec-sample.pdf', { type: 'application/pdf' }));
      get().loadSpecText(specText, 'spec-sample.json');
    } catch (err) {
      set({ errorSpec: err instanceof Error ? err.message : 'Failed to load example' });
    } finally {
      set({ loadingExample: false });
    }
  },
}));
