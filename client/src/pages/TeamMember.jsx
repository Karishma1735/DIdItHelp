import { useEffect, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import api, { errorMessage } from '../api';
import AppShell from '../components/AppShell.jsx';
import WeekView from '../components/WeekView.jsx';
import WeekNav from '../components/WeekNav.jsx';

// A manager's read-only view of one report's desk. Same components as the share link.
export default function TeamMember() {
  const { userId } = useParams();
  const [params, setParams] = useSearchParams();
  const week = params.get('week') || '';
  const [data, setData] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    api
      .get(`/team/${userId}/overview`, { params: week ? { week } : {} })
      .then((r) => { setData(r.data); setError(''); })
      .catch((err) => setError(errorMessage(err, 'Could not load this person.')));
  }, [userId, week]);

  const goTo = (w) => setParams(w ? { week: w } : {});

  return (
    <AppShell actions={data && <WeekNav week={data.week} today={data.today} onChange={goTo} />}>
      <Link to={`/team${week ? `?week=${week}` : ''}`} className="text-sm underline">← Back to the team</Link>
      {error && <p role="alert" className="text-red-700 dark:text-red-400">{error}</p>}
      {!data && !error && <p className="muted">Loading…</p>}
      {data && (
        <>
          <div>
            <h2 className="text-xl font-bold">{data.owner.name}</h2>
            <p className="muted">{data.owner.role} · read-only view</p>
          </div>
          <WeekView data={data} readOnly onItemChange={() => {}} onOpenWeek={goTo} />
        </>
      )}
    </AppShell>
  );
}
