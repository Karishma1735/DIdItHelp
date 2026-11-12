import { useState } from 'react';
import api, { errorMessage } from '../api';
import ProofForm from './ProofForm.jsx';
import { endOf, fmtMinutes, formatDay, toMin } from '../dates.js';

const KINDS = [['meeting', 'Meeting'], ['learning', 'Learning'], ['support', 'Support'], ['admin', 'Admin'], ['other', 'Other']];
const EXAMPLE = 'CRM plugs for Rahul 2h, docs for Priya 1h, standup at 10:30 for 30 min, learn Rust 1.5h (no receiver)';

const toRows = (draft) =>
  draft.items.map((x, i) => ({
    key: i,
    type: x.type,
    what: x.what || '',
    title: x.title || '',
    minutes: String(x.minutes),
    assumed: !!x.assumed,
    forWhom: x.forWhom || '',
    contact: x.contact || '',
    noReceiver: !!x.noReceiver,
    kind: x.kind || 'other',
    start: x.start || '',
    done: false,
    error: '',
  }));

const nameOf = (r) => (r.type === 'task' ? r.what : r.title).trim() || (r.type === 'task' ? 'this task' : 'this block');

// Which rows overlap another row in the draft, so the person can fix the timeline. Only a warning.
function overlapsOf(rows) {
  const spans = rows
    .filter((r) => !r.done && r.start && Number(r.minutes) > 0)
    .map((r) => ({ key: r.key, s: toMin(r.start), e: toMin(r.start) + Number(r.minutes), label: nameOf(r) }));
  const out = {};
  spans.forEach((a) => spans.forEach((b) => {
    if (a.key < b.key && a.s < b.e && b.s < a.e) {
      out[a.key] = out[a.key] || b.label;
      out[b.key] = out[b.key] || a.label;
    }
  }));
  return out;
}

function Field({ id, label, children, className = '' }) {
  return (
    <div className={className}>
      <label className="label" htmlFor={id}>{label}</label>
      {children}
    </div>
  );
}

