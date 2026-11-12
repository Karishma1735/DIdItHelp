import TodaySection from './TodaySection.jsx';
import Hero from './Hero.jsx';
import Numbers from './Numbers.jsx';
import ImpactChart from './ImpactChart.jsx';
import ItemCard from './ItemCard.jsx';
import HistoryTable from './HistoryTable.jsx';
import DayHours from './DayHours.jsx';
import { formatDay, formatRange } from '../dates.js';

export const periodLabel = (p) =>
  p.kind === 'day'
    ? `${p.isCurrent ? 'Today' : 'Day'} · ${formatDay(p.start, { weekday: 'short', day: 'numeric', month: 'short' })}`
    : `${p.isCurrent ? 'This week' : 'Week of'} · ${formatRange(p.start, p.end)}`;

// Shared by the owner desk, a manager's view of a report and the share-link page.
// `children` (the planner and the plan form) sit right under the numbers and the 8-hour card, above the chart and the item list.
export default function PeriodView({ data, readOnly, onItemChange, onOpenDate, children }) {
  const { period } = data;
  const heading = period.kind === 'day' ? (period.isCurrent ? 'Items today' : `Items on ${formatDay(period.start)}`) : period.isCurrent ? 'Items this week' : 'Items that week';
  return (
    <div className="space-y-6">
      <TodaySection today={data.today} section={data.todaySection} />
      <Hero text={data.hero} label={periodLabel(period)} />
      <Numbers numbers={data.numbers} />
      <DayHours data={data} readOnly={readOnly} onChange={onItemChange} />
      {children}
      <ImpactChart history={data.history} kind={period.kind} activeStart={period.start} onOpen={onOpenDate} />
      <section>
        <h2 className="mb-3 text-xl font-semibold">{heading}</h2>
        {data.items.length === 0 ? (
          <p className="card text-sm muted">{period.kind === 'day' ? 'Nothing planned or delivered on this day.' : 'Nothing planned or delivered in this week.'}</p>
        ) : (
          <ul className="space-y-3">
            {data.items.map((i) => (
              <ItemCard key={i.id} item={i} readOnly={readOnly} onChange={onItemChange} />
            ))}
          </ul>
        )}
      </section>
      <HistoryTable history={data.history} kind={period.kind} activeStart={period.start} onOpen={onOpenDate} />
    </div>
  );
}
