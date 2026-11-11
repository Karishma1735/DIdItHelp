import { useCallback, useEffect, useState } from 'react';
import api, { errorMessage } from '../api';
import { formatWhen } from '../dates.js';

export default function InvitePanel({ onJoined }) {
  const [invites, setInvites] = useState([]);
  const [label, setLabel] = useState('');
  const [makeManager, setMakeManager] = useState(false);
  const [fresh, setFresh] = useState('');
  const [error, setError] = useState('');

  const load = useCallback(
    () => api.get('/team/invites').then((r) => setInvites(r.data.invites)).catch(() => {}),
    []
  );
  useEffect(() => { load(); }, [load]);

  async function create(e) {
    e.preventDefault();
    setError('');
    try {
      const { data } = await api.post('/team/invites', { label, makeManager });
      setFresh(data.url);
      setLabel('');
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
      <p className="text-sm muted">Send them an invite link. It works once and expires after 7 days. They pick their own password.</p>
      <form onSubmit={create} className="space-y-2">
        <div className="flex flex-wrap gap-2">
          <input className="input max-w-xs" placeholder="Who is it for? (optional note)" value={label} onChange={(e) => setLabel(e.target.value)} aria-label="Note for this invite" />
          <button className="btn-primary">Create invite link</button>
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={makeManager} onChange={(e) => setMakeManager(e.target.checked)} />
          They will manage a team too
        </label>
      </form>
      {error && <p role="alert" className="text-sm text-red-700 dark:text-red-400">{error}</p>}
      {fresh && (
        <div className="space-y-1 rounded-lg bg-emerald-50 p-3 dark:bg-emerald-950/40">
          <p className="text-sm font-medium">Copy this link now. It is shown only once.</p>
          <div className="flex gap-2">
            <input className="input" readOnly value={fresh} onFocus={(e) => e.target.select()} />
            <button className="btn-ghost" onClick={() => navigator.clipboard.writeText(fresh)}>Copy</button>
          </div>
        </div>
      )}
      {invites.length > 0 && (
        <ul className="divide-y divide-stone-200 text-sm dark:divide-stone-800">
          {invites.map((i) => (
            <li key={i.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
              <span>
                {i.status === 'joined' ? `${i.joinedName} joined` : `Waiting${i.label ? ` for ${i.label}` : ''}`}
                {i.makeManager && ' · manager'}
                <span className="muted"> · {i.status === 'joined' ? 'created' : 'expires'} {formatWhen(i.status === 'joined' ? i.createdAt : i.expiresAt)}</span>
              </span>
              {i.status === 'waiting' && <button className="btn-ghost" onClick={() => revoke(i.id)}>Revoke</button>}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
