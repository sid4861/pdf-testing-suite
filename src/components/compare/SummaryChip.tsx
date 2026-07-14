import { useCompareStore } from '../../store/compareStore';
import { summaryPageDiffers } from '../../services/changes';

export default function SummaryChip() {
  const summary = useCompareStore((s) => s.summary);
  const computingSummary = useCompareStore((s) => s.computingSummary);
  const progress = useCompareStore((s) => s.summaryProgress);
  const computeAll = useCompareStore((s) => s.computeAll);
  const setCurrentPage = useCompareStore((s) => s.setCurrentPage);
  const setMode = useCompareStore((s) => s.setMode);

  if (computingSummary) {
    return (
      <span className="summary-chip scanning" title="Scanning every page">
        <span className="spinner" style={{ width: 12, height: 12 }} />
        Scanning {progress ? `${progress.current}/${progress.total}` : '…'}
      </span>
    );
  }

  if (!summary) {
    return (
      <button className="summary-chip action" onClick={() => computeAll()} title="Check which pages differ">
        Scan all pages
      </button>
    );
  }

  const total = summary.pages.length;
  const diffCount = summary.pages.filter((p) => summaryPageDiffers(p)).length;

  if (diffCount === 0) {
    return (
      <span className="summary-chip pass" title="Every page matches">
        ✓ All {total} pages match
      </span>
    );
  }

  const firstDiff = summary.pages.findIndex((p) => summaryPageDiffers(p));

  return (
    <button
      className="summary-chip warn"
      title="Go to the first page that differs"
      onClick={() => {
        if (firstDiff >= 0) setCurrentPage(firstDiff);
        setMode('content');
      }}
    >
      ● {diffCount} of {total} pages differ
    </button>
  );
}
