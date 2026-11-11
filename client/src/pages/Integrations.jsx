import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api, { errorMessage } from '../api';
import AppShell from '../components/AppShell.jsx';

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
    <button
      className="btn-ghost px-2.5 py-1 text-xs"
      onClick={() => navigator.clipboard.writeText(text).then(() => { setDone(true); setTimeout(() => setDone(false), 1500); })}
    >
      {done ? 'Copied' : 'Copy'}
    </button>
  );
}

const Fields = ({ list }) => (
  <p className="flex flex-wrap gap-1.5">
    {list.map((f) => (
      <code key={f} className="rounded bg-mist-200 px-1.5 py-0.5 font-mono text-[11px] dark:bg-ink-800">{f}</code>
    ))}
  </p>
);

export default function Integrations() {
  const [d, setD] = useState(null);
  const [error, setError] = useState('');
  useEffect(() => {
    api.get('/integrations').then((r) => setD(r.data)).catch((e) => setError(errorMessage(e, 'Could not load integrations.')));
  }, []);

  return (
    <AppShell eyebrow="viaSocket" title="Integrations">
      <p className="max-w-2xl muted">
        Did it help? uses viaSocket to message people on Slack and email. This page shows what is connected and what each connection does.
        Nothing here is called from your browser. The server sends every message.
      </p>
      {error && <p role="alert" className="text-red-700 dark:text-red-400">{error}</p>}
      {!d && !error && <p className="muted">Loading…</p>}
      {d && (
        <>
          <section className="space-y-3">
            <h2 className="text-xl font-semibold">Messages the app sends</h2>
            <div className="grid gap-4 lg:grid-cols-2">
              {d.flows.map((f) => (
                <article key={f.id} className="card space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <h3 className="text-lg font-semibold">{f.name}</h3>
                    <Pill ok={f.configured} />
                  </div>
                  <p className="text-sm">{f.purpose}</p>
                  <div>
                    <p className="label">Sends these fields</p>
                    <Fields list={f.fields} />
                  </div>
                  <p className="text-xs muted">
                    Webhook is set in the server setting <code className="font-mono">{f.env}</code>.
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
            <p className="max-w-2xl text-sm muted">
              Each routine is a viaSocket flow on a schedule that calls the app and sends you the result. Replace <code className="font-mono">&lt;DIGEST_KEY&gt;</code> with your key.
            </p>
            <div className="grid gap-4 lg:grid-cols-3">
              {d.routines.items.map((r) => (
                <article key={r.id} className="card space-y-2">
                  <h3 className="text-lg font-semibold">{r.name}</h3>
                  <p className="font-mono text-xs uppercase tracking-wider text-steel-800 dark:text-steel-300">{r.when}</p>
                  <p className="text-sm">Sends <code className="font-mono text-xs">{r.send}</code> to {r.to}.</p>
                  <div className="flex items-center gap-2">
                    <code className="min-w-0 flex-1 truncate rounded bg-mist-200 px-2 py-1 font-mono text-[11px] dark:bg-ink-800" title={r.url}>{r.url}</code>
                    <Copy text={r.url} />
                  </div>
                  <p className="text-xs muted">Schedule: <code className="font-mono">{r.cron}</code></p>
                </article>
              ))}
            </div>
            <p className="text-sm muted">
              Reminders for unanswered questions run on their own: {d.routines.reminders.when.toLowerCase()}, one reminder per item.
            </p>
          </section>

          <section className="card space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-xl font-semibold">Connect apps inside Did it help?</h2>
              <Pill ok={d.embed.panelEnabled} yes="Panel on" no="Panel not on yet" />
            </div>
            <p className="text-sm">
              Soon each person will connect their own Slack and Gmail here, and the app will send from their account.
              Your viaSocket project is saved on the server and ready for it.
            </p>
            <dl className="grid gap-3 text-sm sm:grid-cols-3">
              <div><dt className="label">Organisation</dt><dd className="font-mono">{d.embed.orgId || '—'}</dd></div>
              <div><dt className="label">Project</dt><dd className="font-mono">{d.embed.projectId || '—'}</dd></div>
              <div><dt className="label">Signing secret</dt><dd><Pill ok={d.embed.secretSet} yes="Saved on the server" no="Not saved" /></dd></div>
            </dl>
            <p className="text-xs muted">The secret is never shown in the browser. Who can connect what is decided on the <Link className="link" to="/team">Team</Link> page: every person will connect their own apps.</p>
          </section>
        </>
      )}
    </AppShell>
  );
}
