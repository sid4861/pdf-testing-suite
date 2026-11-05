import { useState } from 'react';

import type { ValidationReport } from './specValidate';
import { coverageLine } from './specValidate';
import type { IntakeNote } from './specIntake';

/**
 * The validation report, in the tab, before any PDF is opened —
 * SR-SPEC-INTAKE decisions 13 and 14.
 *
 * Three severities, each line carrying the sheet and cell it is about, and —
 * behind a disclosure, because there are hundreds of them — every accepted
 * assertion in plain words. The order is deliberate: what stopped the run,
 * then what was refused, then what was accepted with less confidence, then
 * what was understood. A person reading top to bottom learns the worst news
 * first.
 */

const WORD: Record<IntakeNote['severity'], string> = {
  error: 'Error',
  warning: 'Warning',
  info: 'Note',
};

function Where({ note }: { note: IntakeNote }) {
  if (!note.sheet) return <span className="sp-v-where">the file</span>;
  return (
    <span className="sp-v-where">
      {note.sheet}{note.cell ? `!${note.cell}` : ''}
    </span>
  );
}

function NoteList({
  notes,
  severity,
  label,
}: {
  notes: IntakeNote[];
  severity: IntakeNote['severity'];
  label: string;
}) {
  // Long lists are collapsed, but never the errors: an error is the reason the
  // person is on this screen.
  const [open, setOpen] = useState(severity === 'error');
  if (notes.length === 0) return null;

  return (
    <div className={`sp-v-group ${severity}`}>
      <button className="sp-v-head" onClick={() => setOpen(!open)} aria-expanded={open}>
        <span className="sp-v-chev" aria-hidden="true">{open ? '▾' : '▸'}</span>
        <span className={`sp-v-badge ${severity}`}>{notes.length}</span>
        <span className="sp-v-label">{label}</span>
      </button>
      {open && (
        <ul className="sp-v-notes">
          {notes.map((n, i) => (
            <li key={i}>
              <Where note={n} />
              <span className="sp-v-msg">{n.message}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default function SpecValidation({ report }: { report: ValidationReport }) {
  const [showSpec, setShowSpec] = useState(false);
  const [showRest, setShowRest] = useState(false);
  const { counts } = report;
  const unchecked = counts.rows - counts.checked;
  // Decision 13's third severity goes to coverage, so the rows with no check
  // are listed from there — a count alone cannot be acted on.
  const rest = report.coverage.filter((c) => c.status !== 'checked');

  return (
    <section className="sp-validation" aria-label="Validation report">
      <div className="sp-v-top">
        <b className="sp-v-file" title={report.workbook}>{report.workbook}</b>
        <span className="sp-v-cov">{coverageLine(counts)}</span>
        {unchecked > 0 && (
          <span className="sp-v-cov quiet">
            {counts.excluded > 0 && `${counts.excluded} excluded`}
            {counts.excluded > 0 && counts.noted > 0 && ' · '}
            {counts.noted > 0 && `${counts.noted} noted`}
            {(counts.excluded > 0 || counts.noted > 0) && counts.unreadable > 0 && ' · '}
            {counts.unreadable > 0 && `${counts.unreadable} unreadable`}
          </span>
        )}
        <span className="spacer" />
        {report.templateVersion && (
          <span className="sp-v-cov quiet">template v{report.templateVersion}</span>
        )}
      </div>

      {report.blocking && (
        <p className="sp-v-blocked">
          <b>This workbook cannot be checked.</b> {report.blockedBecause} Fix it in Excel and
          upload it again — nothing is checked against a PDF until it reads.
        </p>
      )}

      <NoteList notes={report.errors} severity="error"
        label="refused — these rows yield no check" />
      <NoteList notes={report.warnings} severity="warning"
        label="checked, with lower confidence" />
      <NoteList notes={report.info} severity="info" label="notes" />

      {rest.length > 0 && (
        <div className="sp-v-group info">
          <button className="sp-v-head" onClick={() => setShowRest(!showRest)} aria-expanded={showRest}>
            <span className="sp-v-chev" aria-hidden="true">{showRest ? '▾' : '▸'}</span>
            <span className="sp-v-badge info">{rest.length}</span>
            <span className="sp-v-label">rows with no check, and why</span>
          </button>
          {showRest && (
            <table className="sp-v-table">
              <thead>
                <tr><th>Cell</th><th>Element</th><th>Parameter</th><th>Why</th></tr>
              </thead>
              <tbody>
                {rest.map((c, i) => (
                  <tr key={i}>
                    <td className="sp-v-where">{c.sheet}!{c.row}</td>
                    <td>{c.element}</td>
                    <td>{c.parameter}</td>
                    <td>{c.reason}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {report.assertions.length > 0 && (
        <div className="sp-v-group understood">
          <button className="sp-v-head" onClick={() => setShowSpec(!showSpec)} aria-expanded={showSpec}>
            <span className="sp-v-chev" aria-hidden="true">{showSpec ? '▾' : '▸'}</span>
            <span className="sp-v-badge understood">{report.assertions.length}</span>
            <span className="sp-v-label">what the checker understood, in words</span>
          </button>
          {showSpec && (
            <table className="sp-v-table">
              <thead>
                <tr><th>Page</th><th>Element</th><th>Assertion</th><th>Cell</th></tr>
              </thead>
              <tbody>
                {report.assertions.map((a, i) => (
                  <tr key={i}>
                    <td className="num">{a.page}</td>
                    <td>{a.element}</td>
                    <td>{a.sentence}</td>
                    <td className="sp-v-where">
                      {a.sheet}{a.cell ? `!${a.cell}` : ''}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </section>
  );
}
