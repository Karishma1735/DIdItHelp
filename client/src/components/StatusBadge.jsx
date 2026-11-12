export const STATES = {
  due: { label: 'Due', cls: 'bg-mist-200 text-ink-700 ring-1 ring-inset ring-mist-400 dark:bg-ink-800 dark:text-mist-200 dark:ring-ink-700' },
  late: { label: 'Late', cls: 'bg-red-700 text-white dark:bg-red-600' },
  unasked: { label: 'Delivered, not asked yet', cls: 'bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200' },
  waiting: { label: 'Waiting for an answer', cls: 'bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200' },
  helped: { label: 'Helped', cls: 'bg-leaf-700 text-white dark:bg-leaf-600' },
  lot: { label: 'Helped a lot', cls: 'bg-leaf-700 text-white dark:bg-leaf-600' },
  little: { label: 'Helped a little', cls: 'bg-[#EDE8B8] text-[#5C5010] dark:bg-[#3A3510] dark:text-[#E4DC8A]' },
  none: { label: 'Didn’t help', cls: 'bg-ink-200 text-ink-700 dark:bg-ink-700 dark:text-ink-100' },
  dropped: { label: 'Dropped', cls: 'bg-transparent text-ink-400 line-through ring-1 ring-inset ring-ink-200 dark:ring-ink-700' },
};

export default function StatusBadge({ state }) {
  const s = STATES[state] || STATES.due;
  return <span className={`inline-block whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-semibold ${s.cls}`}>{s.label}</span>;
}
