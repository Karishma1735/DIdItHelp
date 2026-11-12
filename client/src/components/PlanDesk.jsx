import { useState } from 'react';
import PlanAssistant from './PlanAssistant.jsx';
import PlanForm from './PlanForm.jsx';
import { formatDay } from '../dates.js';

const MODES = [['ai', 'Plan with AI'], ['hand', 'Add by hand']];

const remembered = () => {
  try { return localStorage.getItem('planMode') === 'hand' ? 'hand' : 'ai'; } catch { return 'ai'; }
};

// Planning is a choice: let the AI turn what you write into a plan, or add things one at a time yourself.
// Both panels stay mounted, so a draft in progress is not lost when you look at the other one.
export default function PlanDesk({ day, today, managerName, onChange }) {
  const [mode, setMode] = useState(remembered);
  const pick = (m) => {
    setMode(m);
    try { localStorage.setItem('planMode', m); } catch { /* the choice just isn't remembered */ }
  };
  return (
    <section className="card space-y-4" aria-label="Plan your day">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="flex items-baseline gap-3 text-xl font-semibold">
          Plan my day
          <span className="font-mono text-xs font-normal uppercase tracking-wider muted">{formatDay(day)}</span>
        </h2>
        <div role="tablist" aria-label="How do you want to plan?" className="flex gap-1 rounded-xl bg-mist-200 p-1 dark:bg-ink-800">
          {MODES.map(([v, text]) => (
            <button
              key={v}
              role="tab"
              id={`plan-tab-${v}`}
              aria-selected={mode === v}
              aria-controls={`plan-panel-${v}`}
              onClick={() => pick(v)}
              className={`rounded-lg px-3.5 py-1.5 text-sm font-semibold transition ${mode === v ? 'bg-steel-700 text-mist-50 shadow-sm dark:bg-steel-600' : 'text-ink-700 hover:bg-mist-300 dark:text-mist-200 dark:hover:bg-ink-700'}`}
            >
              {text}
            </button>
          ))}
        </div>
      </div>
      <div role="tabpanel" id="plan-panel-ai" aria-labelledby="plan-tab-ai" hidden={mode !== 'ai'}>
        <PlanAssistant day={day} managerName={managerName} onChange={onChange} />
      </div>
      <div role="tabpanel" id="plan-panel-hand" aria-labelledby="plan-tab-hand" hidden={mode !== 'hand'}>
        <PlanForm today={today} defaultDay={day} managerName={managerName} onCreated={onChange} />
      </div>
    </section>
  );
}
