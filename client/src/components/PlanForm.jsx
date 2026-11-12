import { useState } from 'react';
import api, { errorMessage } from '../api';

export default function PlanForm({ today, mentorName, onCreated }) {
  const empty = { what: '', forWhom: '', contact: '', plannedDay: today, deadlineTime: '17:00', isForMentor: false };
  const [form, setForm] = useState(empty);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value });

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      await api.post('/items', form);
      setForm({ ...empty, plannedDay: form.plannedDay, deadlineTime: form.deadlineTime });
      onCreated();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="card space-y-3">
      <h2 className="text-lg font-bold">Plan something to deliver</h2>
      <div>
        <label className="label" htmlFor="what">What will you deliver?</label>
        <input id="what" className="input" required maxLength={300} value={form.what} onChange={set('what')} placeholder="Zoho plug" />
      </div>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={form.isForMentor} onChange={set('isForMentor')} />
        For: my mentor{mentorName ? ` (${mentorName})` : ''} — no clear receiver, so the question goes to them
      </label>
      {!form.isForMentor && (
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="label" htmlFor="forWhom">Who is it for?</label>
            <input id="forWhom" className="input" required value={form.forWhom} onChange={set('forWhom')} placeholder="Rahul" />
          </div>
          <div>
            <label className="label" htmlFor="contact">How to reach them</label>
            <input id="contact" className="input" required value={form.contact} onChange={set('contact')} placeholder="@rahul or rahul@company.com" />
          </div>
        </div>
      )}
      <div className="grid max-w-md gap-3 sm:grid-cols-2">
        <div>
          <label className="label" htmlFor="day">Planned day</label>
          <input id="day" className="input" type="date" required min={today} value={form.plannedDay} onChange={set('plannedDay')} />
        </div>
        <div>
          <label className="label" htmlFor="deadline">Deadline time</label>
          <input id="deadline" className="input" type="time" required value={form.deadlineTime} onChange={set('deadlineTime')} />
        </div>
      </div>
      <p className="-mt-1 text-xs muted">The day and the deadline can’t be changed later. You get one reminder when the deadline passes.</p>
      {error && <p role="alert" className="text-sm text-red-700 dark:text-red-400">{error}</p>}
      <button className="btn-primary" disabled={busy}>{busy ? 'Saving…' : 'Add to my plan'}</button>
    </form>
  );
}
