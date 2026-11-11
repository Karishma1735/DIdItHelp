import { useAuth } from '../auth.jsx';

// Shown on an employee's desk so it is clear who can see their work, and what they can see.
export default function ManagerNote() {
  const { user } = useAuth();
  if (!user.managerName) return null;
  return (
    <section className="card border-cherry-600/40 bg-cherry-50 dark:bg-cherry-950/30" aria-label="Your manager">
      <p className="text-sm font-semibold">Your manager is {user.managerName}</p>
      <p className="mt-1 text-sm muted">
        {user.managerName} can see your daily plan, what you delivered with its proof link, receivers’ answers and comments, and your weekly numbers.
        They can’t change anything, and they never see your receivers’ Slack handles or emails.
      </p>
    </section>
  );
}
