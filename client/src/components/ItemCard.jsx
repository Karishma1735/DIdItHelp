import { useState } from 'react';
import { Link } from 'react-router-dom';
import api, { errorMessage } from '../api';
import StatusBadge from './StatusBadge.jsx';
import PlannedActions from './PlannedActions.jsx';
import { sizeText } from './ProofForm.jsx';
import { formatDay, formatWhen, fmtMinutes } from '../dates.js';

const isImage = (name) => /\.(png|jpe?g|gif|webp)$/i.test(name);

export default function ItemCard({ item, readOnly, onChange }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [note, setNote] = useState('');

  async function run(fn) {
    setBusy(true);
    setError('');
    setNote('');
    try {
      await fn();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  const post = (path, body) => api.post(`/items/${item.id}/${path}`, body).then((r) => onChange(r.data.item));

  const copyMessage = () =>
    run(async () => {
      const { data } = await api.post(`/items/${item.id}/message`);
      try {
        await navigator.clipboard.writeText(data.text);
        setNote('Message copied. Paste it into Slack, email or WhatsApp.');
      } catch {
        window.prompt('Copy this message:', data.text);
      }
    });

  return (
    <li className="card space-y-2">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="font-semibold">{item.what}</p>
          <p className="text-sm muted">
            For {item.forWhom}{item.isForMentor ? ' (my manager)' : ''} · planned {formatDay(item.plannedDay)}
            {item.startTime && item.endTime && ` · ${item.startTime}–${item.endTime}`}
            {item.estimateMinutes && ` · ${item.estimateAssumed ? 'about ' : ''}${fmtMinutes(item.estimateMinutes)}`}
            {item.deadlineTime && item.status === 'planned' && ` · by ${item.deadlineTime}`}
            {item.deliveredLate && ' · delivered late'}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {item.pastDeadline && item.state !== 'late' && <span className="rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-semibold text-red-800 dark:bg-red-950 dark:text-red-200">Past deadline</span>}
          <StatusBadge state={item.state} />
        </div>
      </div>

      {item.proofUrl && (
        <div className="space-y-2 text-sm">
          <p>
            Proof:{' '}
            {item.proofFile ? (
              <a className="link break-all" href={item.proofUrl} target="_blank" rel="noreferrer noopener">📎 {item.proofFile.name} <span className="muted no-underline">({sizeText(item.proofFile.size)})</span></a>
            ) : (
              <a className="break-all text-steel-800 underline dark:text-steel-400" href={item.proofUrl} target="_blank" rel="noreferrer noopener">{item.proofUrl}</a>
            )}
          </p>
          {item.proofFile && isImage(item.proofFile.name) && (
            <a href={item.proofUrl} target="_blank" rel="noreferrer noopener">
              <img src={item.proofUrl} alt={`Proof: ${item.proofFile.name}`} loading="lazy" className="max-h-44 rounded-lg border border-mist-300 dark:border-ink-700" />
            </a>
          )}
        </div>
      )}
      {item.askedAt && (
        <p className="text-xs muted">
          Asked {formatWhen(item.askedAt)} via {item.askedVia === 'email' ? 'email' : 'Slack'}
          {item.reminderSentAt && ` · reminder sent ${formatWhen(item.reminderSentAt)}`}
          {item.answeredAt && ` · answered ${formatWhen(item.answeredAt)}`}
        </p>
      )}
      {item.answer?.comment && (
        <blockquote className="border-l-4 border-steel-600 pl-3 text-sm italic">“{item.answer.comment}”</blockquote>
      )}
      {item.reportSentAt && <p className="text-xs muted">Evening report emailed to your manager {formatWhen(item.reportSentAt)}.</p>}
      {item.reportError && (
        <p role="alert" className="rounded-lg bg-amber-100 p-2 text-sm text-amber-900 dark:bg-amber-950 dark:text-amber-200">
          {item.reportError} <Link className="link" to="/integrations">Go to Integrations</Link>
        </p>
      )}
      {item.askError && (
        <p role="alert" className="rounded-lg bg-red-50 p-2 text-sm text-red-800 dark:bg-red-950 dark:text-red-300">
          The question was not sent: {item.askError} Try “Ask again”, or copy the message and send it yourself.
        </p>
      )}
      {error && <p role="alert" className="text-sm text-red-700 dark:text-red-400">{error}</p>}
      {note && <p className="text-sm text-leaf-700 dark:text-leaf-300">{note}</p>}

      {!readOnly && item.status === 'planned' && <PlannedActions item={item} onChange={onChange} />}
      {!readOnly && item.status === 'delivered' && (
        <div className="flex flex-wrap gap-2 pt-1">
          <button className="btn-ghost" onClick={() => run(() => post('ask'))} disabled={busy}>Ask again</button>
          <button className="btn-ghost" onClick={copyMessage} disabled={busy}>Copy message</button>
        </div>
      )}
    </li>
  );
}