function DraftRow({ row, overlap, onChange, onRemove, managerName }) {
  const id = `d${row.key}`;
  const set = (k) => (e) => onChange({ [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value });
  const end = endOf(row.start, Number(row.minutes));
  const isTask = row.type === 'task';
  return (
    <li className={`space-y-3 rounded-xl border p-3 ${row.done ? 'border-leaf-300 bg-leaf-50 dark:border-leaf-800 dark:bg-leaf-800/20' : 'border-mist-300 bg-mist-50 dark:border-ink-800 dark:bg-ink-950/50'}`}>
      <div className="flex items-center justify-between gap-2">
        <span className="rounded-full bg-mist-200 px-2.5 py-0.5 text-xs font-semibold text-ink-700 dark:bg-ink-800 dark:text-mist-200">
          {isTask ? 'Task, scored' : `${(KINDS.find(([v]) => v === row.kind) || KINDS[4])[1]}, not scored`}
        </span>
        {row.done ? <span className="text-sm font-semibold text-leaf-700 dark:text-leaf-300">Added ✓</span> : (
          <button type="button" className="btn-ghost !px-2.5 !py-1 text-xs" onClick={onRemove} aria-label={`Remove ${nameOf(row)} from the draft`}>Remove</button>
        )}
      </div>
      {!row.done && (
        <>
          <div className="grid gap-3 sm:grid-cols-7">
            <Field id={`${id}-n`} label={isTask ? 'What will you deliver?' : 'What is it?'} className="sm:col-span-3">
              <input id={`${id}-n`} className="input" maxLength={isTask ? 300 : 120} value={isTask ? row.what : row.title} onChange={set(isTask ? 'what' : 'title')} />
            </Field>
            <Field id={`${id}-m`} label="Minutes" className="sm:col-span-1">
              <input id={`${id}-m`} className="input" type="number" min="5" max="720" step="5" value={row.minutes} onChange={(e) => onChange({ minutes: e.target.value, assumed: false })} />
            </Field>
            <Field id={`${id}-s`} label="Starts" className="sm:col-span-2">
              <input id={`${id}-s`} className="input" type="time" value={row.start} onChange={set('start')} />
            </Field>
            <div className="sm:col-span-1">
              <p className="label">{isTask ? 'Deadline' : 'Ends'}</p>
              <p className="py-2 font-mono text-sm">{end || '—'}</p>
            </div>
          </div>
          {!isTask && (
            <Field id={`${id}-k`} label="Kind" className="max-w-[12rem]">
              <select id={`${id}-k`} className="input" value={row.kind} onChange={set('kind')}>{KINDS.map(([v, t]) => <option key={v} value={v}>{t}</option>)}</select>
            </Field>
          )}
          {isTask && (
            <>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={row.noReceiver} onChange={set('noReceiver')} />
                No clear receiver, so the question goes to my manager{managerName ? ` (${managerName})` : ''}
              </label>
              {!row.noReceiver && (
                <div className="grid gap-3 sm:grid-cols-2">
                  <Field id={`${id}-f`} label="Who is it for?"><input id={`${id}-f`} className="input" value={row.forWhom} onChange={set('forWhom')} placeholder="Rahul" /></Field>
                  <Field id={`${id}-c`} label="How to reach them"><input id={`${id}-c`} className="input" value={row.contact} onChange={set('contact')} placeholder="@rahul or rahul@company.com" /></Field>
                </div>
              )}
            </>
          )}
          {!end && row.start && <p className="text-sm text-amber-800 dark:text-amber-300">This would run past midnight. Start it earlier or make it shorter.</p>}
          {!row.start && <p className="text-sm text-amber-800 dark:text-amber-300">There is no free slot left today. Pick a start time yourself.</p>}
          {row.assumed && <p className="text-xs muted">I guessed the time (an hour) because you didn’t say. Change it if that’s wrong.</p>}
          {overlap && <p className="text-sm text-amber-800 dark:text-amber-300">This overlaps with “{overlap}”.</p>}
        </>
      )}
      {row.error && <p role="alert" className="text-sm text-red-700 dark:text-red-400">{row.error}</p>}
    </li>
  );
}

function DraftHours({ hours, newMinutes }) {
  const total = hours.alreadyPlanned + newMinutes;
  const cap = hours.capacity;
  const scale = Math.max(cap, total) || 1;
  const under = total < cap;
  const over = total > cap;
  return (
    <div className="space-y-2" aria-live="polite">
      <div role="img" aria-label={`${fmtMinutes(total)} planned of ${fmtMinutes(cap)}`} className="flex h-3 overflow-hidden rounded-full bg-mist-200 dark:bg-ink-800">
        <div className="bg-steel-300 dark:bg-steel-700" style={{ width: `${(hours.alreadyPlanned / scale) * 100}%` }} />
        <div className="bg-steel-600 dark:bg-steel-400" style={{ width: `${(newMinutes / scale) * 100}%` }} />
      </div>
      <p className={`text-sm font-medium ${under || over ? 'text-amber-800 dark:text-amber-300' : 'text-leaf-700 dark:text-leaf-300'}`}>
        {under && `With this plan your day is ${fmtMinutes(total)} of ${fmtMinutes(cap)}. ${fmtMinutes(cap - total)} would still be unplanned. This is only a warning.`}
        {over && `With this plan your day is ${fmtMinutes(total)}, which is ${fmtMinutes(total - cap)} more than ${fmtMinutes(cap)}. This is only a warning.`}
        {!under && !over && `With this plan your day is a full ${fmtMinutes(cap)}.`}
      </p>
      {hours.alreadyPlanned > 0 && <p className="text-xs muted">That includes {fmtMinutes(hours.alreadyPlanned)} already on your day.</p>}
    </div>
  );
}

// One finished-work match: the person confirms it by clicking. A task is never marked done without a link or a file.
function MatchCard({ match, onDone, onDismiss }) {
  return (
    <li className="space-y-2 rounded-xl border border-mist-300 bg-mist-50 p-3 dark:border-ink-800 dark:bg-ink-950/50">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="font-semibold">{match.what}</p>
          <p className="text-sm muted">For {match.forWhom}</p>
        </div>
        <button type="button" className="btn-ghost !px-2.5 !py-1 text-xs" onClick={onDismiss}>Not this one</button>
      </div>
      {match.needsProof
        ? <p className="text-sm text-amber-800 dark:text-amber-300">You didn’t give a proof link. Add a link or upload a file below. A task is never marked delivered without proof.</p>
        : <p className="text-sm muted">I found this link in what you wrote. Check it, then confirm.</p>}
      <ProofForm itemId={match.itemId} initialUrl={match.proofUrl || ''} submitLabel="Mark delivered and ask" onDone={onDone} />
    </li>
  );
}

export default function PlanAssistant({ day, isToday, hasOpen, managerName, onChange }) {
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [note, setNote] = useState('');
  const [draft, setDraft] = useState(null);
  const [rows, setRows] = useState([]);
  const [adding, setAdding] = useState(false);

  const [doneText, setDoneText] = useState('');
  const [doneBusy, setDoneBusy] = useState(false);
  const [doneError, setDoneError] = useState('');
  const [matches, setMatches] = useState(null);
  const [doneNote, setDoneNote] = useState('');

  async function makeDraft(e) {
    e.preventDefault();
    setBusy(true);
    setError('');
    setNote('');
    try {
      const { data } = await api.post('/planner/draft', { text, day }, { timeout: 70000 });
      setDraft(data);
      setRows(toRows(data));
    } catch (err) {
      setError(errorMessage(err, 'The planner did not answer. You can still add tasks by hand below.'));
    } finally {
      setBusy(false);
    }
  }

  const patchRow = (key, patch) => setRows((rs) => rs.map((r) => (r.key === key ? { ...r, ...patch, error: '' } : r)));
  const removeRow = (key) => setRows((rs) => rs.filter((r) => r.key !== key));

  const clear = () => { setDraft(null); setRows([]); };

  // Nothing is created until this click. Each row goes through the normal, validated routes.
  async function addAll() {
    const problems = {};
    rows.filter((r) => !r.done).forEach((r) => {
      const minutes = Number(r.minutes);
      if (!(r.type === 'task' ? r.what : r.title).trim()) problems[r.key] = 'Say what this is.';
      else if (!Number.isInteger(minutes) || minutes < 5 || minutes > 720) problems[r.key] = 'The time must be between 5 minutes and 12 hours.';
      else if (!r.start || !endOf(r.start, minutes)) problems[r.key] = 'Pick a start time that ends before midnight.';
      else if (r.type === 'task' && !r.noReceiver && (!r.forWhom.trim() || !r.contact.trim())) problems[r.key] = 'Who is it for, and how can they be reached? Or tick “No clear receiver”.';
    });
    if (Object.keys(problems).length) {
      setRows((rs) => rs.map((r) => (problems[r.key] ? { ...r, error: problems[r.key] } : r)));
      setError('Fix the rows marked in red, then add your plan.');
      return;
    }
    setAdding(true);
    setError('');
    let added = 0;
    const next = [...rows];
    for (let i = 0; i < next.length; i += 1) {
      const r = next[i];
      if (r.done) continue;
      const minutes = Number(r.minutes);
      try {
        if (r.type === 'task') {
          await api.post('/items', {
            what: r.what.trim(),
            forWhom: r.noReceiver ? '' : r.forWhom.trim(),
            contact: r.noReceiver ? '' : r.contact.trim(),
            isForMentor: r.noReceiver,
            plannedDay: day,
            deadlineTime: endOf(r.start, minutes),
            estimateMinutes: minutes,
            startTime: r.start,
            estimateAssumed: r.assumed,
          });
        } else {
          await api.post('/blocks', { title: r.title.trim(), minutes, day, kind: r.kind, startTime: r.start });
        }
        next[i] = { ...r, done: true, error: '' };
        added += 1;
      } catch (err) {
        next[i] = { ...r, error: errorMessage(err) };
      }
      setRows([...next]);
    }
    setAdding(false);
    onChange();
    if (next.every((r) => r.done)) {
      setNote(`Added ${added} item${added === 1 ? '' : 's'} to your plan for ${formatDay(day)}.`);
      setText('');
      clear();
    } else {
      setError('Some rows could not be added. They are marked below. The rest are in your plan already.');
    }
  }

  async function findFinished(e) {
    e.preventDefault();
    setDoneBusy(true);
    setDoneError('');
    setDoneNote('');
    try {
      const { data } = await api.post('/planner/complete', { text: doneText }, { timeout: 70000 });
      setMatches(data.matches);
    } catch (err) {
      setMatches(null);
      setDoneError(errorMessage(err, 'The planner did not answer. You can mark a task delivered on its own card below.'));
    } finally {
      setDoneBusy(false);
    }
  }

  const dismiss = (id) => {
    const left = matches.filter((m) => m.itemId !== id);
    setMatches(left.length ? left : null);
    return left;
  };
  const confirmed = (id) => {
    if (!dismiss(id).length) { setDoneText(''); setDoneNote('Marked delivered and asked. Check the item below to see how the question went.'); }
    onChange();
  };

  const overlaps = overlapsOf(rows);
  const newMinutes = rows.reduce((s, r) => s + (Number(r.minutes) || 0), 0);

  return (
    <section className="card space-y-4" aria-label="AI day planner">
      <div>
        <h2 className="flex items-baseline gap-3 text-xl font-semibold">
          Plan my day
          <span className="font-mono text-xs font-normal uppercase tracking-wider muted">AI planner · {formatDay(day)}</span>
        </h2>
        <p className="mt-1 text-sm muted">
          Write what you will do and how long each thing takes, in your own words. I will split tasks from meetings, put them on a timeline and show you a draft. Nothing is added until you click “Add to my plan”.
        </p>
      </div>

      {!draft && (
        <form onSubmit={makeDraft} className="space-y-2">
          <label className="label" htmlFor="plan-text">Your plan for the day</label>
          <textarea id="plan-text" className="input min-h-[7rem]" required maxLength={4000} value={text} onChange={(e) => setText(e.target.value)} placeholder={EXAMPLE} />
          <div className="flex flex-wrap items-center gap-3">
            <button className="btn-primary" disabled={busy || !text.trim()}>{busy ? 'Planning…' : 'Make my plan'}</button>
            {busy && <span className="text-sm muted">This takes a few seconds.</span>}
          </div>
        </form>
      )}
      {note && <p role="status" className="text-sm font-medium text-leaf-700 dark:text-leaf-300">{note}</p>}
      {error && <p role="alert" className="text-sm text-red-700 dark:text-red-400">{error}</p>}

      {draft && (
        <div className="space-y-3">
          <h3 className="text-lg font-semibold">Your draft</h3>
          <p className="text-sm muted">Check each line and change anything that is wrong. Lunch (13:00–14:00) is left free. The deadline is the end of the slot.</p>
          {draft.questions.length > 0 && (
            <div className="rounded-lg bg-amber-100 p-3 text-sm text-amber-900 dark:bg-amber-950 dark:text-amber-200">
              <p className="font-semibold">A few things to check</p>
              <ul className="mt-1 list-disc space-y-0.5 pl-5">{draft.questions.map((q) => <li key={q}>{q}</li>)}</ul>
            </div>
          )}
          {rows.length === 0 ? <p className="text-sm muted">The draft is empty.</p> : (
            <ul className="space-y-3">
              {rows.map((r) => (
                <DraftRow key={r.key} row={r} overlap={overlaps[r.key]} managerName={managerName} onChange={(p) => patchRow(r.key, p)} onRemove={() => removeRow(r.key)} />
              ))}
            </ul>
          )}
          <DraftHours hours={draft.hours} newMinutes={newMinutes} />
          <div className="flex flex-wrap gap-2">
            {rows.some((r) => !r.done) && <button className="btn-primary" onClick={addAll} disabled={adding}>{adding ? 'Adding…' : 'Add to my plan'}</button>}
            <button className="btn-ghost" onClick={clear} disabled={adding}>{rows.length && rows.every((r) => r.done) ? 'Close' : 'Start over'}</button>
          </div>
          <p className="text-xs muted">Once added, the day and the deadline can’t be changed. You get one reminder when a deadline passes.</p>
        </div>
      )}

      {isToday && hasOpen && (
        <div className="space-y-3 border-t border-mist-300 pt-4 dark:border-ink-800">
          <h3 className="text-lg font-semibold">Finished something?</h3>
          <p className="text-sm muted">Tell me what is done and paste the proof link, like “CRM plugs done, proof https://…”. I will find the task. You confirm it, and I never mark anything delivered myself.</p>
          <form onSubmit={findFinished} className="space-y-2">
            <label className="label" htmlFor="done-text">What did you finish?</label>
            <textarea id="done-text" className="input min-h-[4.5rem]" required maxLength={4000} value={doneText} onChange={(e) => setDoneText(e.target.value)} placeholder="CRM plugs are done, proof is https://github.com/…" />
            <button className="btn-ghost" disabled={doneBusy || !doneText.trim()}>{doneBusy ? 'Looking…' : 'Find the task'}</button>
          </form>
          {doneError && <p role="alert" className="text-sm text-red-700 dark:text-red-400">{doneError}</p>}
          {doneNote && <p role="status" className="text-sm font-medium text-leaf-700 dark:text-leaf-300">{doneNote}</p>}
          {matches && (
            <ul className="space-y-3" aria-label="Tasks I found">
              {matches.map((m) => (
                <MatchCard key={m.itemId} match={m} onDone={() => confirmed(m.itemId)} onDismiss={() => dismiss(m.itemId)} />
              ))}
            </ul>
          )}
        </div>
      )}
    </section>
  );
}
