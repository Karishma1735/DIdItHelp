import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import api, { errorMessage } from '../api';
import AppShell from '../components/AppShell.jsx';
import PeriodView from '../components/PeriodView.jsx';
import PeriodNav from '../components/PeriodNav.jsx';
import usePeriod from '../usePeriod.js';

// A manager's read-only view of one report's desk. Same components as the share link.
export default function TeamMember() {
  const { userId } = useParams();
  const p = usePeriod();
  const [data, setData] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    api
      .get(`/team/${userId}/overview`, { params: p.api })
      .then((r) => { setData(r.data); setError(''); })
      .catch((err) => setError(errorMessage(err, 'Could not load this person.')));
  }, [userId, p.view, p.date]); // eslint-disable-line react-hooks/exhaustive-deps


  return (
    <AppShell
      eyebrow="Team · read-only view"
      title={data ? data.owner.name : 'Team member'}
      actions={data && <PeriodNav period={data.period} today={data.today} onDate={p.setDate} onView={(v) => p.setView(v, data.period.start)} />}
    >
      <Link to={`/team?${p.query}`} className="link text-sm">← Back to the team</Link>
      {error && <p role="alert" className="text-red-700 dark:text-red-400">{error}</p>}
      {!data && !error && <p className="muted">Loading…</p>}
      {data && (
        <>
          <p className="-mt-2 muted">{data.owner.role}</p>
          <PeriodView data={data} readOnly onItemChange={() => {}} onOpenDate={p.setDate} />
        </>
      )}
    </AppShell>
  );
}
