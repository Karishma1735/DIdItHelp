export const STATES = {
  due: { label: 'Due', cls: 'bg-cream-200 text-wine-700 ring-1 ring-inset ring-cream-400 dark:bg-wine-800 dark:text-cream-200 dark:ring-wine-700' },
  late: { label: 'Late', cls: 'bg-cherry-700 text-cream-50 dark:bg-cherry-600' },
  unasked: { label: 'Delivered, not asked yet', cls: 'bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200' },
  waiting: { label: 'Waiting for an answer', cls: 'bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200' },
  lot: { label: 'Helped a lot', cls: 'bg-leaf-700 text-white dark:bg-leaf-600' },
  little: { label: 'Helped a little', cls: 'bg-[#EDE8B8] text-[#5C5010] dark:bg-[#3A3510] dark:text-[#E4DC8A]' },
  none: { label: 'Didn’t help', cls: 'bg-wine-200 text-wine-700 dark:bg-wine-700 dark:text-wine-100' },
  dropped: { label: 'Dropped', cls: 'bg-transparent text-wine-400 line-through ring-1 ring-inset ring-wine-200 dark:ring-wine-700' },
};

export default function StatusBadge({ state }) {
  const s = STATES[state] || STATES.due;
  return <span className={`inline-block whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-semibold ${s.cls}`}>{s.label}</span>;
}
