import { useState } from 'react';
import { Link } from 'react-router-dom';
import api, { errorMessage } from '../api';
import StatusBadge from './StatusBadge.jsx';
import { formatDay, formatWhen } from '../dates.js';

const MAX_BYTES = 20 * 1024 * 1024;
const ACCEPT = '.png,.jpg,.jpeg,.gif,.webp,.pdf,.txt,.md,.csv,.zip,.mp4,.webm';
const isImage = (name) => /\.(png|jpe?g|gif|webp)$/i.test(name);
const sizeText = (n) => (n >= 1024 * 1024 ? `${(n / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`);

export default function ItemCard({ item, readOnly, onChange }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [note, setNote] = useState('');
  const [proofOpen, setProofOpen] = useState(false);
  const [proof, setProof] = useState('');
  const [mode, setMode] = useState('link'); // how the proof is given: a link, or an uploaded file
  const [file, setFile] = useState(null);

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
    if (mode === 'file') {
      if (!file) return setError('Choose a file to upload, or switch to a link.');
      if (file.size > MAX_BYTES) return setError('That file is too large. The limit is 20 MB.');
    }
    run(async () => {
      if (mode === 'file') {
        // The raw file is the request body; its name travels in the address.
        const { data } = await api.post(`/items/${item.id}/deliver-file?name=${encodeURIComponent(file.name)}`, file, {
          headers: { 'Content-Type': 'application/octet-stream' },
          timeout: 180000,
        });
        onChange(data.item);
      } else {
        await post('deliver', { proofUrl: proof });
      }
      setProofOpen(false);
      setProof('');
      setFile(null);
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
    if (window.confirm('Drop this item? It will count as not delivered for its day.')) run(() => post('drop'));
  };

  return (
    <li className="card space-y-2">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="font-semibold">{item.what}</p>
          <p className="text-sm muted">
            For {item.forWhom}{item.isForMentor ? ' (my mentor)' : ''} · planned {formatDay(item.plannedDay)}
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
        <form onSubmit={deliver} className="space-y-2 rounded-lg bg-ink-100 p-3 dark:bg-ink-800">
          <p className="label">Proof. No proof, no delivery.</p>
          <div className="flex gap-1" role="group" aria-label="Kind of proof">
            {[['link', 'A link'], ['file', 'Upload a file']].map(([v, text]) => (
              <button key={v} type="button" aria-pressed={mode === v} onClick={() => { setMode(v); setError(''); }}
                className={`rounded-lg px-3 py-1.5 text-sm font-semibold ${mode === v ? 'bg-steel-700 text-mist-50 dark:bg-steel-600' : 'hover:bg-mist-200 dark:hover:bg-ink-700'}`}>{text}</button>
            ))}
          </div>
          {mode === 'link' ? (
            <>
              <label className="sr-only" htmlFor={`proof-${item.id}`}>Proof link</label>
              <input id={`proof-${item.id}`} className="input" type="url" required placeholder="https:// (PR, live flow or doc)" value={proof} onChange={(e) => setProof(e.target.value)} autoFocus />
            </>
          ) : (
            <>
              <label className="sr-only" htmlFor={`file-${item.id}`}>Proof file</label>
              <input id={`file-${item.id}`} className="input file:mr-3 file:rounded-md file:border-0 file:bg-steel-700 file:px-3 file:py-1 file:text-sm file:font-semibold file:text-mist-50" type="file" accept={ACCEPT} onChange={(e) => { setFile(e.target.files[0] || null); setError(''); }} />
              {file && <p className="text-xs muted">{file.name} · {sizeText(file.size)}</p>}
              <p className="text-xs muted">Images, PDF, text, CSV, zip or short videos, up to 20 MB. For Word or Excel files, use a zip or paste a link. Anyone with the link can open the file, so don’t upload secrets.</p>
            </>
          )}
          <div className="flex gap-2">
            <button className="btn-primary" disabled={busy}>{busy ? (mode === 'file' ? 'Uploading…' : 'Sending…') : 'Mark delivered and ask'}</button>
            <button type="button" className="btn-ghost" onClick={() => setProofOpen(false)}>Cancel</button>
          </div>
        </form>
      )}
    </li>
  );
}
