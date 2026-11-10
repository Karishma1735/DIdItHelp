import { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import api, { errorMessage } from '../api';
import { useAuth } from '../auth.jsx';
import WeekView from '../components/WeekView.jsx';
import WeekNav from '../components/WeekNav.jsx';
import PlanForm from '../components/PlanForm.jsx';
import SettingsPanel from '../components/SettingsPanel.jsx';
import ThemeToggle from '../components/ThemeToggle.jsx';

export default function Dashboard() {
  const { user, signOut } = useAuth();
  const [params, setParams] = useSearchParams();
  const week = params.get('week') || '';
  const [data, setData] = useState(null);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    try {
      const { data } = await api.get('/overview', { params: week ? { week } : {} });
      setData(data);
      setError('');
    } catch (err) {
      setError(errorMessage(err, 'Could not load your dashboard.'));
    }
  }, [week]);

  useEffect(() => { load(); }, [load]);

  const goTo = (w) => setParams(w ? { week: w } : {});

  return (
    <div className="mx-auto max-w-4xl space-y-5 p-4 sm:p-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">{user.name}</h1>
          <p className="muted">{user.role || 'Add your role in Settings'}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {data && <WeekNav week={data.week} today={data.today} onChange={goTo} />}
          <ThemeToggle />
          <button className="btn-ghost" onClick={signOut}>Sign out</button>
        </div>
      </header>

      {error && <p role="alert" className="text-red-700 dark:text-red-400">{error}</p>}
      {!data && !error && <p className="muted">Loading…</p>}
      {data && (
        <WeekView data={data} readOnly={false} onItemChange={load} onOpenWeek={goTo}>
          <PlanForm today={data.today} mentorName={user.mentorName} onCreated={load} />
        </WeekView>
      )}
      <SettingsPanel />
    </div>
  );
}
