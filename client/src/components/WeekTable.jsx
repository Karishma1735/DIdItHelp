import { formatDay } from '../dates.js';

const pct = (v) => (v === null ? '—' : `${v}%`);

export default function WeekTable({ weeks, activeStart, onOpen }) {
  return (
    <section className="card overflow-x-auto">
      <h2 className="mb-3 text-lg font-bold">Last 8 weeks</h2>
      <table className="w-full min-w-[34rem] text-left text-sm">
        <thead className="text-xs uppercase tracking-wide muted">
          <tr>
            <th className="py-2 pr-3">Week of</th>
            <th className="pr-3">Delivered</th>
            <th className="pr-3">Reliability</th>
            <th className="pr-3">Impact</th>
            <th className="pr-3">Answer rate</th>
            <th>Helped a lot</th>
          </tr>
        </thead>
        <tbody>
          {weeks.map((w) => (
            <tr
              key={w.weekStart}
              onClick={() => onOpen(w.weekStart)}
              className={`cursor-pointer border-t border-stone-200 hover:bg-stone-100 dark:border-stone-800 dark:hover:bg-stone-800 ${w.weekStart === activeStart ? 'bg-emerald-50 dark:bg-emerald-950/40' : ''}`}
            >
              <td className="py-2 pr-3 font-medium">{formatDay(w.weekStart, { day: 'numeric', month: 'short' })}</td>
              <td className="pr-3">{w.plannedCount ? `${w.deliveredOfPlanned} of ${w.plannedCount}` : '—'}</td>
              <td className="pr-3">{pct(w.reliability)}</td>
              <td className="pr-3">{w.impact} pts</td>
              <td className="pr-3">{pct(w.answerRate)}</td>
              <td>{w.lot}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
