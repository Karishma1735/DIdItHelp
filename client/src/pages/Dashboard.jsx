import { useCallback, useEffect, useState } from 'react';
import api, { errorMessage } from '../api';
import { useAuth } from '../auth.jsx';
import AppShell from '../components/AppShell.jsx';
import ManagerNote from '../components/ManagerNote.jsx';
import GmailBanner from '../components/GmailBanner.jsx';
import PeriodView from '../components/PeriodView.jsx';
import PeriodNav from '../components/PeriodNav.jsx';
import usePeriod from '../usePeriod.js';
import PlanForm from '../components/PlanForm.jsx';
import { formatDay } from '../dates.js';

function greeting(name) {
  const h = new Date().getHours();
  const part = h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening';
  return `${part}, ${name.split(' ')[0]}`;
}

export default function Dashboard() {
  const { user } = useAuth();
  const p = usePeriod();
  const [data, setData] = useState(null);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    try {
      const { data } = await api.get('/overview', { params: p.api });
      setData(data);
      setError('');
    } catch (err) {
      setError(errorMessage(err, 'Could not load your dashboard.'));
    }
  }, [p.view, p.date]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { load(); }, [load]);

  return (
    <AppShell
      eyebrow={data ? `My desk · ${formatDay(data.today)}` : 'My desk'}
      title={greeting(user.name)}
      actions={data && <PeriodNav period={data.period} today={data.today} onDate={p.setDate} onView={(v) => p.setView(v, data.period.start)} />}
    >
      <ManagerNote />
      <GmailBanner />
      {error && <p role="alert" className="text-red-700 dark:text-red-400">{error}</p>}
      {!data && !error && <p className="muted">Loading…</p>}
      {data && (
        <PeriodView data={data} readOnly={false} onItemChange={load} onOpenDate={p.setDate}>
          <PlanForm today={data.today} mentorName={user.mentorName} onCreated={load} />
        </PeriodView>
      )}
    </AppShell>
  );
}
