import { addDays, formatDay, formatRange } from '../dates.js';

// Day | Week switch, previous / next, and a way back to today.
export default function PeriodNav({ period, today, onDate, onView }) {
  const day = period.kind === 'day';
  const step = day ? 1 : 7;
  const label = day ? formatDay(period.start, { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' }) : formatRange(period.start, period.end);
  let sub = day ? 'Another day' : 'Another week';
  if (period.isCurrent) sub = day ? 'Today' : 'This week';
  else if (day && period.start === addDays(today, -1)) sub = 'Yesterday';
  else if (day && period.start === addDays(today, 1)) sub = 'Tomorrow';
  const canNext = addDays(period.start, step) <= addDays(today, 28);

  const seg = (v, text) => (
    <button
      type="button"
      onClick={() => onView(v)}
      aria-pressed={period.kind === v}
      className={`rounded-lg px-3 py-1.5 text-sm font-semibold ${period.kind === v ? 'bg-steel-700 text-mist-50 dark:bg-steel-600' : 'hover:bg-mist-200 dark:hover:bg-ink-800'}`}
    >
      {text}
    </button>
  );

  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="flex gap-1 rounded-xl border border-mist-300 bg-mist-50 p-1 dark:border-ink-800 dark:bg-ink-900" role="group" aria-label="Show by">
        {seg('day', 'Day')}
        {seg('week', 'Week')}
      </div>
      <div className="flex items-center gap-1 rounded-xl border border-mist-300 bg-mist-50 p-1 dark:border-ink-800 dark:bg-ink-900">
        <button className="btn-ghost border-0 px-2.5" onClick={() => onDate(addDays(period.start, -step))} aria-label={day ? 'Previous day' : 'Previous week'}>←</button>
        <div className="min-w-[9.5rem] px-1 text-center">
          <p className="text-sm font-semibold">{label}</p>
          <p className="font-mono text-[10px] uppercase tracking-wider muted">{sub}</p>
        </div>
        <button className="btn-ghost border-0 px-2.5" onClick={() => onDate(addDays(period.start, step))} disabled={!canNext} aria-label={day ? 'Next day' : 'Next week'}>→</button>
      </div>
      {!period.isCurrent && <button className="btn-ghost" onClick={() => onDate('')}>{day ? 'Today' : 'This week'}</button>}
    </div>
  );
}
