import { useCompareStore, useTotalPages } from '../../store/compareStore';
import { pageHasChange, summaryPageDiffers } from '../../services/changes';

type Status = 'diff' | 'same' | 'missing' | 'unknown';

export default function PageStrip() {
  const total = useTotalPages();
  const currentPage = useCompareStore((s) => s.currentPage);
  const setCurrentPage = useCompareStore((s) => s.setCurrentPage);
  const summary = useCompareStore((s) => s.summary);
  const pageCache = useCompareStore((s) => s.pageCache);
  const movedThreshold = useCompareStore((s) => s.offsetThresholdPx);

  if (total <= 1) return null;

  const statusOf = (i: number): Status => {
    if (summary && summary.pages[i]) {
      const p = summary.pages[i];
      return p.missing ? 'missing' : summaryPageDiffers(p) ? 'diff' : 'same';
    }
    const pc = pageCache[i];
    if (pc) {
      if (!pc.imageA || !pc.imageB) return 'missing';
      return pageHasChange(pc, movedThreshold) ? 'diff' : 'same';
    }
    return 'unknown';
  };

  const showNumbers = total <= 40;
  const labels: Record<Status, string> = {
    diff: 'differs',
    same: 'identical',
    missing: 'missing on one side',
    unknown: 'not scanned yet',
  };

  return (
    <div className="pagestrip">
      <span className="cap">Pages</span>
      <div className="dots">
        {Array.from({ length: total }, (_, i) => {
          const st = statusOf(i);
          return (
            <button
              key={i}
              className={`pdot ${st} ${i === currentPage ? 'current' : ''}`}
              title={`Page ${i + 1} — ${labels[st]}`}
              onClick={() => setCurrentPage(i)}
            >
              {showNumbers ? i + 1 : ''}
            </button>
          );
        })}
      </div>
    </div>
  );
}
