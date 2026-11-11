import { useCallback, useEffect, useState } from 'react';
import api, { errorMessage } from '../api';
import { formatWhen } from '../dates.js';

const where = (via) => (via === 'email' ? 'email' : 'Slack');

export default function InvitePanel() {
  const [invites, setInvites] = useState([]);
  const [form, setForm] = useState({ label: '', contact: '', makeManager: false });
  const [result, setResult] = useState(null); // { url, sent }
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value });

  const load = useCallback(
    () => api.get('/team/invites').then((r) => setInvites(r.data.invites)).catch(() => {}),
    []
  );
  useEffect(() => { load(); }, [load]);

  async function create(e) {
    e.preventDefault();
    setBusy(true);
    setError('');
    setResult(null);
    try {
      const { data } = await api.post('/team/invites', form);
      setResult(data);
      setForm({ label: '', contact: '', makeManager: false });
      load();
    } catch (err) { setError(errorMessage(err)); } finally { setBusy(false); }
  }

  async function resend(id) {
    setError('');
    try {
      const { data } = await api.post(`/team/invites/${id}/resend`);
      setResult(data);
      load();
    } catch (err) { setError(errorMessage(err)); }
  }

  async function revoke(id) {
    await api.delete(`/team/invites/${id}`);
    load();
  }

  return (
    <section className="card space-y-3">
      <h2 className="text-lg font-bold">Add someone to your team</h2>
      <p className="text-sm muted">
        Enter their name and their Slack @name or email. We send them the invite link there. The link works once and expires after 7 days,
        and they pick their own password.
      </p>
      <form onSubmit={create} className="space-y-3">
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="label" htmlFor="inv-name">Their name</label>
            <input id="inv-name" className="input" required value={form.label} onChange={set('label')} placeholder="Rahul Verma" />
          </div>
          <div>
            <label className="label" htmlFor="inv-contact">Slack @name or email</label>
            <input id="inv-contact" className="input" value={form.contact} onChange={set('contact')} placeholder="@rahul or rahul@company.com" />
          </div>
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={form.makeManager} onChange={set('makeManager')} />
          They will manage a team too
        </label>
        <button className="btn-primary" disabled={busy}>
          {busy ? 'Sending…' : form.contact.trim() ? 'Send invite' : 'Create invite link'}
        </button>
        {!form.contact.trim() && <span className="ml-3 text-sm muted">No Slack or email? You get a link to send yourself.</span>}
      </form>
      {error && <p role="alert" className="text-sm text-red-700 dark:text-red-400">{error}</p>}

      {result && (
        <div className="space-y-2 rounded-lg bg-ink-100 p-3 dark:bg-ink-800">
          {result.sent?.ok && (
            <p className="text-sm font-medium text-leaf-700 dark:text-leaf-300">Invite sent on {where(result.sent.channel)}.</p>
          )}
          {result.sent && !result.sent.ok && (
            <p role="alert" className="text-sm text-red-700 dark:text-red-400">
              The invite was not sent: {result.sent.error} Copy the link below and send it yourself.
            </p>
          )}
          <p className="text-sm">Link (shown only once):</p>
          <div className="flex gap-2">
            <input className="input" readOnly value={result.url} onFocus={(e) => e.target.select()} />
            <button className="btn-ghost" onClick={() => navigator.clipboard.writeText(result.url)}>Copy</button>
          </div>
        </div>
      )}

      {invites.length > 0 && (
        <ul className="divide-y divide-ink-200 text-sm dark:divide-ink-800">
          {invites.map((i) => (
            <li key={i.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
              <span>
                <strong>{i.status === 'joined' ? i.joinedName : i.label || 'Invite'}</strong>
                {i.makeManager && ' · manager'}
                <span className="muted">
                  {i.status === 'joined' && ' · joined your team'}
                  {i.status === 'waiting' && i.sentAt && ` · sent to ${i.contact} on ${where(i.sentVia)}, ${formatWhen(i.sentAt)}`}
                  {i.status === 'waiting' && !i.sentAt && !i.sendError && ' · link not sent, copy-only'}
                  {i.status === 'waiting' && ` · expires ${formatWhen(i.expiresAt)}`}
                </span>
                {i.status === 'waiting' && i.sendError && (
                  <span className="block text-red-700 dark:text-red-400">Not sent: {i.sendError}</span>
                )}
              </span>
              {i.status === 'waiting' && (
                <span className="flex gap-2">
                  {i.contact && <button className="btn-ghost" onClick={() => resend(i.id)}>Send again</button>}
                  <button className="btn-ghost" onClick={() => revoke(i.id)}>Revoke</button>
                </span>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
