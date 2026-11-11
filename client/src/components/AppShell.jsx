import { NavLink } from 'react-router-dom';
import { useAuth } from '../auth.jsx';
import Brand from './Brand.jsx';
import ThemeToggle from './ThemeToggle.jsx';

const Icon = ({ d }) => (
  <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d={d} />
  </svg>
);
const ICONS = {
  desk: 'M4 5h16v14H4zM4 10h16M9 5v14',
  team: 'M16 19v-1a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v1M10 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM20 19v-1a3 3 0 0 0-2.5-3M15.5 5.2a3 3 0 0 1 0 5.6',
  plug: 'M9 3v5M15 3v5M7 8h10v3a5 5 0 0 1-10 0V8zM12 16v5',
  cog: 'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z',
};

function useNav() {
  const { user } = useAuth();
  return [
    { to: '/', label: 'My desk', icon: ICONS.desk, end: true },
    ...(user.isManager ? [{ to: '/team', label: 'Team', icon: ICONS.team }] : []),
    { to: '/integrations', label: 'Integrations', icon: ICONS.plug },
    { to: '/settings', label: 'Settings', icon: ICONS.cog },
  ];
}

const side = ({ isActive }) =>
  `flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition ${
    isActive ? 'bg-mist-50 text-steel-800 shadow-sm' : 'text-mist-100/90 hover:bg-white/10'
  }`;
const pill = ({ isActive }) =>
  `flex shrink-0 items-center gap-2 rounded-full px-3.5 py-1.5 text-sm font-medium ${
    isActive ? 'bg-steel-700 text-mist-50 dark:bg-steel-500' : 'bg-mist-200 text-ink-800 dark:bg-ink-800 dark:text-mist-100'
  }`;

// Signed-in layout: blue sidebar on desktop, brand bar and pill nav on mobile.
export default function AppShell({ eyebrow, title, actions, children }) {
  const { user, signOut } = useAuth();
  const nav = useNav();
  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[250px_minmax(0,1fr)]">
      <aside className="sticky top-0 hidden h-screen flex-col justify-between overflow-hidden bg-steel-700 p-5 text-mist-50 dark:bg-steel-900 lg:flex">
        <div className="pointer-events-none absolute -bottom-24 -left-16 h-64 w-64 rounded-full bg-steel-600/50 dark:bg-steel-800/60" />
        <div className="relative space-y-8">
          <Brand light size="text-2xl" />
          <nav className="space-y-1" aria-label="Sections">
            {nav.map((n) => (
              <NavLink key={n.to} to={n.to} end={n.end} className={side}>
                <Icon d={n.icon} /> {n.label}
              </NavLink>
            ))}
          </nav>
        </div>
        <div className="relative space-y-3">
          <div className="rounded-xl bg-black/15 p-3">
            <p className="font-display text-lg font-semibold leading-tight">{user.name}</p>
            <p className="text-xs text-mist-100/80">{user.role || 'No role yet'}</p>
            {user.managerName && <p className="mt-1 font-mono text-[11px] text-mist-100/70">reports to {user.managerName}</p>}
          </div>
          <div className="flex gap-2">
            <ThemeToggle className="flex-1 border-white/25 text-mist-50 hover:bg-white/10" />
            <button className="btn-ghost flex-1 border-white/25 text-mist-50 hover:bg-white/10" onClick={signOut}>Sign out</button>
          </div>
        </div>
      </aside>

      <div className="min-w-0">
        <div className="bg-steel-700 px-4 py-3 text-mist-50 dark:bg-steel-900 lg:hidden">
          <div className="flex items-center justify-between">
            <Brand light />
            <div className="flex gap-2">
              <ThemeToggle className="border-white/25 text-mist-50 hover:bg-white/10" />
              <button className="btn-ghost border-white/25 text-mist-50 hover:bg-white/10" onClick={signOut}>Sign out</button>
            </div>
          </div>
        </div>
        <nav className="flex gap-2 overflow-x-auto px-4 pt-4 lg:hidden" aria-label="Sections">
          {nav.map((n) => (
            <NavLink key={n.to} to={n.to} end={n.end} className={pill}>{n.label}</NavLink>
          ))}
        </nav>

        <main className="mx-auto w-full max-w-5xl space-y-6 px-4 py-6 sm:px-8 sm:py-8">
          <header className="flex flex-wrap items-end justify-between gap-4">
            <div>
              {eyebrow && <p className="eyebrow">{eyebrow}</p>}
              <h1 className="mt-1 text-3xl font-semibold sm:text-4xl">{title}</h1>
            </div>
            {actions}
          </header>
          {children}
        </main>
      </div>
    </div>
  );
}
