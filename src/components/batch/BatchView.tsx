import { useEffect, useMemo, useRef, useState } from 'react';
import { useBatchStore, type BatchFile, type BatchPair } from '../../store/batchStore';
import { useCompareStore } from '../../store/compareStore';
import {
  pairVerdict,
  worst,
  exportBatchHtml,
  exportBatchJson,
  exportBatchCsv,
  exportBatchMarkdown,
  type BatchPairExport,
} from '../../services/batchExport';

// ── multi-file upload column ──────────────────────────────────────────
function MultiUpload({ side }: { side: 'A' | 'B' }) {
  const files = useBatchStore((s) => (side === 'A' ? s.filesA : s.filesB));
  const loading = useBatchStore((s) => (side === 'A' ? s.loadingA : s.loadingB));
  const addFiles = useBatchStore((s) => s.addFiles);
  const removeFile = useBatchStore((s) => s.removeFile);
  const input = useRef<HTMLInputElement>(null);
  const [drag, setDrag] = useState(false);
  return (
    <div className="batch-col">
      <div className="batch-col-head">
        <span className={`stag ${side === 'A' ? 'a' : 'b'}`}>{side}</span>
        Side {side} files
        <span className="cnt">{files.length}</span>
      </div>
      <div
        className={`batch-drop ${side === 'A' ? 'a' : 'b'} ${drag ? 'drag' : ''}`}
        onClick={() => input.current?.click()}
        onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
        onDragLeave={() => setDrag(false)}
        onDrop={(e) => { e.preventDefault(); setDrag(false); addFiles(side, [...e.dataTransfer.files]); }}
      >
        {loading ? (<><span className="spinner" /> Reading…</>) : (<>Drop PDFs here or <span className="browse">browse</span></>)}
        <input ref={input} type="file" accept=".pdf,application/pdf" multiple hidden
          onChange={(e) => { if (e.target.files) addFiles(side, [...e.target.files]); e.target.value = ''; }} />
      </div>
      {files.length > 0 && (
        <ul className="batch-filelist">
          {files.map((f) => (
            <li key={f.id}>
              <span className="fn" title={f.name}>{f.name}</span>
              <span className="pc">{f.pageCount}p</span>
              <button className="clear-btn" onClick={() => removeFile(side, f.id)}>×</button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// ── one pairing row ───────────────────────────────────────────────────
function PairRow({ pair, idx }: { pair: BatchPair; idx: number }) {
  const filesA = useBatchStore((s) => s.filesA);
  const filesB = useBatchStore((s) => s.filesB);
  const setPairSide = useBatchStore((s) => s.setPairSide);
  const removePair = useBatchStore((s) => s.removePair);
  return (
    <div className="pair-row">
      <span className="pr-idx">{idx + 1}</span>
      <select className="pr-sel a" value={pair.aId ?? ''} onChange={(e) => setPairSide(pair.id, 'A', e.target.value || null)}>
        <option value="">— choose Side A —</option>
        {filesA.map((f) => (<option key={f.id} value={f.id}>{f.name}</option>))}
      </select>
      <span className="pr-arrow">→</span>
      <select className="pr-sel b" value={pair.bId ?? ''} onChange={(e) => setPairSide(pair.id, 'B', e.target.value || null)}>
        <option value="">— choose Side B —</option>
        {filesB.map((f) => (<option key={f.id} value={f.id}>{f.name}</option>))}
      </select>
      <span className="spacer" />
      <button className="clear-btn" title="Remove pair" onClick={() => removePair(pair.id)}>×</button>
    </div>
  );
}

export default function BatchView({ onOpenCompare }: { onOpenCompare: () => void }) {
  const filesA = useBatchStore((s) => s.filesA);
  const filesB = useBatchStore((s) => s.filesB);
  const pairs = useBatchStore((s) => s.pairs);
  const results = useBatchStore((s) => s.results);
  const running = useBatchStore((s) => s.running);
  const progress = useBatchStore((s) => s.progress);
  const thresholds = useBatchStore((s) => s.thresholds);
  const setThreshold = useBatchStore((s) => s.setThreshold);
  const addPair = useBatchStore((s) => s.addPair);
  const autoPairByOrder = useBatchStore((s) => s.autoPairByOrder);
  const run = useBatchStore((s) => s.run);
  const clearAll = useBatchStore((s) => s.clearAll);
  const loadExample = useBatchStore((s) => s.loadExample);
  const loadingExample = useBatchStore((s) => s.loadingExample);
  const error = useBatchStore((s) => s.error);
  const adoptPair = useCompareStore((s) => s.adoptPair);

  const [menuOpen, setMenuOpen] = useState(false);
  const [exporting, setExporting] = useState<string | null>(null);
  const [exportProgress, setExportProgress] = useState<{ done: number; total: number } | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const onClick = (e: MouseEvent) => { if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false); };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  const fileById = (side: 'A' | 'B', id: string | null) => (id ? (side === 'A' ? filesA : filesB).find((f) => f.id === id) ?? null : null);
  const validPairs = pairs.filter((p) => p.aId && p.bId);
  const hasFiles = filesA.length > 0 || filesB.length > 0;

  // Export payload from pairs that have results.
  const exportPairs: BatchPairExport[] = useMemo(() => {
    let idx = 0;
    const out: BatchPairExport[] = [];
    for (const p of pairs) {
      const r = results[p.id];
      if (!p.aId || !p.bId || !r) continue;
      idx++;
      out.push({
        index: idx,
        aName: fileById('A', p.aId)?.name ?? 'A',
        bName: fileById('B', p.bId)?.name ?? 'B',
        summary: r.summary,
        pageCache: r.pageCache,
      });
    }
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pairs, results, filesA, filesB]);

  const openInCompare = (a: BatchFile, b: BatchFile) => {
    adoptPair({ name: a.name, doc: a.doc, pageCount: a.pageCount }, { name: b.name, doc: b.doc, pageCount: b.pageCount });
    onOpenCompare();
  };

  return (
    <>
      <div className="subtoolbar spec-toolbar" style={{ flexWrap: 'wrap' }}>
        <button className="btn primary" onClick={run} disabled={running || validPairs.length === 0}>
          {running ? (
            <><span className="spinner" style={{ borderTopColor: '#fff', borderColor: 'rgba(255,255,255,0.4)' }} />
              {progress ? `Pair ${progress.pairIndex + 1}/${progress.pairTotal} · page ${progress.page}/${progress.pageTotal}` : 'Running…'}</>
          ) : (
            `Run ${validPairs.length || ''} comparison${validPairs.length === 1 ? '' : 's'}`.trim()
          )}
        </button>
        <div className="thresh-group">
          <span style={{ fontSize: 13, color: 'var(--muted)' }}>PASS if</span>
          <label className="thresh">content ≥ <input type="number" value={thresholds.contentPct} onChange={(e) => setThreshold('contentPct', Number(e.target.value))} />%</label>
          <label className="thresh">pixels ≤ <input type="number" value={thresholds.pixelPct} onChange={(e) => setThreshold('pixelPct', Number(e.target.value))} />%</label>
          <label className="thresh">offset ≤ <input type="number" step={0.01} value={thresholds.offsetIn} onChange={(e) => setThreshold('offsetIn', Number(e.target.value))} />in</label>
        </div>
        <div className="spacer" />
        {hasFiles && <button className="btn sm" onClick={clearAll}>Clear all</button>}
        <div className="export-menu" ref={menuRef}>
          <button className="btn" disabled={exportPairs.length === 0 || !!exporting} onClick={() => setMenuOpen((o) => !o)}>
            {exporting ? (
              <><span className="spinner" style={{ width: 12, height: 12 }} />
                {exporting === 'html' && exportProgress ? `Building ${exportProgress.done}/${exportProgress.total}…` : 'Exporting…'}</>
            ) : (
              '⬇ Export ▾'
            )}
          </button>
          {menuOpen && exportPairs.length > 0 && !exporting && (
            <div className="export-dropdown">
              <button onClick={async () => {
                setMenuOpen(false);
                setExporting('html');
                setExportProgress({ done: 0, total: exportPairs.length });
                try {
                  await exportBatchHtml(exportPairs, thresholds, (done, total) => setExportProgress({ done, total }));
                } finally {
                  setExporting(null);
                  setExportProgress(null);
                }
              }}>HTML report<small>Overview + every pair's annotated pages</small></button>
              <button onClick={() => { exportBatchMarkdown(exportPairs, thresholds); setMenuOpen(false); }}>Markdown fix-list<small>What to change in the templates · for an AI agent</small></button>
        <button onClick={() => { exportBatchJson(exportPairs, thresholds); setMenuOpen(false); }}>JSON<small>All pairs &amp; pages, machine-readable</small></button>
              <button onClick={() => { exportBatchCsv(exportPairs, thresholds); setMenuOpen(false); }}>CSV<small>One row per pair × page</small></button>
            </div>
          )}
        </div>
      </div>

      <main className="app-body">
        {!hasFiles ? (
          <div className="empty-state">
            <div className="icon">🗂️🆚🗂️</div>
            <h2>Compare many PDFs at once</h2>
            <p>
              Add several PDFs to <strong>Side A</strong> and <strong>Side B</strong>, choose which A file pairs with which
              B file, then run every comparison in one go. Export a combined report of all the differences.
            </p>
            <p style={{ marginTop: 20 }}>
              <button className="btn primary" onClick={loadExample} disabled={loadingExample}>
                {loadingExample ? (<><span className="spinner" style={{ borderTopColor: '#fff', borderColor: 'rgba(255,255,255,0.4)' }} /> Loading…</>) : 'Load example set'}
              </button>
            </p>
            {error && <p className="slot-error">⚠ {error}</p>}
          </div>
        ) : (
          <div className="stack-col">
            {/* uploads */}
            <div className="card section-pad">
              <div className="batch-uploads">
                <MultiUpload side="A" />
                <MultiUpload side="B" />
              </div>
            </div>

            {/* pairing */}
            <div className="card section-pad">
              <div className="bp-head">
                <b>Pairs to compare</b>
                <span className="spacer" />
                <button className="btn sm" onClick={addPair}>＋ Add pair</button>
                <button className="btn sm" onClick={autoPairByOrder} disabled={!filesA.length || !filesB.length}>Auto-pair by order</button>
              </div>
              {pairs.length === 0 ? (
                <div className="muted-empty" style={{ marginTop: 10 }}>No pairs yet — add a pair, or use “Auto-pair by order”.</div>
              ) : (
                <div className="pair-list">
                  {pairs.map((p, idx) => (<PairRow key={p.id} pair={p} idx={idx} />))}
                </div>
              )}
            </div>

            {/* overview */}
            {validPairs.some((p) => results[p.id]) && (
              <div className="card" style={{ overflow: 'hidden' }}>
                <div className="section-pad" style={{ paddingBottom: 8, fontWeight: 600 }}>Results</div>
                <table className="report batch-overview">
                  <thead>
                    <tr><th>#</th><th>Side A</th><th>Side B</th><th>Pages</th><th>Differing</th><th>Worst content</th><th>Worst pixels</th><th>Worst offset</th><th>Result</th><th></th></tr>
                  </thead>
                  <tbody>
                    {validPairs.map((p, idx) => {
                      const a = fileById('A', p.aId)!;
                      const b = fileById('B', p.bId)!;
                      const r = results[p.id];
                      if (!r) {
                        return (
                          <tr key={p.id}><td>{idx + 1}</td><td>{a.name}</td><td>{b.name}</td>
                            <td colSpan={6} className="muted">not run yet</td></tr>
                        );
                      }
                      const pass = pairVerdict(r.summary, thresholds);
                      const w = worst(r.summary);
                      return (
                        <tr key={p.id}>
                          <td>{idx + 1}</td>
                          <td title={a.name}>{a.name}</td>
                          <td title={b.name}>{b.name}</td>
                          <td>{r.summary.pages.length}</td>
                          <td>{w.differing}</td>
                          <td>{w.worstContent == null ? '—' : `${(w.worstContent * 100).toFixed(1)}%`}</td>
                          <td>{w.worstPixels == null ? '—' : `${(w.worstPixels * 100).toFixed(1)}%`}</td>
                          <td>{w.worstOffsetIn == null ? '—' : `${w.worstOffsetIn.toFixed(2)}″`}</td>
                          <td className={pass ? 'res-pass' : 'res-fail'}>{pass ? '✓ PASS' : '✗ FAIL'}</td>
                          <td><button className="btn sm" onClick={() => openInCompare(a, b)}>Open ↗</button></td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </main>
    </>
  );
}
