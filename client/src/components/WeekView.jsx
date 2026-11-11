import TodaySection from './TodaySection.jsx';
import Hero from './Hero.jsx';
import Numbers from './Numbers.jsx';
import ImpactChart from './ImpactChart.jsx';
import ItemCard from './ItemCard.jsx';
import WeekTable from './WeekTable.jsx';
import { formatRange } from '../dates.js';

// Shared by the owner desk, a manager's view of a report and the share-link page.
// `children` (the plan form) is rendered between the numbers and the item list.
export default function WeekView({ data, readOnly, onItemChange, onOpenWeek, children }) {
  return (
    <div className="space-y-6">
      <TodaySection today={data.today} section={data.todaySection} />
      <Hero text={data.hero} label={`${data.week.isCurrent ? 'This week' : 'Week of'} · ${formatRange(data.week.start, data.week.end)}`} />
      <Numbers numbers={data.numbers} />
      <ImpactChart weeks={data.weeks} activeStart={data.week.start} onOpen={onOpenWeek} />
      {children}
      <section>
        <h2 className="mb-3 text-xl font-semibold">Items this week</h2>
        {data.items.length === 0 ? (
          <p className="card text-sm muted">Nothing planned or delivered in this week.</p>
        ) : (
          <ul className="space-y-3">
            {data.items.map((i) => (
              <ItemCard key={i.id} item={i} readOnly={readOnly} onChange={onItemChange} />
            ))}
          </ul>
        )}
      </section>
      <WeekTable weeks={data.weeks} activeStart={data.week.start} onOpen={onOpenWeek} />
    </div>
  );
}
