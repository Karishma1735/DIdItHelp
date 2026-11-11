import { NavLink } from 'react-router-dom';
import { useAuth } from '../auth.jsx';
import ThemeToggle from './ThemeToggle.jsx';

const tab = ({ isActive }) =>
  `rounded-lg px-3 py-1.5 text-sm font-medium ${isActive ? 'bg-emerald-700 text-white dark:bg-emerald-600' : 'hover:bg-stone-200 dark:hover:bg-stone-800'}`;

// Header with the My desk / Team tabs, shared by every signed-in page.
export default function AppShell({ actions, children }) {
  const { user, signOut } = useAuth();
  return (
    <div className="mx-auto max-w-4xl space-y-5 p-4 sm:p-6">
      <header className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold">{user.name}</h1>
            <p className="muted">
              {user.role || 'Add your role in Settings'}
              {user.managerName ? ` · reports to ${user.managerName}` : ''}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {actions}
            <ThemeToggle />
            <button className="btn-ghost" onClick={signOut}>Sign out</button>
          </div>
        </div>
        {user.isManager && (
          <nav className="flex gap-2" aria-label="Sections">
            <NavLink to="/" end className={tab}>My desk</NavLink>
            <NavLink to="/team" className={tab}>Team</NavLink>
          </nav>
        )}
      </header>
      {children}
    </div>
  );
}
