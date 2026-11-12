import { useId, useState } from 'react';
import api, { errorMessage } from '../api';

const MAX_BYTES = 20 * 1024 * 1024;
const ACCEPT = '.png,.jpg,.jpeg,.gif,.webp,.pdf,.txt,.md,.csv,.zip,.mp4,.webm';
export const sizeText = (n) => (n >= 1024 * 1024 ? `${(n / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`);

// Marks one item delivered. The proof is a link or an uploaded file: with neither, nothing is sent.
// Used by the item card and by the planner's "Mark delivered" cards.
export default function ProofForm({ itemId, initialUrl = '', submitLabel = 'Mark delivered and ask', onDone, onCancel, autoFocus }) {
  const uid = useId();
  const [proof, setProof] = useState(initialUrl);
  const [mode, setMode] = useState('link'); // a link, or an uploaded file
  const [file, setFile] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function submit(e) {
    e.preventDefault();
    if (mode === 'file') {
      if (!file) return setError('Choose a file to upload, or switch to a link.');
      if (file.size > MAX_BYTES) return setError('That file is too large. The limit is 20 MB.');
    }
    setBusy(true);
    setError('');
    try {
      let data;
      if (mode === 'file') {
        // The raw file is the request body; its name travels in the address.
        ({ data } = await api.post(`/items/${itemId}/deliver-file?name=${encodeURIComponent(file.name)}`, file, {
          headers: { 'Content-Type': 'application/octet-stream' },
          timeout: 180000,
        }));
      } else {
        ({ data } = await api.post(`/items/${itemId}/deliver`, { proofUrl: proof }));
      }
      onDone(data.item);
    } catch (err) {
      setError(errorMessage(err));
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-2 rounded-lg bg-ink-100 p-3 dark:bg-ink-800">
      <p className="label">Proof. No proof, no delivery.</p>
      <div className="flex gap-1" role="group" aria-label="Kind of proof">
        {[['link', 'A link'], ['file', 'Upload a file']].map(([v, text]) => (
          <button key={v} type="button" aria-pressed={mode === v} onClick={() => { setMode(v); setError(''); }}
            className={`rounded-lg px-3 py-1.5 text-sm font-semibold ${mode === v ? 'bg-steel-700 text-mist-50 dark:bg-steel-600' : 'hover:bg-mist-200 dark:hover:bg-ink-700'}`}>{text}</button>
        ))}
      </div>
      {mode === 'link' ? (
        <>
          <label className="sr-only" htmlFor={`${uid}-proof`}>Proof link</label>
          <input id={`${uid}-proof`} className="input" type="url" required placeholder="https:// (PR, live flow or doc)" value={proof} onChange={(e) => setProof(e.target.value)} autoFocus={autoFocus} />
        </>
      ) : (
        <>
          <label className="sr-only" htmlFor={`${uid}-file`}>Proof file</label>
          <input id={`${uid}-file`} className="input file:mr-3 file:rounded-md file:border-0 file:bg-steel-700 file:px-3 file:py-1 file:text-sm file:font-semibold file:text-mist-50" type="file" accept={ACCEPT} onChange={(e) => { setFile(e.target.files[0] || null); setError(''); }} />
          {file && <p className="text-xs muted">{file.name} · {sizeText(file.size)}</p>}
          <p className="text-xs muted">Images, PDF, text, CSV, zip or short videos, up to 20 MB. For Word or Excel files, use a zip or paste a link. Anyone with the link can open the file, so don’t upload secrets.</p>
        </>
      )}
      {error && <p role="alert" className="text-sm text-red-700 dark:text-red-400">{error}</p>}
      <div className="flex gap-2">
        <button className="btn-primary" disabled={busy}>{busy ? (mode === 'file' ? 'Uploading…' : 'Sending…') : submitLabel}</button>
        {onCancel && <button type="button" className="btn-ghost" onClick={onCancel}>Cancel</button>}
      </div>
    </form>
  );
}
