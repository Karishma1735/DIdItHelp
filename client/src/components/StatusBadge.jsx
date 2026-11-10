export const STATES = {
  due: { label: 'Due', cls: 'bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-300' },
  late: { label: 'Late', cls: 'bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300' },
  unasked: { label: 'Delivered, not asked yet', cls: 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300' },
  waiting: { label: 'Waiting for an answer', cls: 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300' },
  lot: { label: 'Helped a lot', cls: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300' },
  little: { label: 'Helped a little', cls: 'bg-lime-100 text-lime-800 dark:bg-lime-950 dark:text-lime-300' },
  none: { label: 'Didn’t help', cls: 'bg-stone-200 text-stone-800 dark:bg-stone-800 dark:text-stone-300' },
  dropped: { label: 'Dropped', cls: 'bg-stone-100 text-stone-500 line-through dark:bg-stone-900 dark:text-stone-500' },
};

export default function StatusBadge({ state }) {
  const s = STATES[state] || STATES.due;
  return <span className={`inline-block whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-medium ${s.cls}`}>{s.label}</span>;
}
