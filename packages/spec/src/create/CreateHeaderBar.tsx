import { useCreateStore } from './createStore';

/**
 * The Create spec tab's controls, in the app header beside Export — the
 * same place Compare's slots and Specification's live (W-53).
 */
export default function CreateHeaderBar() {
  const doc = useCreateStore((s) => s.doc);
  const view = useCreateStore((s) => s.view);
  const setView = useCreateStore((s) => s.setView);
  const building = useCreateStore((s) => s.building);
  const downloadWorkbook = useCreateStore((s) => s.downloadWorkbook);
  const downloadMockup = useCreateStore((s) => s.downloadMockup);
  const patchDoc = useCreateStore((s) => s.patchDoc);

  const elements = doc.pages.reduce((n, p) => n + p.elements.length, 0);

  return (
    <div className="spec-headerbar">
      <label className="cs-title">
        <input
          value={doc.name}
          onChange={(e) => patchDoc({ name: e.target.value })}
          aria-label="Spec name"
        />
      </label>

      <div className="tabs" role="group" aria-label="What to show">
        <button
          className={`tab ${view === 'canvas' ? 'active' : ''}`}
          onClick={() => setView('canvas')}
          title="Draw the page"
        >
          Canvas
        </button>
        <button
          className={`tab ${view === 'workbook' ? 'active' : ''}`}
          onClick={() => setView('workbook')}
          title="The workbook written from the canvas — read-only"
        >
          Workbook
        </button>
      </div>

      <div className="spacer" />
      {building && <span className="summary-chip scanning"><span className="spinner" style={{ width: 12, height: 12 }} /> writing</span>}
      <button className="btn sm" onClick={() => void downloadWorkbook()} disabled={elements === 0}>
        ⬇ Workbook (.xlsx)
      </button>
      <button className="btn sm" onClick={downloadMockup} disabled={elements === 0}
        title="The only file that reopens in the canvas">
        ⬇ Mockup (.json)
      </button>
    </div>
  );
}
