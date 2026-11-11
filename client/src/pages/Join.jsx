import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import api, { errorMessage } from '../api';
import { useAuth } from '../auth.jsx';
import ThemeToggle from '../components/ThemeToggle.jsx';

export default function Join() {
  const { token } = useParams();
  const { signIn } = useAuth();
  const navigate = useNavigate();
  const [info, setInfo] = useState(null);
  const [invalid, setInvalid] = useState('');
  const [form, setForm] = useState({ name: '', role: '', email: '', password: '' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  useEffect(() => {
    api.get(`/auth/invite/${token}`).then((r) => setInfo(r.data)).catch((err) => setInvalid(errorMessage(err, 'This invite link is not valid.')));
  }, [token]);

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const { data } = await api.post('/auth/register', { ...form, invite: token });
      signIn(data);
      navigate('/');
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center gap-4 p-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Did it help?</h1>
        <ThemeToggle />
      </div>
      {invalid ? (
        <div className="card"><h2 className="font-semibold">This invite doesn’t work</h2><p className="mt-1 text-sm muted">{invalid}</p></div>
      ) : !info ? (
        <p className="muted">Loading…</p>
      ) : (
        <form onSubmit={submit} className="card space-y-3">
          <h2 className="font-semibold">{info.managerName} invited you to join their team</h2>
          <p className="text-sm muted">Create your account. {info.managerName} will be able to see your daily plan and weekly results.</p>
          <div><label className="label" htmlFor="name">Your name</label><input id="name" className="input" required value={form.name} onChange={set('name')} /></div>
          <div><label className="label" htmlFor="role">Your role</label><input id="role" className="input" value={form.role} onChange={set('role')} /></div>
          <div><label className="label" htmlFor="email">Email</label><input id="email" className="input" type="email" required autoComplete="email" value={form.email} onChange={set('email')} /></div>
          <div><label className="label" htmlFor="password">Password (at least 8 characters)</label><input id="password" className="input" type="password" required minLength={8} autoComplete="new-password" value={form.password} onChange={set('password')} /></div>
          {error && <p role="alert" className="text-sm text-red-700 dark:text-red-400">{error}</p>}
          <button className="btn-primary w-full" disabled={busy}>{busy ? 'One moment…' : 'Join the team'}</button>
        </form>
      )}
    </main>
  );
}
