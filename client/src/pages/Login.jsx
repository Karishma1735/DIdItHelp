import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api, { errorMessage } from '../api';
import { useAuth } from '../auth.jsx';
import ThemeToggle from '../components/ThemeToggle.jsx';
import Brand from '../components/Brand.jsx';

export default function Login() {
  const { signIn } = useAuth();
  const navigate = useNavigate();
  const [hasOwner, setHasOwner] = useState(true);
  const [mode, setMode] = useState('login');
  const [form, setForm] = useState({ name: '', role: '', email: '', password: '' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  useEffect(() => {
    api.get('/auth/status').then((r) => {
      setHasOwner(r.data.hasOwner);
      if (!r.data.hasOwner) setMode('register');
    });
  }, []);

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const { data } = await api.post(`/auth/${mode}`, form);
      signIn(data);
      navigate('/');
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  const register = mode === 'register';
  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center gap-5 p-4">
      <div className="flex items-center justify-between">
        <Brand size="text-2xl" />
        <ThemeToggle />
      </div>
      <p className="font-display text-2xl leading-snug">Measure your work by whether it <em className="text-steel-800 dark:text-steel-300">helped someone</em>, not by how much you did.</p>
      <form onSubmit={submit} className="card space-y-3">
        <h2 className="font-semibold">{register ? 'Create the owner account' : 'Sign in'}</h2>
        {register && (
          <>
            <div><label className="label" htmlFor="name">Your name</label><input id="name" className="input" required value={form.name} onChange={set('name')} /></div>
            <div><label className="label" htmlFor="role">Your role</label><input id="role" className="input" value={form.role} onChange={set('role')} /></div>
          </>
        )}
        <div><label className="label" htmlFor="email">Email</label><input id="email" className="input" type="email" required autoComplete="email" value={form.email} onChange={set('email')} /></div>
        <div><label className="label" htmlFor="password">Password {register && '(at least 8 characters)'}</label><input id="password" className="input" type="password" required minLength={register ? 8 : undefined} autoComplete={register ? 'new-password' : 'current-password'} value={form.password} onChange={set('password')} /></div>
        {error && <p role="alert" className="text-sm text-red-700 dark:text-red-400">{error}</p>}
        <button className="btn-primary w-full" disabled={busy}>{busy ? 'One moment…' : register ? 'Create account' : 'Sign in'}</button>
        {hasOwner && register && <button type="button" className="text-sm underline" onClick={() => setMode('login')}>I already have an account</button>}
      </form>
    </main>
  );
}
