import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSpecStore } from './specStore';
import SpecUpload from './SpecUpload';
import SheetView from './SheetView';
import { resultMarks, validationMarks } from './sheetMarks';
import type { Box, ElementResult, SpecPageResult } from './types';

/** What each verdict is called on screen. Never fold one into another: an
 *  unverifiable element is not a failure of the document. */
const STATUS_LABEL: Record<ElementResult['status'], string> = {
  pass: 'PASS',
  fail: 'FAIL',
  'not-found': 'NOT FOUND',
  warning: 'WARNING',
  unverifiable: 'UNVERIFIABLE',
};

const TYPE_ICON: Record<ElementResult['type'], string> = {
  text: '📝',
  image: '🖼️',
  table: '▦',
  paragraph: '¶',
};

function pct(v: number, total: number) {
  return `${(v / total) * 100}%`;
}

/** A box in page points, as percentages of the page — the one conversion. */
function boxStyle(box: Box, page: SpecPageResult): React.CSSProperties {
  return {
    left: pct(box.left, page.pageWidthPt),
    top: pct(box.top, page.pageHeightPt),
    width: pct(Math.max(box.width, 2), page.pageWidthPt),
    height: pct(Math.max(box.height, 2), page.pageHeightPt),
  };
}

function OverlayBox({
  box,
  page,
  kind,
  status,
  active,
}: {
  box: Box;
  page: SpecPageResult;
  kind: 'expected' | 'actual';
  status: ElementResult['status'];
  active: boolean;
}) {
  const color = kind === 'expected' ? 'var(--indigo)' : status === 'pass' ? 'var(--emerald)' : 'var(--red)';
  return (
    <div
      className={`spec-ov ${kind} ${active ? 'active' : ''}`}
      style={{
        left: pct(box.left, page.pageWidthPt),
        top: pct(box.top, page.pageHeightPt),
        width: pct(Math.max(box.width, 2), page.pageWidthPt),
        height: pct(Math.max(box.height, 2), page.pageHeightPt),
        borderColor: color,
      }}
    />
  );
}
/**
 * What the spec asked for and what the PDF has, on the page itself.
 *
 * Compare shows before → after when you hover a change; this is the same
 * idea for a spec check. It is anchored to the element's own box so it
 * reads as belonging to the thing it describes, and it only lists the
 * checks that *failed* — a passing measurement is not news, and fifteen of
 * them would bury the one that matters.
 */
function HoverCard({ el, page }: { el: ElementResult; page: SpecPageResult }) {
  const box = el.actualBox ?? el.expectedBox;
  if (!box) return null;
  const failed = el.checks.filter((c) => !c.pass);
  const shown = failed.length > 0 ? failed : el.checks.slice(0, 3);

  // Flip above the box when it sits low on the page, so the card is never
  // off the bottom of the stage.
  const below = (box.top + box.height) / page.pageHeightPt < 0.75;
  const style: React.CSSProperties = {
    left: pct(box.left, page.pageWidthPt),
    [below ? 'top' : 'bottom']: below
      ? pct(box.top + box.height, page.pageHeightPt)
      : pct(page.pageHeightPt - box.top, page.pageHeightPt),
  };

  return (
    <div className={`spec-hovercard ${el.status}`} style={style}>
      <div className="hc-title">
        <span className="hc-ic">{TYPE_ICON[el.type]}</span>
        <b>{el.label}</b>
        <span className={`spec-badge ${el.status}`}>{STATUS_LABEL[el.status]}</span>
      </div>
      <ul className="hc-rows">
        {shown.map((c, i) => (
          <li key={i} className={c.pass ? 'ok' : 'no'}>
            <span className="hc-name">{c.name}</span>
            <span className="hc-spec">{c.expected}</span>
            <span className="hc-arrow">→</span>
            <span className="hc-pdf">{c.actual}</span>
            {c.delta && <span className="hc-delta">{c.delta}</span>}
          </li>
        ))}
      </ul>
    </div>
  );
}

