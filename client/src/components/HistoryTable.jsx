import { formatDay } from '../dates.js';

const pct = (v) => (v === null ? '—' : `${v}%`);

export default function HistoryTable({ history, kind, activeStart, onOpen }) {
  const day = kind === 'day';
  return (
    <section className="card overflow-x-auto">
      <h2 className="mb-3 text-xl font-semibold">{day ? 'Last 14 days' : 'Last 8 weeks'}</h2>
      <table className="w-full min-w-[34rem] text-left text-sm">
        <thead className="text-xs uppercase tracking-wide muted">
          <tr>
            <th className="py-2 pr-3">{day ? 'Day' : 'Week of'}</th>
            <th className="pr-3">Delivered</th>
            <th className="pr-3">Reliability</th>
            <th className="pr-3">Impact</th>
            <th className="pr-3">Answer rate</th>
            <th>Helped a lot</th>
          </tr>
        </thead>
        <tbody>
          {history.map((w) => (
            <tr
              key={w.start}
              onClick={() => onOpen(w.start)}
              className={`cursor-pointer border-t border-mist-300 hover:bg-mist-200 dark:border-ink-800 dark:hover:bg-ink-800 ${w.start === activeStart ? 'bg-steel-50 dark:bg-steel-950/40' : ''}`}
            >
              <td className="py-2 pr-3 font-medium">{day ? formatDay(w.start, { weekday: 'short', day: 'numeric', month: 'short' }) : formatDay(w.start, { day: 'numeric', month: 'short' })}</td>
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
