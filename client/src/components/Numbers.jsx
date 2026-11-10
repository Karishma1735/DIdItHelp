const pct = (v) => (v === null || v === undefined ? '—' : `${v}%`);

function Number({ label, value, note }) {
  return (
    <div className="card">
      <p className="text-xs font-medium uppercase tracking-wide muted">{label}</p>
      <p className="mt-1 text-3xl font-bold">{value}</p>
      <p className="mt-2 text-xs muted">{note}</p>
    </div>
  );
}

export default function Numbers({ numbers }) {
  return (
    <div className="grid gap-3 sm:grid-cols-3">
      <Number label="Impact" value={`${numbers.impact} pts`} note={numbers.explanations.impact} />
      <Number label="Reliability" value={pct(numbers.reliability)} note={numbers.explanations.reliability} />
      <Number label="Answer rate" value={pct(numbers.answerRate)} note={numbers.explanations.answerRate} />
    </div>
  );
}