export default function SpecTestView() {
  const pdfName = useSpecStore((s) => s.pdfName);
  const loadingPdf = useSpecStore((s) => s.loadingPdf);
  const errorPdf = useSpecStore((s) => s.errorPdf);
  const specName = useSpecStore((s) => s.specName);
  const errorSpec = useSpecStore((s) => s.errorSpec);
  const report = useSpecStore((s) => s.report);
  const running = useSpecStore((s) => s.running);
  const currentPage = useSpecStore((s) => s.currentPage);
  const loadingExample = useSpecStore((s) => s.loadingExample);

  const loadPdfFile = useSpecStore((s) => s.loadPdfFile);
  const loadSpecFile = useSpecStore((s) => s.loadSpecFile);
  const clearPdf = useSpecStore((s) => s.clearPdf);
  const clearSpec = useSpecStore((s) => s.clearSpec);
  const run = useSpecStore((s) => s.run);
  const setPage = useSpecStore((s) => s.setPage);
  const loadExample = useSpecStore((s) => s.loadExample);
  const pdfDoc = useSpecStore((s) => s.pdfDoc);
  const spec = useSpecStore((s) => s.spec);
  const validation = useSpecStore((s) => s.validation);
  const loadingWorkbook = useSpecStore((s) => s.loadingWorkbook);
  const legacyDraft = useSpecStore((s) => s.legacyDraft);
  const legacyCounts = useSpecStore((s) => s.legacyCounts);
  const downloadDraft = useSpecStore((s) => s.downloadDraft);
  const workbookBytes = useSpecStore((s) => s.workbookBytes);

  const [hovered, setHovered] = useState<string | null>(null);

  // Which half of the tab is on screen. In the store rather than here
  // because the switch is in the app header now and the body reads it.
  const view = useSpecStore((s) => s.view);
  const setView = useSpecStore((s) => s.setView);

  /** Page zoom, as in Compare. The overlays are percentages, so the
      wrapper's width is the only thing that has to change. */
  const [zoom, setZoom] = useState(1);

  // ── the workbook, as a sheet (W-46) ─────────────────────────────────
  //
  // Both lists are derived, not stored: they are a pure function of the
  // report they come from, and a copy in the store is a copy that goes
  // stale the first time somebody re-runs a check.
  const sheetValidation = useMemo(
    () => (validation ? validationMarks(validation) : []),
    [validation],
  );
  const sheetResults = useMemo(() => (report ? resultMarks(report) : []), [report]);

  // ── the sheet and the page point at each other (DoD 5) ──────────────
  //
  // One index, both ways. A mark knows its cell and, through `meta`, the
  // element and page it came from; that is the whole correspondence, and
  // deriving it twice would be two answers to one question.
  const [selectedCell, setSelectedCell] = useState<{ sheet: string; range: string } | null>(null);

  const cellOfElement = useMemo(() => {
    const m = new Map<string, { sheet: string; range: string }>();
    // First wins: an element's rows are in workbook order, so the first is
    // the one a person would scroll to.
    for (const mark of sheetResults) {
      const id = mark.meta?.elementId;
      if (id && !m.has(id)) m.set(id, { sheet: mark.sheet, range: mark.range });
    }
    return m;
  }, [sheetResults]);

  const elementOfCell = useMemo(() => {
    const m = new Map<string, { elementId: string; page: number }>();
    for (const mark of sheetResults) {
      if (!mark.meta) continue;
      const key = `${mark.sheet}!${mark.range}`;
      if (!m.has(key)) m.set(key, { elementId: mark.meta.elementId, page: mark.meta.page });
    }
    return m;
  }, [sheetResults]);

  /** A cell was picked on the sheet: show its element on the page. */
  const onSheetSelect = useCallback((at: { sheet: string; range: string }) => {
    const hit = elementOfCell.get(`${at.sheet}!${at.range}`);
    if (!hit) return;
    // The report's own page order, not the PDF's: `--pages` can bind them
    // out of order, and the strip is indexed by the former.
    const index = report?.pages.findIndex((p) => p.page === hit.page) ?? -1;
    if (index >= 0) setPage(index);
    setHovered(hit.elementId);
  }, [elementOfCell, report, setPage]);

  /**
   * Open the workbook at one cell.
   *
   * It has to switch views as well as select, now that the sheet lives
   * behind the Workbook tab (W-53): selecting a cell on a sheet nobody can
   * see is a click that does nothing.
   */
  const goToCell = useCallback((at: { sheet: string; range: string }) => {
    setSelectedCell(at);
    setView('workbook');
  }, [setView]);

  /** The same, from a check's `Sheet!A1` string. */
  const goToRef = useCallback((ref: string) => {
    const bang = ref.indexOf('!');
    if (bang <= 0) return;
    goToCell({ sheet: ref.slice(0, bang), range: ref.slice(bang + 1) });
  }, [goToCell]);

  /** An element was picked on the page: open the cell it came from. */
  const showCellFor = useCallback((elementId: string) => {
    const at = cellOfElement.get(elementId);
    if (at) goToCell(at);
  }, [cellOfElement, goToCell]);

  /**
   * The card for each element, so a hover on the *page* can scroll the
   * rail to it. Without this the highlight happens below the fold and the
   * hover looks like it did nothing.
   */
  const cardRefs = useRef(new Map<string, HTMLDivElement>());

  /** Hovering an element on the page: light its card and reveal it. */
  const hoverFromPage = useCallback((id: string | null) => {
    setHovered(id);
    if (!id) return;
    cardRefs.current.get(id)?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }, []);

  // Whether the findings rail is open. In the store so the sheet's panel
  // answers the same switch — see `railOpen` there.
  const railOpen = useSpecStore((st) => st.railOpen);
  const setRailOpen = useSpecStore((st) => st.setRailOpen);

  // Auto-run when both a PDF and a spec are loaded.
  useEffect(() => {
    if (pdfDoc && spec && !report && !running) run();
  }, [pdfDoc, spec, report, running, run]);

  const page = report?.pages[currentPage];

  return (
    <>

      {/* A legacy workbook is a migration input, never a spec: what comes
          back is a draft with the inferred cells highlighted, for a person to
          confirm in Excel (SR-SPEC-INTAKE decision 8). */}
      {legacyDraft && legacyCounts && (
        <section className="sp-validation" aria-label="Legacy workbook">
          <div className="sp-v-top">
            <b className="sp-v-file" title={legacyDraft.workbook}>{legacyDraft.workbook}</b>
            <span className="sp-v-cov">{legacyCounts.rows} rows read</span>
            <span className="sp-v-cov quiet">
              {legacyCounts.inferred} cells inferred · {legacyCounts.unreadable} unreadable
            </span>
            <span className="spacer" />
            <button className="btn" onClick={downloadDraft}>⬇ Download the draft workbook</button>
          </div>
          <p className="sp-v-blocked">
            <b>This is not a Template v2 workbook, so nothing has been checked.</b> Every
            value here had to be read out of a sentence, and a wrong reading would become a
            confident finding about a document that is fine. Download the draft, confirm the
            amber and red cells in Excel, set <b>Check?</b> to Yes on the rows you want
            checked, and upload it again.
          </p>
          {legacyDraft.notes.filter((n) => n.severity !== 'info').length > 0 && (
            <ul className="sp-v-notes">
              {legacyDraft.notes.filter((n) => n.severity !== 'info').slice(0, 40).map((n, i) => (
                <li key={i}>
                  <span className="sp-v-where">{n.sheet ?? 'the file'}{n.cell ? `!${n.cell}` : ''}</span>
                  <span className="sp-v-msg">{n.message}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      {/* The sheet first: Arpit asked for the workbook as a workbook, with
          what is wrong marked on the cells, rather than a list beside it.
          The plain-words list stays underneath because it says something
          the marks cannot — every *accepted* row in a sentence — and
          because a blocking error reads better as prose than as a red
          cell. It is W-48's contract, not a duplicate of this. */}
      {workbookBytes && view === 'workbook' && (
        <SheetView
          bytes={workbookBytes}
          validation={sheetValidation}
          results={sheetResults}
          selected={selectedCell}
          onSelect={onSheetSelect}
        />
      )}

      {/* The plain-words report used to sit under the sheet. Removed
          2026-11-18 (Siddharth) — the sheet's own review panel already
          lists every refusal *on the cell it came from*, which is the
          better version of the same thing, and the counts strip repeated
          the sheet's own footer.

          What it alone carried was the plain-words list — every accepted
          row as a sentence (SR-SPEC-INTAKE decision 14). That is now only
          in the two downloads, *Validation report (HTML)* and
          *(JSON)*; `SpecValidation` is still exported and still built from
          the same result, so putting it back behind a disclosure is a
          render, not a rebuild. */}

      {report && report.pageFindings.length > 0 && view === 'page' && (
        <ul className="sp-findings" aria-label="Page findings">
          {report.pageFindings.map((f, i) => (
            <li key={i} className={f.severity}>
              <span className={`sp-f-tag ${f.severity}`}>
                {f.severity === 'error' ? 'Error' : f.severity === 'warning' ? 'Warning' : 'Note'}
              </span>
              <span>{f.message}</span>
            </li>
          ))}
        </ul>
      )}

      {report && report.pages.length > 1 && view === 'page' && (
        <div className="pagestrip">
          <span className="cap">Pages</span>
          <div className="dots">
            {report.pages.map((p, i) => (
              <button
                key={i}
                className={`pdot ${p.failCount === 0 ? 'same' : 'diff'} ${i === currentPage ? 'current' : ''}`}
                title={`${p.name ? `${p.name} — ` : ''}PDF page ${p.page}${
                  p.occurrence ? ` (occurrence ${p.occurrence})` : ''
                } — ${p.failCount === 0 ? 'all pass' : `${p.failCount} failed`}`}
                onClick={() => setPage(i)}
              >
                {p.page}
              </button>
            ))}
          </div>
        </div>
      )}

      <main className="app-body">
        {legacyDraft ? (
          <div className="empty-state sp-compact">
            <div className="icon">▤</div>
            <h2>A draft, not a check</h2>
            <p>
              The legacy layout is a migration input. Download the draft above, confirm it in
              Excel, and upload the confirmed workbook — that one is checked.
            </p>
            <div className="upload-row stacked">
              <SpecUpload kind="pdf" label="PDF to test" hint="Drop the generated PDF" accept=".pdf,application/pdf"
                name={pdfName} loading={loadingPdf} error={errorPdf} onFile={loadPdfFile} onClear={clearPdf} />
              <SpecUpload kind="spec" label="Spec workbook" hint="Drop an .xlsx or .json" accept=".xlsx,.xlsm,.json,application/json"
                name={specName} loading={loadingWorkbook} error={errorSpec} onFile={loadSpecFile} onClear={clearSpec} />
            </div>
          </div>
        ) : validation && !spec ? (
          <div className="empty-state sp-compact">
            <div className="icon">⚠</div>
            <h2>Nothing to check yet</h2>
            <p>
              The workbook read, but {validation.errors.length === 1 ? 'an error' : 'errors'} above
              {' '}{validation.blocking ? 'stop the run' : 'left no assertion to check'}. Fix
              {' '}{validation.errors.length === 1 ? 'it' : 'them'} in Excel and upload the workbook again.
            </p>
            <div className="upload-row stacked">
              <SpecUpload kind="pdf" label="PDF to test" hint="Drop the generated PDF" accept=".pdf,application/pdf"
                name={pdfName} loading={loadingPdf} error={errorPdf} onFile={loadPdfFile} onClear={clearPdf} />
              <SpecUpload kind="spec" label="Spec workbook" hint="Drop an .xlsx or .json" accept=".xlsx,.xlsm,.json,application/json"
                name={specName} loading={loadingWorkbook} error={errorSpec} onFile={loadSpecFile} onClear={clearSpec} />
            </div>
          </div>
        ) : !pdfDoc || !spec ? (
          <div className="empty-state">
            <div className="icon">📄🆚🧾</div>
            <h2>Test a new page against a spec</h2>
            <p>
              When there's no reference PDF — only a design spec — upload the <strong>generated PDF</strong> and the
              <strong> spec workbook</strong> that describes the expected content and layout (static text, images,
              tables, paragraph spacing) with positions in inches. The workbook's Pages List says which
              sheet describes which page, and the checker verifies one against the other.
            </p>

            <div className="upload-row stacked">
              <SpecUpload kind="pdf" label="PDF to test" hint="Drop the generated PDF" accept=".pdf,application/pdf"
            name={pdfName} loading={loadingPdf} error={errorPdf} onFile={loadPdfFile} onClear={clearPdf} />
          <SpecUpload kind="spec" label="Spec workbook" hint="Drop an .xlsx or .json" accept=".xlsx,.xlsm,.json,application/json"
            name={specName} loading={loadingWorkbook} error={errorSpec} onFile={loadSpecFile} onClear={clearSpec} />
            </div>

            <p className="empty-aside">
              <button className="btn quiet" onClick={loadExample} disabled={loadingExample}>
                {loadingExample ? (<><span className="spinner" /> Loading…</>) : 'or load an example workbook + PDF'}
              </button>
            </p>
          </div>
        ) : running && !report ? (
          <div className="loading-center"><span className="spinner" /> Checking the PDF against the spec…</div>
        ) : view === 'workbook' ? null : page ? (
          <div className={`spec-grid ${railOpen ? '' : 'rail-closed'}`}>
            {/* The page itself, centre stage — the same shape as Compare:
                a grey stage, the rendered page on it, and what the spec
                asked for drawn straight on the page. A failing element is
                a red box where the thing is and a dashed indigo box where
                the spec said it should be, so the gap between them is the
                finding, visible without reading a row. */}
            <div className="card spec-stage-card">
              <div className="layout-controls">
                <div className="overlay-legend">
                  <span><i className="dot exp" /> Expected (spec)</span>
                  <span><i className="dot act-pass" /> Actual · pass</span>
                  <span><i className="dot act-fail" /> Actual · fail</span>
                </div>
                <div className="spacer" />
                <span className="legend-hint">Hover a result to locate it.</span>
                {/* Compare's own button, class for class — `.view-changes`
                    and `.drawer-ico` ship in `@pdfsuite/ui`'s stylesheet,
                    which this tab already draws `.btn` and `.tabs` from.
                    A lookalike would be a second definition of one thing,
                    and the two would drift the first time either moved. */}
                <button
                  className={`btn sm view-changes ${railOpen ? 'on' : ''}`}
                  onClick={() => setRailOpen(!railOpen)}
                  aria-expanded={railOpen}
                  title={railOpen ? 'Hide the results and give the page the width'
                    : 'Show the results for this page'}
                >
                  <i className="drawer-ico" aria-hidden="true">
                    <span />
                  </i>
                  View results{page ? ` · ${page.elements.length}` : ''}
                </button>
                <div className="zoom-group" title="Zoom the page">
                  <button className="zoombtn" onClick={() => setZoom((z) => Math.max(0.4, z / 1.25))} title="Zoom out">−</button>
                  <span className="zoom-label">{Math.round(zoom * 100)}%</span>
                  <button className="zoombtn" onClick={() => setZoom((z) => Math.min(4, z * 1.25))} title="Zoom in">+</button>
                  <button className="btn sm" onClick={() => setZoom(1)} title="Fit to view">Fit</button>
                </div>
              </div>
              {page.dataUrl ? (
                <div className="stage spec-stage">
                  <div className="stage-content">
                    <div
                      className={`spec-pagewrap ${hovered ? 'hovering' : ''}`}
                      style={{ width: `${zoom * 100}%` }}
                    >
                      <img src={page.dataUrl} alt={`Page ${page.page}`} />
                      {page.elements.map((e) => (
                        <div key={e.id} className="spec-ov-pair">
                          {e.expectedBox && <OverlayBox box={e.expectedBox} page={page} kind="expected" status={e.status} active={hovered === e.id} />}
                          {e.actualBox && <OverlayBox box={e.actualBox} page={page} kind="actual" status={e.status} active={hovered === e.id} />}
                          {/* The hit area. The boxes themselves stay
                              `pointer-events: none` — a 1.5px border is not
                              something anyone can reliably hover, and the
                              dashed expected box often sits under the
                              actual one. This is the element's own footprint
                              and it points the other way: page → rail. */}
                          {(e.actualBox ?? e.expectedBox) && (
                            <div
                              className="spec-ov-hit"
                              style={boxStyle(e.actualBox ?? e.expectedBox!, page)}
                              onMouseEnter={() => hoverFromPage(e.id)}
                              onMouseLeave={() => hoverFromPage(null)}
                              onClick={() => showCellFor(e.id)}
                              title={`${e.label} — ${STATUS_LABEL[e.status]}`}
                            />
                          )}
                        </div>
                      ))}
                      {hovered && page.elements.some((e) => e.id === hovered) && (
                        <HoverCard el={page.elements.find((e) => e.id === hovered)!} page={page} />
                      )}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="page-missing">Page {page.page} is not present in the PDF.</div>
              )}
            </div>

            {/* The results, as a rail of their own: it scrolls without
                moving the page, and it closes. */}
            {/* Always mounted. Unmounting it made closing a disappearance
                rather than a movement — there is nothing left to animate
                once the node is gone, so the page simply jumped. */}
            <div className={`spec-results ${railOpen ? '' : 'closed'}`} aria-hidden={!railOpen}>
              {/* The summary card is gone (Siddharth, 2026-11-18: *this info
                  is not useful*). Everything on it was said better somewhere
                  else — the page by `‹ Page n of m ›` in the header, pass and
                  fail by the strip's colour and by each card's own badge, the
                  refusals by the count on the **Workbook** tab. What is kept
                  is the part that is *not* said twice: when a page was not
                  found where the Pages List puts it, which changes what you
                  are looking at. */}
              {(page.occurrence
                || page.binding === 'out-of-order'
                || (!page.binding && page.specPage !== page.page)) && (
                <p className="spec-binding-note">
                  {page.occurrence && <span>occurrence {page.occurrence}</span>}
                  {page.binding === 'out-of-order' && (
                    <span title="Found by its identifying text, not where the Pages List puts it">
                      out of order — the Pages List puts this at page {page.specPage}
                    </span>
                  )}
                  {!page.binding && page.specPage !== page.page && (
                    <span title="This spec page was pointed at a different PDF page">
                      spec page {page.specPage} → PDF page {page.page}
                    </span>
                  )}
                </p>
              )}
              {report.pair && (
                <p className="sp-pair-line">
                  {report.pair.workbook && <>Workbook <b>{report.pair.workbook}</b>
                    {report.pair.workbookSha256 && <> · <code>{report.pair.workbookSha256.slice(0, 12)}…</code></>}
                    {report.pair.templateVersion && <> · template v{report.pair.templateVersion}</>}</>}
                  {report.pair.pdfName && <><br />PDF <b>{report.pair.pdfName}</b>
                    {report.pair.pdfSha256 && <> · <code>{report.pair.pdfSha256.slice(0, 12)}…</code></>}</>}
                </p>
              )}
              {page.elements.map((e) => (
                <div
                  key={e.id}
                  ref={(node) => {
                    if (node) cardRefs.current.set(e.id, node);
                    else cardRefs.current.delete(e.id);
                  }}
                  className={`spec-el card ${e.status} ${hovered === e.id ? 'hot' : ''}`}
                  onMouseEnter={() => setHovered(e.id)}
                  onMouseLeave={() => setHovered(null)}
                >
                  <div className="spec-el-head">
                    <span className="spec-el-ic">{TYPE_ICON[e.type]}</span>
                    <div className="spec-el-title">
                      <b>{e.label}</b>
                      <small>{e.detail}</small>
                    </div>
                    {/* The cell, as a button rather than a clickable card:
                        a card that reacts to a click is an affordance only a
                        mouse user finds, and a keyboard user never reaches.
                        This is also the thing somebody actually wants — the
                        row to go and change. */}
                    {cellOfElement.has(e.id) && (
                      <button
                        type="button"
                        className="sp-el-cell"
                        onClick={() => showCellFor(e.id)}
                        title="Show this row in the workbook"
                      >
                        {cellOfElement.get(e.id)!.sheet}!{cellOfElement.get(e.id)!.range}
                      </button>
                    )}
                    <span className={`spec-badge ${e.status}`}>
                      {STATUS_LABEL[e.status]}
                    </span>
                  </div>
                  {/* Four columns, named. It was six unnamed ones, with
                      what the spec asked for and what the PDF has sitting
                      third and fourth in the same weight as everything
                      else, and a tick at the end saying what the colour
                      already said. Decision 12: a finding nobody can trace
                      to a cell is a finding nobody can act on — so the cell
                      is a button that opens the workbook there. */}
                  <table className="spec-checks">
                    <thead>
                      <tr>
                        <th className="cn" />
                        <th className="ce">Spec</th>
                        <th className="ca">PDF</th>
                        <th className="cd">Difference</th>
                        <th className="cc">Cell</th>
                      </tr>
                    </thead>
                    <tbody>
                      {e.checks.map((c, i) => (
                        <tr key={i} className={c.pass ? 'ok' : 'no'}>
                          <td className="cn">
                            <span className="ck" aria-hidden="true">{c.pass ? '✓' : '✗'}</span>
                            {c.name}
                          </td>
                          <td className="ce">{c.expected}</td>
                          <td className="ca">{c.actual}</td>
                          <td className="cd">
                            {c.delta ?? (c.pass ? '' : '—')}
                            {c.note && <span className="check-note">{c.note}</span>}
                          </td>
                          <td className="cc">
                            {c.cell && (
                              <button
                                type="button"
                                className="cc-link"
                                onClick={() => goToRef(c.cell!)}
                                title={`Open ${c.cell} in the workbook`}
                              >
                                {c.cell}
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="loading-center">Preparing…</div>
        )}
      </main>
    </>
  );
}
