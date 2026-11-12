import { useState } from 'react';
import api, { errorMessage } from '../api';
import PlannedActions from './PlannedActions.jsx';
import { fmtMinutes } from '../dates.js';

const KINDS = [['meeting', 'Meeting'], ['learning', 'Learning'], ['support', 'Support'], ['admin', 'Admin'], ['other', 'Other']];
const kindLabel = (k) => (KINDS.find(([v]) => v === k) || KINDS[4])[1];
const LENGTHS = [15, 30, 45, 60, 90, 120, 180, 240];

// How full the 8-hour day is. A coverage check for the person and their manager: it is never part of a score.
export function HoursSummary({ hours }) {
  const cap = hours.capacity;
  const scale = Math.max(cap, hours.planned) || 1;
  const w = (n) => `${(n / scale) * 100}%`;
  const tone = hours.status === 'under' || hours.status === 'over' ? 'text-amber-800 dark:text-amber-300' : hours.status === 'full' ? 'text-leaf-700 dark:text-leaf-300' : 'muted';
  const line =
    hours.status === 'empty' ? 'Nothing is planned for this day yet.'
    : hours.status === 'under' ? `${fmtMinutes(hours.planned)} planned of ${fmtMinutes(cap)}. ${fmtMinutes(hours.unplanned)} is still unplanned.`
    : hours.status === 'over' ? `${fmtMinutes(hours.planned)} planned, which is ${fmtMinutes(hours.over)} more than ${fmtMinutes(cap)}.`
    : `${fmtMinutes(cap)} planned. A full day.`;
  return (
    <div className="space-y-2">
      <div
        role="img"
        aria-label={`${fmtMinutes(hours.itemMinutes)} of tasks and ${fmtMinutes(hours.blockMinutes)} of other time, of ${fmtMinutes(cap)}`}
        className="flex h-3 overflow-hidden rounded-full bg-mist-200 dark:bg-ink-800"
      >
        <div className="bg-steel-600 dark:bg-steel-400" style={{ width: w(hours.itemMinutes) }} />
        <div className="bg-steel-300 dark:bg-steel-700" style={{ width: w(hours.blockMinutes) }} />
      </div>
      <p className={`text-sm font-medium ${tone}`}>{line}</p>
      <p className="flex flex-wrap gap-x-4 gap-y-1 text-xs muted">
        <span><span className="mr-1 inline-block h-2 w-2 rounded-full bg-steel-600 dark:bg-steel-400" />Tasks {fmtMinutes(hours.itemMinutes)}</span>
        <span><span className="mr-1 inline-block h-2 w-2 rounded-full bg-steel-300 dark:bg-steel-700" />Meetings, learning, support {fmtMinutes(hours.blockMinutes)}</span>
        {hours.deliveredMinutes > 0 && <span>Delivered so far {fmtMinutes(hours.deliveredMinutes)}</span>}
        {hours.withoutEstimate > 0 && <span>{hours.withoutEstimate} item{hours.withoutEstimate === 1 ? ' has' : 's have'} no time estimate, so not counted</span>}
      </p>
    </div>
  );
}

function BlockForm({ day, onAdded, onClose }) {
  const [form, setForm] = useState({ title: '', minutes: 30, kind: 'meeting', startTime: '' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });
  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      await api.post('/blocks', { ...form, minutes: Number(form.minutes), day, startTime: form.startTime || undefined });
      onAdded();
      onClose();
    } catch (err) {
      setError(errorMessage(err));
      setBusy(false);
    }
  }
  return (
    <form onSubmit={submit} className="space-y-3 rounded-lg bg-ink-100 p-3 dark:bg-ink-800">
      <p className="text-xs muted">Time that has no receiver, like a meeting. It counts toward your 8 hours and is never scored.</p>
      <div className="grid gap-3 sm:grid-cols-4">
        <div className="sm:col-span-2">
          <label className="label" htmlFor="b-title">What is it?</label>
          <input id="b-title" className="input" required maxLength={120} value={form.title} onChange={set('title')} placeholder="Team standup" />
        </div>
        <div>
          <label className="label" htmlFor="b-kind">Kind</label>
          <select id="b-kind" className="input" value={form.kind} onChange={set('kind')}>{KINDS.map(([v, t]) => <option key={v} value={v}>{t}</option>)}</select>
        </div>
        <div>
          <label className="label" htmlFor="b-min">How long</label>
          <select id="b-min" className="input" value={form.minutes} onChange={set('minutes')}>{LENGTHS.map((m) => <option key={m} value={m}>{fmtMinutes(m)}</option>)}</select>
        </div>
      </div>
      <div className="max-w-[10rem]">
        <label className="label" htmlFor="b-start">Starts at (optional)</label>
        <input id="b-start" className="input" type="time" value={form.startTime} onChange={set('startTime')} />
      </div>
      {error && <p role="alert" className="text-sm text-red-700 dark:text-red-400">{error}</p>}
      <div className="flex gap-2">
        <button className="btn-primary" disabled={busy}>{busy ? 'Adding…' : 'Add to my day'}</button>
        <button type="button" className="btn-ghost" onClick={onClose}>Cancel</button>
      </div>
    </form>
  );
}

