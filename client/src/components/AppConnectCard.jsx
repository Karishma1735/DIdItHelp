import { useEffect, useRef, useState } from 'react';
import { connect } from 'viasocket-apps/browser';
import api, { errorMessage } from '../api';

function Icon({ url, name }) {
  const [bad, setBad] = useState(false);
  if (!url || bad) {
    return <span className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-steel-700 font-display text-xl font-semibold text-mist-50">{name[0]}</span>;
  }
  return <img src={url} alt="" onError={() => setBad(true)} className="h-12 w-12 shrink-0 rounded-xl bg-white object-contain p-1.5 ring-1 ring-mist-300 dark:ring-ink-700" />;
}

// "Which Slack person are you?": chosen once after connecting, stored with the connection, changeable here.
function SlackMe({ me, onSaved }) {
  const [open, setOpen] = useState(!me);
  const [text, setText] = useState('');
  const [list, setList] = useState({ options: [], hasMore: false, paginate: null, message: '' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const seq = useRef(0);

  async function load(search, paginate) {
    const mine = ++seq.current;
    setBusy(true);
    setError('');
    try {
      const { data } = await api.get('/viasocket/slack/people', { params: { search: search || undefined, paginate: paginate ?? undefined } });
      if (mine !== seq.current) return;
      setList((prev) => ({
        options: paginate ? [...prev.options, ...data.options] : data.options,
        hasMore: data.hasMore,
        paginate: data.paginate,
        message: data.message || '',
      }));
    } catch (err) {
      if (mine === seq.current) setError(errorMessage(err));
    } finally {
      if (mine === seq.current) setBusy(false);
    }
  }

  // Follow the saved choice: show the name once it exists, the picker while there is none.
  const saved = me ? me.label : null;
  useEffect(() => { setOpen(!saved); }, [saved]);

  useEffect(() => {
    if (!open) return undefined;
    const t = setTimeout(() => load(text), text ? 300 : 0);
    return () => clearTimeout(t);
  }, [open, text]); // eslint-disable-line react-hooks/exhaustive-deps

  async function pick(o) {
    setError('');
    try {
      await api.post('/viasocket/slack/me', { value: o.value, label: o.label });
      onSaved();
    } catch (err) { setError(errorMessage(err)); }
  }

  if (!open && me) {
    return (
      <p className="text-sm">
        You are <strong>{me.label}</strong> in Slack. <button className="link" onClick={() => setOpen(true)}>Change</button>
      </p>
    );
  }
  return (
    <div className="space-y-2 rounded-xl bg-mist-100 p-3 dark:bg-ink-950/60">
      <label className="label" htmlFor="slack-me">Which one is you in Slack?</label>
      <input id="slack-me" className="input" placeholder="Type your name" value={text} onChange={(e) => setText(e.target.value)} autoComplete="off" />
      {error && <p role="alert" className="text-sm text-red-700 dark:text-red-400">{error}</p>}
      {list.message && <p className="text-sm muted">{list.message}</p>}
      <ul className="max-h-48 divide-y divide-mist-300 overflow-auto rounded-lg border border-mist-300 bg-mist-50 dark:divide-ink-800 dark:border-ink-800 dark:bg-ink-900">
        {list.options.map((o) => (
          <li key={o.value}>
            <button className="w-full px-3 py-2 text-left text-sm hover:bg-mist-200 dark:hover:bg-ink-800" onClick={() => pick(o)}>{o.label}</button>
          </li>
        ))}
        {!list.options.length && !busy && <li className="px-3 py-2 text-sm muted">No one found.</li>}
      </ul>
      {list.hasMore && <button className="btn-ghost" disabled={busy} onClick={() => load(text, list.paginate)}>{busy ? 'Loading…' : 'Show more'}</button>}
      {me && <button className="link text-sm" onClick={() => setOpen(false)}>Cancel</button>}
    </div>
  );
}

export default function AppConnectCard({ app, boot, onChanged }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [note, setNote] = useState('');
  const info = boot && boot.apps[app.app];

  async function save(authId) {
    await api.post('/viasocket/connected', { app: app.app, authId });
    onChanged();
  }

  async function onConnect() {
    if (!info) return;
    setBusy(true);
    setError('');
    setNote('');
    try {
      const { authId } = await connect({
        embedToken: boot.token,
        serviceId: info.serviceId,
        actions: [info.actionId], // the consent screen asks only for what sending a message needs
        skipActionSelection: true,
        onLateSuccess: ({ authId: late }) => save(late).catch(() => {}),
      });
      await save(authId);
    } catch (err) {
      if (err && err.code === 'closed') setNote('The sign-in window closed. If you finished signing in, it will show up here in a moment.');
      else setError(errorMessage(err, err && err.message));
    } finally {
      setBusy(false);
    }
  }

  async function sendTest() {
    setBusy(true);
    setError('');
    setNote('');
    try {
      const { data } = await api.post(`/viasocket/test/${app.app}`);
      setNote(`Test message sent to ${data.to}.`);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  const needsMe = app.app === 'slack' && app.connected && !app.expired && !app.slackMe;
  return (
    <article className="card space-y-4">
      <div className="flex items-center gap-3">
        <Icon url={app.iconUrl} name={app.name} />
        <div className="min-w-0 flex-1">
          <h3 className="text-xl font-semibold">{app.name}</h3>
          <p className="text-sm muted">
            {app.connected ? (app.expired ? 'Connection expired' : `Connected${app.label ? ` · ${app.label.replace(/[{}"]/g, '').replace('team:', 'workspace ')}` : ''}`) : 'Not connected'}
          </p>
        </div>
        <span className={`h-2.5 w-2.5 rounded-full ${app.connected && !app.expired ? 'bg-leaf-600' : 'bg-mist-400 dark:bg-ink-600'}`} aria-hidden="true" />
      </div>

      <p className="text-sm">
        {app.app === 'slack'
          ? 'Connect your own Slack so messages can go from you.'
          : 'Connect your own Gmail so emails can go from you.'}
      </p>

      {app.connected && !app.expired && app.app === 'slack' && <SlackMe me={app.slackMe} onSaved={onChanged} />}
      {app.connected && !app.expired && app.app === 'gmail' && app.testTo && (
        <p className="text-sm muted">The test email goes only to {app.testTo}.</p>
      )}

      {error && <p role="alert" className="text-sm text-red-700 dark:text-red-400">{error}</p>}
      {note && <p className="text-sm text-leaf-700 dark:text-leaf-300">{note}</p>}

      <div className="flex flex-wrap gap-2">
        <button className="btn-primary" onClick={onConnect} disabled={busy || !info}>
          {!info ? 'Loading…' : busy ? 'Working…' : app.connected ? (app.expired ? `Connect ${app.name} again` : `Connect ${app.name} again`) : `Connect ${app.name}`}
        </button>
        {app.connected && !app.expired && (
          <button className="btn-ghost" onClick={sendTest} disabled={busy || needsMe}>Send me a test message</button>
        )}
      </div>
      {needsMe && <p className="text-xs muted">Pick your name above to turn on the test message.</p>}
    </article>
  );
}
