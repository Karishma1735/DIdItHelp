import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import Brand from '../components/Brand.jsx';
import api, { errorMessage } from '../api';

const OPTIONS = [
  { value: 'helped', label: 'Helped', cls: 'bg-leaf-700 text-white hover:bg-leaf-800' },
  { value: 'none', label: 'Didn’t help', cls: 'bg-ink-600 text-white hover:bg-ink-700' },
];
// Older answers (and links in older emails) used lot / little; they still read correctly.
const LABEL = { ...Object.fromEntries(OPTIONS.map((o) => [o.value, o.label])), lot: 'Helped a lot', little: 'Helped a little' };
const VALID = ['helped', 'none', 'lot', 'little'];

export default function Answer() {
  const { token } = useParams();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const [info, setInfo] = useState(null);
  const [fatal, setFatal] = useState('');
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);
  const [changing, setChanging] = useState(false);
  const [comment, setComment] = useState('');
  const [commentSaved, setCommentSaved] = useState(false);
  const started = useRef(false);

  async function send(body) {
    setError('');
    try {
      const { data } = await api.post(`/answer/${token}`, body);
      setInfo(data);
      setComment(data.answer?.comment || '');
      return true;
    } catch (err) {
      setError(errorMessage(err));
      return false;
    }
  }

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    (async () => {
      try {
        const { data } = await api.get(`/answer/${token}`);
        setInfo(data);
        setComment(data.answer?.comment || '');
      } catch (err) {
        return setFatal(errorMessage(err, 'This link is not valid any more.'));
      }
      const v = params.get('v');
      if (VALID.includes(v)) {
        // One tap from the message records the answer straight away.
        if (await send({ value: v })) setSaved(true);
        // Drop ?v from the URL so a reload can't overwrite a later change.
        navigate(`/a/${token}`, { replace: true });
      }
    })();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  if (fatal) return <Shell><h1 className="text-xl font-bold">This link doesn’t work</h1><p className="mt-2 muted">{fatal}</p></Shell>;
  if (!info) return <Shell><p className="muted">Loading…</p></Shell>;

  const answered = info.answer;
  const pick = async (value) => {
    if (await send({ value })) { setSaved(true); setChanging(false); }
  };
  const saveComment = async () => {
    if (await send({ comment })) setCommentSaved(true);
  };

  return (
    <Shell>
      <p className="eyebrow">{info.ownerName} delivered</p>
      <h1 className="mt-1 text-3xl font-semibold">“{info.what}”</h1>
      <p className="mt-3 text-sm">
        Proof: <a className="break-all text-steel-800 underline dark:text-steel-400" href={info.proofUrl} target="_blank" rel="noreferrer noopener">{info.proofUrl}</a>
      </p>

      {error && <p role="alert" className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-800 dark:bg-red-950 dark:text-red-300">{error}</p>}

      {answered && !changing ? (
        <div className="card mt-6 space-y-4">
          <p className="text-lg font-semibold">{saved ? 'Thanks, your answer is saved' : 'You answered'}</p>
          <p>Your answer: <strong>{LABEL[answered.value]}</strong></p>
          <div>
            <label className="label" htmlFor="comment">Add a comment (optional)</label>
            <textarea id="comment" className="input" rows={3} maxLength={1000} value={comment} onChange={(e) => { setComment(e.target.value); setCommentSaved(false); }} />
            <button className="btn-primary mt-2" onClick={saveComment}>Save comment</button>
            {commentSaved && <span className="ml-3 text-sm text-leaf-700 dark:text-leaf-300">Comment saved.</span>}
          </div>
          <button className="text-sm underline" onClick={() => setChanging(true)}>Change my answer</button>
        </div>
      ) : (
        <div className="mt-6 space-y-3">
          <h2 className="text-lg font-semibold">Did it help you?</h2>
          {OPTIONS.map((o) => (
            <button key={o.value} onClick={() => pick(o.value)} className={`btn w-full py-4 text-base ${o.cls}`}>{o.label}</button>
          ))}
          {changing && <button className="text-sm underline" onClick={() => setChanging(false)}>Keep my answer</button>}
        </div>
      )}
    </Shell>
  );
}

function Shell({ children }) {
  return (
    <main className="mx-auto max-w-md p-5 pt-8">
      <div className="mb-8"><Brand /></div>
      {children}
    </main>
  );
}
