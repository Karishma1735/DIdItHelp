import { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import api, { errorMessage } from '../api';
import { useAuth } from '../auth.jsx';
import WeekView from '../components/WeekView.jsx';
import WeekNav from '../components/WeekNav.jsx';
import PlanForm from '../components/PlanForm.jsx';
import SettingsPanel from '../components/SettingsPanel.jsx';
import AppShell from '../components/AppShell.jsx';
import ManagerNote from '../components/ManagerNote.jsx';

export default function Dashboard() {
  const { user } = useAuth();
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
    <AppShell actions={data && <WeekNav week={data.week} today={data.today} onChange={goTo} />}>
      <ManagerNote />
      {error && <p role="alert" className="text-red-700 dark:text-red-400">{error}</p>}
      {!data && !error && <p className="muted">Loading…</p>}
      {data && (
        <WeekView data={data} readOnly={false} onItemChange={load} onOpenWeek={goTo}>
          <PlanForm today={data.today} mentorName={user.mentorName} onCreated={load} />
        </WeekView>
      )}
      <SettingsPanel />
    </AppShell>
  );
}
