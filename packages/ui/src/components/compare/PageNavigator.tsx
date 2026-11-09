import { useState } from 'react';
import { useCompareStore, useTotalPages } from '../../store/compareStore';
import PagePairing, { PagePairingButton } from './PagePairing';

export default function PageNavigator() {
  const total = useTotalPages();
  const currentPage = useCompareStore((s) => s.currentPage);
  const setCurrentPage = useCompareStore((s) => s.setCurrentPage);
  const countA = useCompareStore((s) => s.sideA?.pageCount ?? 0);
  const countB = useCompareStore((s) => s.sideB?.pageCount ?? 0);
  const jumpToChange = useCompareStore((s) => s.jumpToChange);
  const jumpScanning = useCompareStore((s) => s.jumpScanning);
  const pairs = useCompareStore((s) => s.pairs);
  const [pairingOpen, setPairingOpen] = useState(false);

  if (total === 0) return null;

  // With a pairing in force, "page 4 of 9" is not the whole truth: what matters
  // is which golden page is being read against which tested page.
  const pair = pairs[currentPage];
  const paired = pair && (pair.a !== currentPage || pair.b !== currentPage);
  const pageLabel = (n: number | null) => (n == null ? '\u2014' : String(n + 1));

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
        {paired ? (
          <>
            <span className="pg-side gold" title="Golden PDF page">{pageLabel(pair.a)}</span>
            <span className="pg-arrow">↔</span>
            <span className="pg-side test" title="Page in the PDF to test">{pageLabel(pair.b)}</span>
            <span className="pg-of">pair {currentPage + 1} of {total}</span>
          </>
        ) : (
          <>Page {currentPage + 1} of {total}</>
        )}
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
          title={`The golden PDF has ${countA} pages, the PDF under test has ${countB}. Extra pages exist in only one of them.`}
        >
          ⚠ {countA} vs {countB}
        </span>
      )}

      <PagePairingButton onOpen={() => setPairingOpen(true)} />
      {pairingOpen && <PagePairing onClose={() => setPairingOpen(false)} />}
    </div>
  );
}
