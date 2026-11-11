// The one-sentence summary, as a cherry banner.
export default function Hero({ text, label }) {
  return (
    <section className="relative overflow-hidden rounded-3xl bg-cherry-700 p-6 text-cream-50 shadow-soft dark:bg-cherry-800 sm:p-8" aria-label="Summary">
      <div className="pointer-events-none absolute -right-10 -top-16 h-56 w-56 rounded-full bg-cherry-600/60" />
      <div className="pointer-events-none absolute -bottom-20 right-24 h-40 w-40 rounded-full bg-cherry-800/70 dark:bg-cherry-900/60" />
      <div className="relative">
        {label && <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-cream-200/80">{label}</p>}
        <p className="mt-2 font-display text-2xl font-medium leading-snug sm:text-3xl">{text}</p>
      </div>
    </section>
  );
}
