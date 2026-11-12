import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import api from '../api';
import Brand from '../components/Brand.jsx';
import PeriodView from '../components/PeriodView.jsx';
import PeriodNav from '../components/PeriodNav.jsx';
import usePeriod from '../usePeriod.js';
import ThemeToggle from '../components/ThemeToggle.jsx';

// Read-only page for a secret share link.
export default function Manager() {
  const { token } = useParams();
  const p = usePeriod();
  const [data, setData] = useState(null);
  const [invalid, setInvalid] = useState(false);

  useEffect(() => {
    api
      .get(`/manager/${token}`, { params: p.api })
      .then((r) => setData(r.data))
      .catch(() => setInvalid(true));
  }, [token, p.view, p.date]); // eslint-disable-line react-hooks/exhaustive-deps

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

  return (
    <div>
      <div className="bg-steel-700 px-4 py-3 text-mist-50 dark:bg-steel-900 sm:px-8">
        <div className="mx-auto flex max-w-5xl items-center justify-between">
          <Brand light />
          <ThemeToggle className="border-white/25 text-mist-50 hover:bg-white/10" />
        </div>
      </div>
      <main className="mx-auto max-w-5xl space-y-6 px-4 py-6 sm:px-8 sm:py-8">
        <header className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="eyebrow">Read-only view</p>
            <h1 className="mt-1 text-3xl font-semibold sm:text-4xl">{data.owner.name}</h1>
            <p className="muted">{data.owner.role}</p>
          </div>
          <PeriodNav period={data.period} today={data.today} onDate={p.setDate} onView={(v) => p.setView(v, data.period.start)} />
        </header>
        <PeriodView data={data} readOnly onItemChange={() => {}} onOpenDate={p.setDate} />
      </main>
    </div>
  );
}
