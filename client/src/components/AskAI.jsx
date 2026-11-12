import { useEffect, useRef, useState } from 'react';
import api, { errorMessage } from '../api';
import { useAuth } from '../auth.jsx';
import Markdown from './Markdown.jsx';

const generic = ['Who needs attention today?', 'What is still waiting for an answer?', 'Which items are late?'];

// Manager-only assistant. It answers from the team's real reports and cannot change anything.
export default function AskAI({ members }) {
  const { user } = useAuth();
  const storeKey = `ai-thread-${user.id}`;
  const [threadId, setThreadId] = useState(() => { try { return localStorage.getItem(storeKey) || null; } catch { return null; } });
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const end = useRef(null);

  useEffect(() => {
    if (!threadId) return;
    api.get('/ai/history', { params: { threadId } }).then((r) => setMessages(r.data.messages)).catch(() => {});
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { end.current && end.current.scrollIntoView({ block: 'nearest' }); }, [messages, busy]);

  async function ask(q) {
    const message = (q ?? text).trim();
    if (!message || busy) return;
    setError('');
    setText('');
    setBusy(true);
    setMessages((m) => [...m, { role: 'user', content: message }]);
    try {
      const { data } = await api.post('/ai/ask', { message, threadId: threadId || undefined });
      setMessages((m) => [...m, { role: 'assistant', content: data.answer }]);
      if (data.threadId && data.threadId !== threadId) {
        setThreadId(data.threadId);
        try { localStorage.setItem(storeKey, data.threadId); } catch { /* ignore */ }
      }
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  function fresh() {
    setMessages([]);
    setThreadId(null);
    setError('');
    try { localStorage.removeItem(storeKey); } catch { /* ignore */ }
  }

  const suggestions = [...members.slice(0, 4).map((m) => `Give me ${m.name.split(' ')[0]}'s full report`), ...generic];

  return (
    <section className="card space-y-3" aria-label="Ask AI">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="eyebrow">AI assistant</p>
          <h2 className="text-xl font-semibold">Ask about your team</h2>
        </div>
        {messages.length > 0 && <button className="btn-ghost" onClick={fresh}>New chat</button>}
      </div>
      <p className="text-sm muted">Ask in plain words, for example “give me Ankit’s full report”. It answers from your team’s real reports, can only read, and never sees anyone’s Slack handle or email.</p>

      {messages.length > 0 && (
        <div className="max-h-[28rem] space-y-3 overflow-y-auto rounded-xl bg-mist-100 p-3 dark:bg-ink-950/60">
          {messages.map((m, i) => (
            <div key={i} className={m.role === 'user' ? 'flex justify-end' : ''}>
              <div className={`max-w-full rounded-2xl px-3.5 py-2.5 ${m.role === 'user' ? 'bg-steel-700 text-mist-50 dark:bg-steel-600' : 'bg-mist-50 ring-1 ring-mist-300 dark:bg-ink-900 dark:ring-ink-800'}`}>
                {m.role === 'user' ? <p className="whitespace-pre-wrap text-sm">{m.content}</p> : <Markdown text={m.content} />}
              </div>
            </div>
          ))}
          {busy && <p className="text-sm muted">Reading the reports…</p>}
          <div ref={end} />
        </div>
      )}
      {messages.length === 0 && busy && <p className="text-sm muted">Reading the reports…</p>}

      {messages.length === 0 && (
        <div className="flex flex-wrap gap-2">
          {suggestions.map((s) => (
            <button key={s} className="btn-ghost text-left" onClick={() => ask(s)} disabled={busy}>{s}</button>
          ))}
        </div>
      )}

      {error && <p role="alert" className="text-sm text-red-700 dark:text-red-400">{error}</p>}
      <form onSubmit={(e) => { e.preventDefault(); ask(); }} className="flex gap-2">
        <input className="input" value={text} onChange={(e) => setText(e.target.value)} maxLength={2000} placeholder="Ask about a person or the team" aria-label="Your question" disabled={busy} />
        <button className="btn-primary" disabled={busy || !text.trim()}>{busy ? 'Thinking…' : 'Ask'}</button>
      </form>
    </section>
  );
}
