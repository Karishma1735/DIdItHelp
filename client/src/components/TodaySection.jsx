import StatusBadge from './StatusBadge.jsx';
import { formatDay } from '../dates.js';

function Group({ title, items, empty, showDay }) {
  return (
    <div>
      <h3 className="mb-1.5 text-sm font-semibold">{title}</h3>
      {items.length === 0 ? (
        <p className="text-sm muted">{empty}</p>
      ) : (
        <ul className="space-y-1.5">
          {items.map((i) => (
            <li key={i.id} className="flex flex-wrap items-center justify-between gap-2 text-sm">
              <span>
                {i.what} <span className="muted">· for {i.forWhom}{showDay ? ` · planned ${formatDay(i.plannedDay)}` : ''}</span>
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
    <section className="card space-y-4" aria-label="Today">
      <h2 className="text-lg font-bold">Today <span className="text-sm font-normal muted">· {formatDay(today)}</span></h2>
      <div className="grid gap-4 md:grid-cols-3">
        <Group title="Planned for today" items={section.planned} empty="Nothing planned for today yet." />
        <Group title="Delivered today" items={section.deliveredToday} empty="Nothing delivered yet today." />
        <Group title="Late" items={section.late} empty="Nothing is late." showDay />
      </div>
    </section>
  );
}
