export function CherryMark({ className = 'h-8 w-8', leaf = '#9DBB5A' }) {
  return (
    <svg viewBox="0 0 32 32" className={className} aria-hidden="true">
      <path d="M16 5c-1 5-3 8-6 13M16 5c1 5 3 8 6 13" stroke={leaf} strokeWidth="1.8" fill="none" strokeLinecap="round" />
      <path d="M16 5c3-2 7-2 10 1-3 2-7 2-10-1z" fill={leaf} />
      <circle cx="10" cy="22" r="6" fill="currentColor" />
      <circle cx="22" cy="21" r="6" fill="currentColor" opacity=".82" />
      <circle cx="8.3" cy="20" r="1.5" fill="#fff" opacity=".45" />
      <circle cx="20.3" cy="19" r="1.5" fill="#fff" opacity=".45" />
    </svg>
  );
}

export default function Brand({ light = false, size = 'text-xl' }) {
  return (
    <span className={`inline-flex items-center gap-2 ${light ? 'text-cream-50' : 'text-cherry-700 dark:text-cream-50'}`}>
      <CherryMark className="h-8 w-8" leaf={light ? '#C9E08A' : '#6B8A33'} />
      <span className={`font-display font-semibold italic tracking-tight ${size}`}>Did it help?</span>
    </span>
  );
}
