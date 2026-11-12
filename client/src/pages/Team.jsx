import { useCallback, useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import api, { errorMessage } from '../api';
import AppShell from '../components/AppShell.jsx';
import WeekNav from '../components/WeekNav.jsx';
import Hero from '../components/Hero.jsx';
import Numbers from '../components/Numbers.jsx';
import StatusBadge from '../components/StatusBadge.jsx';
import InvitePanel from '../components/InvitePanel.jsx';
import AskAI from '../components/AskAI.jsx';
import { formatDay, formatRange } from '../dates.js';

const pct = (v) => (v === null || v === undefined ? '—' : `${v}%`);

function Line({ title, items }) {
  if (!items.length) return null;
  return (
    <div>
      <p className="font-mono text-[10px] uppercase tracking-[0.14em] muted">{title}</p>
      <ul className="mt-1 space-y-1">
        {items.map((i) => (
          <li key={i.id} className="flex flex-wrap items-center justify-between gap-2 text-sm">
            <span className="font-medium">{i.what}</span>
            <StatusBadge state={i.state} />
          </li>
        ))}
      </ul>
    </div>
  );
}

function Mini({ label, value }) {
  return (
    <div className="rounded-lg bg-mist-100 px-3 py-2 dark:bg-ink-950/60">
      <p className="font-mono text-[10px] uppercase tracking-wider muted">{label}</p>
      <p className="font-display text-2xl font-semibold leading-none">{value}</p>
    </div>
  );
}

function MemberCard({ m, week }) {
  const quiet = !m.today.planned.length && !m.today.deliveredToday.length && !m.today.late.length;
  return (
    <li>
      <Link to={`/team/${m.id}?week=${week}`} className="card block space-y-4 transition hover:-translate-y-0.5 hover:border-steel-400">
        <div className="flex items-center gap-3">
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-steel-600 font-display text-lg font-semibold text-mist-50">
            {m.name.trim()[0]?.toUpperCase()}
          </span>
          <div className="min-w-0 flex-1">
            <h3 className="truncate text-xl font-semibold">
              {m.name}
              {m.isManager && <span className="ml-2 font-mono text-[10px] font-normal uppercase tracking-wider muted">manager</span>}
              {m.isDemo && <span className="ml-2 rounded-full bg-amber-100 px-2 py-0.5 font-sans text-xs font-medium text-amber-900 dark:bg-amber-950 dark:text-amber-200">Sample data</span>}
            </h3>
            <p className="text-sm muted">{m.role}</p>
          </div>
          <span className="text-steel-600 dark:text-steel-300" aria-hidden="true">→</span>
        </div>
        <p className="font-display text-lg leading-snug">{m.hero}</p>
        <div className="grid grid-cols-3 gap-2">
          <Mini label="Impact" value={`${m.numbers.impact} pts`} />
          <Mini label="Reliability" value={pct(m.numbers.reliability)} />
          <Mini label="Answers" value={pct(m.numbers.answerRate)} />
        </div>
        <div className="space-y-2 border-t border-mist-300 pt-3 dark:border-ink-800">
          <p className="text-sm font-semibold">Today</p>
          {quiet && <p className="text-sm muted">Nothing planned or delivered today.</p>}
          <Line title="Late" items={m.today.late} />
          <Line title="Planned" items={m.today.planned} />
          <Line title="Delivered" items={m.today.deliveredToday} />
        </div>
      </Link>
    </li>
  );
}

export default function Team() {
  const [params, setParams] = useSearchParams();
  const week = params.get('week') || '';
  const [data, setData] = useState(null);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    try {
      const { data } = await api.get('/team', { params: week ? { week } : {} });
      setData(data);
      setError('');
    } catch (err) { setError(errorMessage(err, 'Could not load your team.')); }
  }, [week]);
  useEffect(() => { load(); }, [load]);

  const goTo = (w) => setParams(w ? { week: w } : {});
  const hasDemo = data?.members.some((m) => m.isDemo);

  async function demo(method) {
    if (method === 'delete' && !window.confirm('Remove the sample employee and all their sample data?')) return;
    try {
      await api[method]('/team/demo');
      load();
    } catch (err) { setError(errorMessage(err)); }
  }

  return (
    <AppShell
      eyebrow={data ? `Manager dashboard · ${formatDay(data.today)}` : 'Manager dashboard'}
      title="Your team"
      actions={data && <WeekNav week={data.week} today={data.today} onChange={goTo} />}
    >
      {error && <p role="alert" className="text-red-700 dark:text-red-400">{error}</p>}
      {!data && !error && <p className="muted">Loading…</p>}
      {data && (
        <>
          <Hero text={data.team.hero} label={`Team · ${formatRange(data.week.start, data.week.end)}`} />
          <Numbers numbers={data.team.numbers} />
          <AskAI members={data.members} />
          <section>
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-xl font-semibold">People</h2>
              {hasDemo ? (
                <button className="btn-ghost" onClick={() => demo('delete')}>Remove sample data</button>
              ) : (
                <button className="btn-ghost" onClick={() => demo('post')}>Add a sample employee</button>
              )}
            </div>
            {hasDemo && <p className="mb-3 text-sm muted">The sample employee is included in the totals above. Remove it once you have real people.</p>}
            {data.members.length === 0 ? (
              <p className="card text-sm muted">No one reports to you yet. Add someone below, or add a sample employee to see how this page looks.</p>
            ) : (
              <ul className="grid gap-4 lg:grid-cols-2">
                {data.members.map((m) => <MemberCard key={m.id} m={m} week={data.week.start} />)}
              </ul>
            )}
          </section>
        </>
      )}
      <InvitePanel />
    </AppShell>
  );
}
