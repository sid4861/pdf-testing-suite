import { useCompareStore, useTotalPages } from '../../store/compareStore';

export default function PageNavigator() {
  const total = useTotalPages();
  const currentPage = useCompareStore((s) => s.currentPage);
  const setCurrentPage = useCompareStore((s) => s.setCurrentPage);
  const countA = useCompareStore((s) => s.sideA?.pageCount ?? 0);
  const countB = useCompareStore((s) => s.sideB?.pageCount ?? 0);
  const jumpToChange = useCompareStore((s) => s.jumpToChange);
  const jumpScanning = useCompareStore((s) => s.jumpScanning);

  if (total === 0) return null;

  const mismatch = countA > 0 && countB > 0 && countA !== countB;
  const multiPage = total > 1;

  return (
    <div className="pagenav">
      {multiPage && (
        <button
          className="btn sm jumpbtn"
          disabled={currentPage <= 0 || jumpScanning}
          onClick={() => jumpToChange(-1)}
          title="Jump to previous page with a change"
        >
          {jumpScanning ? <span className="spinner" /> : '⤺'} prev change
        </button>
      )}

      <button
        className="navbtn"
        disabled={currentPage <= 0}
        onClick={() => setCurrentPage(currentPage - 1)}
        title="Previous page"
      >
        ‹
      </button>
      <span className="label">
        Page {currentPage + 1} of {total}
      </span>
      <button
        className="navbtn"
        disabled={currentPage >= total - 1}
        onClick={() => setCurrentPage(currentPage + 1)}
        title="Next page"
      >
        ›
      </button>

      {multiPage && (
        <button
          className="btn sm jumpbtn"
          disabled={currentPage >= total - 1 || jumpScanning}
          onClick={() => jumpToChange(1)}
          title="Jump to next page with a change"
        >
          next change {jumpScanning ? <span className="spinner" /> : '⤻'}
        </button>
      )}

      {mismatch && (
        <span
          className="mismatch-badge"
          title={`Side A has ${countA} pages, Side B has ${countB}. Extra pages exist only on one side.`}
        >
          ⚠ {countA} vs {countB}
        </span>
      )}
    </div>
  );
}
