// Speech bubble with a check mark: "did it help?" answered yes.
export function BrandMark({ className = 'h-8 w-8', variant = 'default' }) {
  const check = variant === 'light' ? 'stroke-steel-700' : 'stroke-mist-50 dark:stroke-steel-700';
  return (
    <svg viewBox="0 0 32 32" className={className} aria-hidden="true">
      <path d="M6 5h20a3 3 0 0 1 3 3v13a3 3 0 0 1-3 3H15.5L9 29.5V24H6a3 3 0 0 1-3-3V8a3 3 0 0 1 3-3z" fill="currentColor" />
      <path d="M10 14.8l4 4 8-8.3" fill="none" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" className={check} />
    </svg>
  );
}

export default function Brand({ light = false, size = 'text-xl' }) {
  return (
    <span className={`inline-flex items-center gap-2 ${light ? 'text-mist-50' : 'text-steel-700 dark:text-mist-50'}`}>
      <BrandMark className="h-8 w-8" variant={light ? 'light' : 'default'} />
      <span className={`font-display font-semibold italic tracking-tight ${size}`}>Did it help?</span>
    </span>
  );
}
