import { useState } from 'react';
import api, { errorMessage } from '../api';
import { endOf, fmtMinutes } from '../dates.js';

const LENGTHS = [15, 30, 45, 60, 90, 120, 180, 240, 360, 480];

export default function PlanForm({ today, defaultDay, managerName, onCreated }) {
  const empty = { what: '', forWhom: '', contact: '', plannedDay: defaultDay || today, deadlineTime: '17:00', isForMentor: false, estimateMinutes: '', startTime: '' };
  const [form, setForm] = useState(empty);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [deadlineTouched, setDeadlineTouched] = useState(false);
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value });
  // With a start time and a length, the deadline follows the end of the slot until the person sets it themselves.
  const setSlot = (k) => (e) => {
    const next = { ...form, [k]: e.target.value };
    if (k === 'estimateMinutes' && !e.target.value) next.startTime = '';
    const slotEnd = endOf(next.startTime, Number(next.estimateMinutes));
    if (slotEnd && !deadlineTouched) next.deadlineTime = slotEnd;
    setForm(next);
  };
  const end = endOf(form.startTime, Number(form.estimateMinutes));

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const { estimateMinutes, startTime, ...rest } = form;
      await api.post('/items', { ...rest, ...(estimateMinutes ? { estimateMinutes: Number(estimateMinutes), ...(startTime ? { startTime } : {}) } : {}) });
      setForm({ ...empty, plannedDay: form.plannedDay, deadlineTime: form.deadlineTime });
      setDeadlineTouched(false);
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
        For: my manager{managerName ? ` (${managerName})` : ''}. No clear receiver, so the question goes to them
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
      <div className="grid max-w-2xl gap-3 sm:grid-cols-4">
        <div>
          <label className="label" htmlFor="day">Planned day</label>
          <input id="day" className="input" type="date" required min={today} value={form.plannedDay} onChange={set('plannedDay')} />
        </div>
        <div>
          <label className="label" htmlFor="estimate">Time needed</label>
          <select id="estimate" className="input" value={form.estimateMinutes} onChange={setSlot('estimateMinutes')}>
            <option value="">Not sure</option>
            {LENGTHS.map((m) => <option key={m} value={m}>{fmtMinutes(m)}</option>)}
          </select>
        </div>
        <div>
          <label className="label" htmlFor="start">Starts at</label>
          <input id="start" className="input" type="time" disabled={!form.estimateMinutes} value={form.startTime} onChange={setSlot('startTime')} />
        </div>
        <div>
          <label className="label" htmlFor="deadline">Deadline time</label>
          <input id="deadline" className="input" type="time" required value={form.deadlineTime} onChange={(e) => { setDeadlineTouched(true); set('deadlineTime')(e); }} />
        </div>
      </div>
      <p className="-mt-1 text-xs muted">
        {end ? `This takes ${form.startTime}–${end}. ` : 'Add the time needed and a start time to place it on your timeline. '}
        The day, the deadline and the time can’t be changed later. You get one reminder when the deadline passes.
      </p>
      {error && <p role="alert" className="text-sm text-red-700 dark:text-red-400">{error}</p>}
      <button className="btn-primary" disabled={busy}>{busy ? 'Saving…' : 'Add to my plan'}</button>
    </form>
  );
}
