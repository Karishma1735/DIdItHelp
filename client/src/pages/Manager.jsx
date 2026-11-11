import { useEffect, useState } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import api from '../api';
import Brand from '../components/Brand.jsx';
import WeekView from '../components/WeekView.jsx';
import WeekNav from '../components/WeekNav.jsx';
import ThemeToggle from '../components/ThemeToggle.jsx';

// Read-only page for a secret share link.
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
      <main className="mx-auto max-w-md p-8">
        <Brand />
        <h1 className="mt-8 text-2xl font-semibold">This link doesn’t work any more</h1>
        <p className="mt-2 muted">It may have been revoked. Ask for a new manager link.</p>
      </main>
    );
  }
  if (!data) return <p className="p-6 muted">Loading…</p>;

  const goTo = (w) => setParams(w ? { week: w } : {});
  return (
    <div>
      <div className="bg-cherry-700 px-4 py-3 text-cream-50 dark:bg-cherry-900 sm:px-8">
        <div className="mx-auto flex max-w-5xl items-center justify-between">
          <Brand light />
          <ThemeToggle className="border-white/25 text-cream-50 hover:bg-white/10" />
        </div>
      </div>
      <main className="mx-auto max-w-5xl space-y-6 px-4 py-6 sm:px-8 sm:py-8">
        <header className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="eyebrow">Read-only view</p>
            <h1 className="mt-1 text-3xl font-semibold sm:text-4xl">{data.owner.name}</h1>
            <p className="muted">{data.owner.role}</p>
          </div>
          <WeekNav week={data.week} today={data.today} onChange={goTo} />
        </header>
        <WeekView data={data} readOnly onItemChange={() => {}} onOpenWeek={goTo} />
      </main>
    </div>
  );
}
