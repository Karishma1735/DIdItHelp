import { useEffect, useState } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import api from '../api';
import WeekView from '../components/WeekView.jsx';
import WeekNav from '../components/WeekNav.jsx';
import ThemeToggle from '../components/ThemeToggle.jsx';

export default function Manager() {
  const { token } = useParams();
  const [params, setParams] = useSearchParams();
  const week = params.get('week') || '';
  const [data, setData] = useState(null);
  const [invalid, setInvalid] = useState(false);

  useEffect(() => {
    api
      .get(`/manager/${token}`, { params: week ? { week } : {} })
      .then((r) => setData(r.data))
      .catch(() => setInvalid(true));
  }, [token, week]);

  if (invalid) {
    return (
      <main className="mx-auto max-w-md p-6">
        <h1 className="text-xl font-bold">This link doesn’t work any more</h1>
        <p className="mt-2 muted">It may have been revoked. Ask for a new manager link.</p>
      </main>
    );
  }
  if (!data) return <p className="p-6 muted">Loading…</p>;

  const goTo = (w) => setParams(w ? { week: w } : {});
  return (
    <div className="mx-auto max-w-4xl space-y-5 p-4 sm:p-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">{data.owner.name}</h1>
          <p className="muted">{data.owner.role} · read-only view</p>
        </div>
        <div className="flex items-center gap-2">
          <WeekNav week={data.week} today={data.today} onChange={goTo} />
          <ThemeToggle />
        </div>
      </header>
      <WeekView data={data} readOnly onItemChange={() => {}} onOpenWeek={goTo} />
    </div>
  );
}
