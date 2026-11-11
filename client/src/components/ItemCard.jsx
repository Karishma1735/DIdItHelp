import { useState } from 'react';
import api, { errorMessage } from '../api';
import StatusBadge from './StatusBadge.jsx';
import { formatDay, formatWhen } from '../dates.js';

export default function ItemCard({ item, readOnly, onChange }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [note, setNote] = useState('');
  const [proofOpen, setProofOpen] = useState(false);
  const [proof, setProof] = useState('');

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

  const deliver = (e) => {
    e.preventDefault();
    run(async () => {
      await post('deliver', { proofUrl: proof });
      setProofOpen(false);
      setProof('');
    });
  };

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

  const drop = () => {
    if (window.confirm('Drop this item? It will count as not delivered for its week.')) run(() => post('drop'));
  };

  return (
    <li className="card space-y-2">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="font-semibold">{item.what}</p>
          <p className="text-sm muted">
            For {item.forWhom}{item.isForMentor ? ' (my mentor)' : ''} · planned {formatDay(item.plannedDay)}
            {item.deliveredLate && ' · delivered late'}
          </p>
        </div>
        <StatusBadge state={item.state} />
      </div>

      {item.proofUrl && (
        <p className="text-sm">
          Proof: <a className="break-all text-cherry-800 underline dark:text-cherry-400" href={item.proofUrl} target="_blank" rel="noreferrer noopener">{item.proofUrl}</a>
        </p>
      )}
      {item.askedAt && (
        <p className="text-xs muted">
          Asked {formatWhen(item.askedAt)} via {item.askedVia === 'email' ? 'email' : 'Slack'}
          {item.reminderSentAt && ` · reminder sent ${formatWhen(item.reminderSentAt)}`}
          {item.answeredAt && ` · answered ${formatWhen(item.answeredAt)}`}
        </p>
      )}
      {item.answer?.comment && (
        <blockquote className="border-l-4 border-cherry-600 pl-3 text-sm italic">“{item.answer.comment}”</blockquote>
      )}
      {item.askError && (
        <p role="alert" className="rounded-lg bg-red-50 p-2 text-sm text-red-800 dark:bg-red-950 dark:text-red-300">
          The question was not sent: {item.askError} Try “Ask again”, or copy the message and send it yourself.
        </p>
      )}
      {error && <p role="alert" className="text-sm text-red-700 dark:text-red-400">{error}</p>}
      {note && <p className="text-sm text-leaf-700 dark:text-leaf-300">{note}</p>}

      {!readOnly && (
        <div className="flex flex-wrap gap-2 pt-1">
          {item.status === 'planned' && !proofOpen && (
            <>
              <button className="btn-primary" onClick={() => setProofOpen(true)}>Mark delivered and ask</button>
              <button className="btn-ghost" onClick={drop} disabled={busy}>Drop</button>
            </>
          )}
          {item.status === 'delivered' && (
            <>
              <button className="btn-ghost" onClick={() => run(() => post('ask'))} disabled={busy}>Ask again</button>
              <button className="btn-ghost" onClick={copyMessage} disabled={busy}>Copy message</button>
            </>
          )}
        </div>
      )}

      {!readOnly && proofOpen && (
        <form onSubmit={deliver} className="space-y-2 rounded-lg bg-wine-100 p-3 dark:bg-wine-800">
          <label className="label" htmlFor={`proof-${item.id}`}>Proof link (PR, live flow or doc). No proof, no delivery.</label>
          <input id={`proof-${item.id}`} className="input" type="url" required placeholder="https://" value={proof} onChange={(e) => setProof(e.target.value)} autoFocus />
          <div className="flex gap-2">
            <button className="btn-primary" disabled={busy}>{busy ? 'Sending…' : 'Mark delivered and ask'}</button>
            <button type="button" className="btn-ghost" onClick={() => setProofOpen(false)}>Cancel</button>
          </div>
        </form>
      )}
    </li>
  );
}
