import StatusBadge from './StatusBadge.jsx';
import { formatDay } from '../dates.js';

function Group({ title, items, empty, showDay, tone }) {
  return (
    <div className={`rounded-xl p-3 ${tone || 'bg-cream-100 dark:bg-wine-950/60'}`}>
      <h3 className="mb-2 font-sans text-xs font-bold uppercase tracking-wide text-wine-600 dark:text-wine-400">{title}</h3>
      {items.length === 0 ? (
        <p className="text-sm muted">{empty}</p>
      ) : (
        <ul className="space-y-2">
          {items.map((i) => (
            <li key={i.id} className="flex flex-wrap items-center justify-between gap-2 text-sm">
              <span>
                <span className="font-medium">{i.what}</span>
                <span className="muted"> · for {i.forWhom}{showDay ? ` · planned ${formatDay(i.plannedDay)}` : ''}</span>
              </span>
              <StatusBadge state={i.state} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default function TodaySection({ today, section }) {
  return (
    <section className="card space-y-3" aria-label="Today">
      <h2 className="flex items-baseline gap-3 text-xl font-semibold">
        Today <span className="font-mono text-xs font-normal uppercase tracking-wider muted">{formatDay(today)}</span>
      </h2>
      <div className="grid gap-3 md:grid-cols-3">
        <Group title="Planned for today" items={section.planned} empty="Nothing planned for today yet." />
        <Group title="Delivered today" items={section.deliveredToday} empty="Nothing delivered yet today." />
        <Group title="Late" items={section.late} empty="Nothing is late." showDay tone={section.late.length ? 'bg-cherry-50 dark:bg-cherry-950/50' : undefined} />
      </div>
    </section>
  );
}
