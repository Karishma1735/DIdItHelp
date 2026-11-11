import { useCallback, useEffect, useState } from 'react';
import { loadConnectScript } from 'viasocket-apps/browser';
import api, { errorMessage } from '../api';
import { useAuth } from '../auth.jsx';
import AppShell from '../components/AppShell.jsx';
import AppConnectCard from '../components/AppConnectCard.jsx';
import EmbedBox from '../components/EmbedBox.jsx';

function Pill({ ok, yes = 'Connected', no = 'Not set up' }) {
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold ${ok ? 'bg-leaf-100 text-leaf-800 dark:bg-leaf-800/40 dark:text-leaf-300' : 'bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200'}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${ok ? 'bg-leaf-600' : 'bg-amber-600'}`} />
      {ok ? yes : no}
    </span>
  );
}

function Copy({ text }) {
  const [done, setDone] = useState(false);
  return (
    <button className="btn-ghost px-2.5 py-1 text-xs" onClick={() => navigator.clipboard.writeText(text).then(() => { setDone(true); setTimeout(() => setDone(false), 1500); })}>
      {done ? 'Copied' : 'Copy'}
    </button>
  );
}

const Fields = ({ list }) => (
  <p className="flex flex-wrap gap-1.5">
    {list.map((f) => <code key={f} className="rounded bg-mist-200 px-1.5 py-0.5 font-mono text-[11px] dark:bg-ink-800">{f}</code>)}
  </p>
);

// Managers only: whether the shared message webhooks and routine flows are set up.
function MessageSetup() {
  const [d, setD] = useState(null);
  useEffect(() => { api.get('/integrations').then((r) => setD(r.data)).catch(() => {}); }, []);
  if (!d) return null;
  return (
    <>
      <section className="space-y-3">
        <h2 className="text-xl font-semibold">Messages the app sends for everyone</h2>
        <div className="grid gap-4 lg:grid-cols-2">
          {d.flows.map((f) => (
            <article key={f.id} className="card space-y-3">
              <div className="flex items-start justify-between gap-3">
                <h3 className="text-lg font-semibold">{f.name}</h3>
                <Pill ok={f.configured} />
              </div>
              <p className="text-sm">{f.purpose}</p>
              <div><p className="label">Sends these fields</p><Fields list={f.fields} /></div>
              <p className="text-xs muted">
                Set in the server setting <code className="font-mono">{f.env}</code>.
                {!f.configured && ' Until it is set, the app shows an error on the item and gives you the link or message to send yourself.'}
              </p>
            </article>
          ))}
        </div>
      </section>
      <section className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-xl font-semibold">Daily routine</h2>
          <Pill ok={d.routines.keySet} yes="Access key set" no="Access key missing" />
        </div>
        <p className="max-w-2xl text-sm muted">Each routine is a viaSocket flow on a schedule that calls the app and sends you the result. Replace <code className="font-mono">&lt;DIGEST_KEY&gt;</code> with your key.</p>
        <div className="grid gap-4 lg:grid-cols-3">
          {d.routines.items.map((r) => (
            <article key={r.id} className="card space-y-2">
              <h3 className="text-lg font-semibold">{r.name}</h3>
              <p className="font-mono text-xs uppercase tracking-wider text-steel-600 dark:text-steel-300">{r.when}</p>
              <p className="text-sm">Sends <code className="font-mono text-xs">{r.send}</code> to {r.to}.</p>
              <div className="flex items-center gap-2">
                <code className="min-w-0 flex-1 truncate rounded bg-mist-200 px-2 py-1 font-mono text-[11px] dark:bg-ink-800" title={r.url}>{r.url}</code>
                <Copy text={r.url} />
              </div>
              <p className="text-xs muted">Schedule: <code className="font-mono">{r.cron}</code></p>
            </article>
          ))}
        </div>
        <p className="text-sm muted">Reminders for unanswered questions run on their own: {d.routines.reminders.when.toLowerCase()}, one reminder per item.</p>
      </section>
    </>
  );
}

export default function Integrations() {
  const { user } = useAuth();
  const [boot, setBoot] = useState(null); // { token, apps }: per-person embed token from our own server
  const [status, setStatus] = useState(null);
  const [error, setError] = useState('');

  const loadStatus = useCallback(() => {
    api.get('/viasocket/status').then((r) => { setStatus(r.data.apps); setError(''); }).catch((e) => setError(errorMessage(e, 'Could not load your apps.')));
  }, []);

  useEffect(() => {
    loadStatus();
    api.get('/viasocket/token', { params: { apps: 'slack,gmail' } }).then((r) => setBoot(r.data)).catch(() => {});
    loadConnectScript().catch(() => {}); // load early so the sign-in window opens straight from the click
  }, [loadStatus]);

  return (
    <AppShell eyebrow="viaSocket" title="Integrations">
      <p className="max-w-2xl muted">
        Connect your own apps. Messages and automations you set up here run from your own accounts. Nobody else, including your manager, can see or use your connections.
      </p>
      {error && <p role="alert" className="text-red-700 dark:text-red-400">{error}</p>}

      <section className="space-y-3">
        <h2 className="text-xl font-semibold">Connect Slack and Gmail</h2>
        {!status && !error && <p className="muted">Loading…</p>}
        {status && (
          <div className="grid gap-4 lg:grid-cols-2">
            {status.map((a) => <AppConnectCard key={a.app} app={a} boot={boot} onChanged={loadStatus} />)}
          </div>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-semibold">Every other app</h2>
        <p className="max-w-2xl text-sm muted">
          Browse more than 2,300 apps, connect the ones you use, and build your own automations, such as “every morning, post my plan to Slack”.
        </p>
        <EmbedBox token={boot && boot.token} />
      </section>

      {user.isManager && <MessageSetup />}
    </AppShell>
  );
}
