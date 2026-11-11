import { formatDay } from '../dates.js';

// Impact points per week for the last 8 weeks, oldest to newest. Click a bar to open that week.
export default function ImpactChart({ weeks, activeStart, onOpen }) {
  const data = [...weeks].reverse();
  const max = Math.max(4, ...data.map((w) => w.impact));
  return (
    <section className="card" aria-label="Impact by week">
      <h2 className="text-lg font-semibold">Impact by week</h2>
      <p className="text-xs muted">Points from answers, last 8 weeks. Tap a bar to open that week.</p>
      <div className="relative mt-4 flex h-40 items-end gap-2">
        {data.map((w) => {
          const active = w.weekStart === activeStart;
          const h = Math.max(4, (w.impact / max) * 100);
          return (
            <button
              key={w.weekStart}
              onClick={() => onOpen(w.weekStart)}
              className="group flex h-full flex-1 flex-col items-center justify-end gap-1"
              aria-label={`Week of ${formatDay(w.weekStart, { day: 'numeric', month: 'short' })}: ${w.impact} points`}
            >
              <span className="font-mono text-[10px] muted">{w.impact}</span>
              <span
                style={{ height: `${h}%` }}
                className={`w-full rounded-t-md transition ${active ? 'bg-steel-600 dark:bg-steel-400' : 'bg-steel-200 group-hover:bg-steel-300 dark:bg-ink-700 dark:group-hover:bg-ink-600'}`}
              />
            </button>
          );
        })}
      </div>
      {data.every((w) => w.impact === 0) && (
        <p className="mt-2 text-center text-xs muted">No answers yet. Bars appear as people say whether your work helped.</p>
      )}
      <div className="mt-1 flex gap-2">
        {data.map((w) => (
          <span key={w.weekStart} className="flex-1 text-center font-mono text-[10px] muted">
            {formatDay(w.weekStart, { day: 'numeric', month: 'short' }).replace(' ', ' ')}
          </span>
        ))}
      </div>
    </section>
  );
}
