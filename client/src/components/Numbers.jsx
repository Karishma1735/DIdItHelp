const pct = (v) => (v === null || v === undefined ? '—' : `${v}%`);

function Ring({ value }) {
  const r = 26;
  const c = 2 * Math.PI * r;
  const filled = value === null || value === undefined ? 0 : (value / 100) * c;
  return (
    <svg viewBox="0 0 64 64" className="h-16 w-16 shrink-0 -rotate-90" aria-hidden="true">
      <circle cx="32" cy="32" r={r} fill="none" strokeWidth="7" className="stroke-mist-300 dark:stroke-ink-700" />
      <circle cx="32" cy="32" r={r} fill="none" strokeWidth="7" strokeLinecap="round" strokeDasharray={`${filled} ${c}`} className="stroke-steel-600 dark:stroke-steel-400" />
    </svg>
  );
}

function Stat({ label, value, note, visual }) {
  return (
    <div className="card flex flex-col justify-between gap-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="eyebrow">{label}</p>
          <p className="mt-1 font-display text-5xl font-semibold leading-none">{value}</p>
        </div>
        {visual}
      </div>
      <p className="text-xs leading-relaxed muted">{note}</p>
    </div>
  );
}

export default function Numbers({ numbers }) {
  return (
    <div className="grid gap-4 sm:grid-cols-3">
      <Stat
        label="Impact"
        value={<>{numbers.impact}<span className="ml-1 text-xl font-medium text-ink-500">pts</span></>}
        note={numbers.explanations.impact}
      />
      <Stat label="Reliability" value={pct(numbers.reliability)} note={numbers.explanations.reliability} visual={<Ring value={numbers.reliability} />} />
      <Stat label="Answer rate" value={pct(numbers.answerRate)} note={numbers.explanations.answerRate} visual={<Ring value={numbers.answerRate} />} />
    </div>
  );
}
