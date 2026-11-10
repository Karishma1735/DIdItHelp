import TodaySection from './TodaySection.jsx';
import Hero from './Hero.jsx';
import Numbers from './Numbers.jsx';
import ItemCard from './ItemCard.jsx';
import WeekTable from './WeekTable.jsx';

// Shared by the owner dashboard and the read-only manager view.
// `children` (the plan form) is rendered between the numbers and the item list.
export default function WeekView({ data, readOnly, onItemChange, onOpenWeek, children }) {
  return (
    <div className="space-y-5">
      <TodaySection today={data.today} section={data.todaySection} />
      <Hero text={data.hero} />
      <Numbers numbers={data.numbers} />
      {children}
      <section>
        <h2 className="mb-2 text-lg font-bold">Items this week</h2>
        {data.items.length === 0 ? (
          <p className="text-sm muted">Nothing planned or delivered in this week.</p>
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
