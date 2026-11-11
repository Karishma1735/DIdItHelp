import { useCallback, useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import api, { errorMessage } from '../api';
import AppShell from '../components/AppShell.jsx';
import WeekNav from '../components/WeekNav.jsx';
import Hero from '../components/Hero.jsx';
import Numbers from '../components/Numbers.jsx';
import StatusBadge from '../components/StatusBadge.jsx';
import InvitePanel from '../components/InvitePanel.jsx';
import { formatDay } from '../dates.js';

const pct = (v) => (v === null || v === undefined ? '—' : `${v}%`);

function Line({ title, items }) {
  if (!items.length) return null;
  return (
    <div>
      <p className="text-xs font-medium uppercase tracking-wide muted">{title}</p>
      <ul className="mt-1 space-y-1">
        {items.map((i) => (
          <li key={i.id} className="flex flex-wrap items-center justify-between gap-2 text-sm">
            <span>{i.what}</span>
            <StatusBadge state={i.state} />
          </li>
        ))}
      </ul>
    </div>
  );
}

function MemberCard({ m, week }) {
  const quiet = !m.today.planned.length && !m.today.deliveredToday.length && !m.today.late.length;
  return (
    <li>
      <Link to={`/team/${m.id}?week=${week}`} className="card block space-y-3 transition hover:border-emerald-600">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h3 className="text-lg font-bold">{m.name}{m.isManager && <span className="ml-2 text-xs font-normal muted">manager</span>}</h3>
          <span className="text-sm muted">{m.role}</span>
        </div>
        <p className="font-medium">{m.hero}</p>
        <p className="text-sm muted">
          Impact <strong className="text-stone-900 dark:text-stone-100">{m.numbers.impact} pts</strong> ·
          Reliability <strong className="text-stone-900 dark:text-stone-100">{pct(m.numbers.reliability)}</strong> ·
          Answer rate <strong className="text-stone-900 dark:text-stone-100">{pct(m.numbers.answerRate)}</strong>
        </p>
        <div className="space-y-2 border-t border-stone-200 pt-3 dark:border-stone-800">
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

  return (
    <AppShell actions={data && <WeekNav week={data.week} today={data.today} onChange={goTo} />}>
      {error && <p role="alert" className="text-red-700 dark:text-red-400">{error}</p>}
      {!data && !error && <p className="muted">Loading…</p>}
      {data && (
        <>
          <p className="text-sm muted">Today is {formatDay(data.today)}. Open a person to see their full week.</p>
          <Hero text={data.team.hero} />
          <Numbers numbers={data.team.numbers} />
          <section>
            <h2 className="mb-2 text-lg font-bold">Your team</h2>
            {data.members.length === 0 ? (
              <p className="text-sm muted">No one reports to you yet. Create an invite link below.</p>
            ) : (
              <ul className="grid gap-3">
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
