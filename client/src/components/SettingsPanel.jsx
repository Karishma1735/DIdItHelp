import { useEffect, useState } from 'react';
import api, { errorMessage } from '../api';
import { useAuth } from '../auth.jsx';

export default function SettingsPanel() {
  const { user, setUser } = useAuth();
  const [form, setForm] = useState({ name: user.name, role: user.role, mentorName: user.mentorName, mentorContact: user.mentorContact, alertContact: user.alertContact || '' });
  const [msg, setMsg] = useState('');
  const [error, setError] = useState('');
  const [share, setShare] = useState({ active: false, url: '' });
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  useEffect(() => {
    api.get('/share').then((r) => setShare({ active: r.data.active, url: '' }));
  }, []);

  async function save(e) {
    e.preventDefault();
    setMsg(''); setError('');
    try {
      const { data } = await api.patch('/auth/me', form);
      setUser(data.user);
      setMsg('Saved.');
    } catch (err) { setError(errorMessage(err)); }
  }

  async function createLink() {
    try {
      const { data } = await api.post('/share');
      setShare({ active: true, url: data.url });
    } catch (err) { setError(errorMessage(err)); }
  }

  async function revoke() {
    if (!window.confirm('Revoke the manager link? It will stop working straight away.')) return;
    await api.delete('/share');
    setShare({ active: false, url: '' });
  }

  return (
    <section className="card space-y-5">
      <h2 className="text-lg font-bold">Settings</h2>
      <form onSubmit={save} className="grid gap-3 sm:grid-cols-2">
        <div><label className="label" htmlFor="s-name">Your name</label><input id="s-name" className="input" value={form.name} onChange={set('name')} required /></div>
        <div><label className="label" htmlFor="s-role">Your role</label><input id="s-role" className="input" value={form.role} onChange={set('role')} /></div>
        {user.managerName ? (
          <div className="sm:col-span-2 rounded-xl bg-mist-100 p-3 dark:bg-ink-950/60">
            <p className="label">Your manager</p>
            <p className="font-display text-lg font-semibold">{user.managerName}</p>
            <p className="mt-1 text-xs muted">This is the person who invited you. Questions marked “For: my manager” go to them, and their weekly summary is about you. Nothing to fill in here.</p>
          </div>
        ) : (
          <>
            <div><label className="label" htmlFor="s-mn">Manager’s name</label><input id="s-mn" className="input" value={form.mentorName} onChange={set('mentorName')} /></div>
            <div><label className="label" htmlFor="s-mc">Manager’s contact (Slack @name or email)</label><input id="s-mc" className="input" value={form.mentorContact} onChange={set('mentorContact')} /></div>
            <p className="sm:col-span-2 -mt-1 text-xs muted">You are at the top of the team, so enter whoever you report to (optional). Questions marked “For: my manager” and the weekly summary go to them.</p>
          </>
        )}
        <div className="sm:col-span-2"><label className="label" htmlFor="s-ac">Where should your reminders go? (Slack @name or email)</label><input id="s-ac" className="input" value={form.alertContact} onChange={set('alertContact')} placeholder={user.email} /><p className="mt-1 text-xs muted">The 10:00 “what will you deliver today?” prompt and deadline reminders go here. Leave it empty to use {user.email}.</p></div>
        <div className="sm:col-span-2 flex items-center gap-3">
          <button className="btn-primary">Save settings</button>
          {msg && <span className="text-sm text-leaf-700 dark:text-leaf-300">{msg}</span>}
          {error && <span role="alert" className="text-sm text-red-700 dark:text-red-400">{error}</span>}
        </div>
      </form>

      <div className="space-y-2 border-t border-ink-200 pt-4 dark:border-ink-800">
        <h3 className="font-semibold">Manager share link</h3>
        <p className="text-sm muted">A read-only page for your manager. Creating a new link revokes the old one. The link is shown once, so copy it now.</p>
        {share.url && (
          <div className="flex gap-2">
            <input className="input" readOnly value={share.url} onFocus={(e) => e.target.select()} />
            <button className="btn-ghost" onClick={() => navigator.clipboard.writeText(share.url)}>Copy</button>
          </div>
        )}
        <div className="flex flex-wrap items-center gap-2">
          <button className="btn-ghost" onClick={createLink}>{share.active ? 'Create a new link' : 'Create link'}</button>
          {share.active && <button className="btn-ghost" onClick={revoke}>Revoke link</button>}
          <span className="text-sm muted">{share.active ? 'A link is active.' : 'No active link.'}</span>
        </div>
      </div>
    </section>
  );
}