// The 8-hour card on a day view: the bar, the timeline, and (for the owner) adding or removing meeting time.
export default function DayHours({ data, readOnly, onChange }) {
  const { hours, timeline, blocks, period, today } = data;
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState('');
  if (!hours) return null;
  const editable = !readOnly && period.start >= today;
  const unscheduled = blocks.filter((b) => !b.startTime);

  async function remove(id) {
    setError('');
    try {
      await api.delete(`/blocks/${id}`);
      onChange();
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  const removeButton = (id, label) =>
    editable && (
      <button type="button" className="rounded px-1.5 text-xs muted hover:bg-mist-200 hover:text-red-700 dark:hover:bg-ink-800" aria-label={`Remove ${label}`} onClick={() => remove(id)}>Remove</button>
    );

  return (
    <section className="card space-y-4" aria-label="The 8-hour day">
      <h2 className="flex items-baseline gap-3 text-xl font-semibold">
        Your {fmtMinutes(hours.capacity)} day
        <span className="font-mono text-xs font-normal uppercase tracking-wider muted">coverage, not a score</span>
      </h2>
      <HoursSummary hours={hours} />

      {(timeline.length > 0 || unscheduled.length > 0) && (
        <ol className="divide-y divide-mist-300 rounded-xl border border-mist-300 dark:divide-ink-800 dark:border-ink-800">
          {timeline.map((e) => (
            <li key={`${e.type}-${e.id}`} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2 text-sm">
              <span className="w-28 shrink-0 font-mono text-xs">{e.start}–{e.end}</span>
              <span className={`min-w-0 flex-1 ${e.type === 'task' && e.status === 'delivered' ? 'line-through decoration-leaf-600/50' : 'font-medium'}`}>{e.label}</span>
              {e.type === 'block'
                ? <span className="rounded-full bg-mist-200 px-2 py-0.5 text-xs font-semibold text-ink-700 dark:bg-ink-800 dark:text-mist-200">{kindLabel(e.kind)}</span>
                : <span className="text-xs muted">{e.status === 'delivered' ? 'Delivered' : 'Task'}</span>}
              <span className="text-xs muted">{fmtMinutes(e.minutes)}</span>
              {e.type === 'block' && removeButton(e.id, e.label)}
              {e.type === 'task' && e.status === 'planned' && !readOnly && (
                <div className="basis-full pl-0 sm:pl-[7.75rem]"><PlannedActions item={{ id: e.id }} onChange={onChange} small /></div>
              )}
            </li>
          ))}
          {unscheduled.map((b) => (
            <li key={`b-${b.id}`} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2 text-sm">
              <span className="w-28 shrink-0 font-mono text-xs muted">no set time</span>
              <span className="min-w-0 flex-1 font-medium">{b.title}</span>
              <span className="rounded-full bg-mist-200 px-2 py-0.5 text-xs font-semibold text-ink-700 dark:bg-ink-800 dark:text-mist-200">{kindLabel(b.kind)}</span>
              <span className="text-xs muted">{fmtMinutes(b.minutes)}</span>
              {removeButton(b.id, b.title)}
            </li>
          ))}
        </ol>
      )}
      {error && <p role="alert" className="text-sm text-red-700 dark:text-red-400">{error}</p>}

      {editable && !adding && <button className="btn-ghost" onClick={() => setAdding(true)}>Add a meeting, learning or support time</button>}
      {editable && adding && <BlockForm day={period.start} onAdded={onChange} onClose={() => setAdding(false)} />}
    </section>
  );
}
