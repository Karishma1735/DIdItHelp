import { useState } from 'react';
import api, { errorMessage } from '../api';
import ProofForm from './ProofForm.jsx';

// The two things you can do with work that is still planned: deliver it (with proof, then the receiver is asked) or drop it.
// Used on the item card and on the timeline, so both behave the same.
export default function PlannedActions({ item, onChange, small = false }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [proofOpen, setProofOpen] = useState(false);
  const size = small ? '!px-2.5 !py-1 text-xs' : '';

  async function drop() {
    if (!window.confirm('Drop this item? It will count as not delivered for its day.')) return;
    setBusy(true);
    setError('');
    try {
      const { data } = await api.post(`/items/${item.id}/drop`);
      onChange(data.item);
    } catch (err) {
      setError(errorMessage(err));
      setBusy(false);
    }
  }

  return (
    <div className="space-y-2">
      {!proofOpen && (
        <div className="flex flex-wrap gap-2">
          <button className={`btn-primary ${size}`} onClick={() => setProofOpen(true)}>Mark delivered and ask</button>
          <button className={`btn-ghost ${size}`} onClick={drop} disabled={busy}>Drop</button>
        </div>
      )}
      {error && <p role="alert" className="text-sm text-red-700 dark:text-red-400">{error}</p>}
      {proofOpen && <ProofForm itemId={item.id} autoFocus onCancel={() => setProofOpen(false)} onDone={(updated) => { setProofOpen(false); onChange(updated); }} />}
    </div>
  );
}
