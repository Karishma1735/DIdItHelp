import { addDays, formatRange } from '../dates.js';

export default function WeekNav({ week, today, onChange }) {
  const maxStart = addDays(today, 28);
  return (
    <div className="flex items-center gap-2">
      <button className="btn-ghost" onClick={() => onChange(addDays(week.start, -7))} aria-label="Previous week">←</button>
      <div className="min-w-[10rem] text-center text-sm font-medium">
        {formatRange(week.start, week.end)}
        {week.isCurrent && <span className="block text-xs font-normal muted">This week</span>}
      </div>
      <button className="btn-ghost" onClick={() => onChange(addDays(week.start, 7))} disabled={addDays(week.start, 7) > maxStart} aria-label="Next week">→</button>
    </div>
  );
}
