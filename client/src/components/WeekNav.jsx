import { addDays, formatRange } from '../dates.js';

export default function WeekNav({ week, today, onChange }) {
  const maxStart = addDays(today, 28);
  return (
    <div className="flex items-center gap-1 rounded-xl border border-cream-300 bg-cream-50 p-1 dark:border-wine-800 dark:bg-wine-900">
      <button className="btn-ghost border-0 px-2.5" onClick={() => onChange(addDays(week.start, -7))} aria-label="Previous week">←</button>
      <div className="min-w-[9.5rem] px-1 text-center">
        <p className="text-sm font-semibold">{formatRange(week.start, week.end)}</p>
        <p className="font-mono text-[10px] uppercase tracking-wider muted">{week.isCurrent ? 'This week' : 'Other week'}</p>
      </div>
      <button className="btn-ghost border-0 px-2.5" onClick={() => onChange(addDays(week.start, 7))} disabled={addDays(week.start, 7) > maxStart} aria-label="Next week">→</button>
    </div>
  );
}
