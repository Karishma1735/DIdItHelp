import { useAuth } from '../auth.jsx';

// Shown on an employee's desk so it is clear who can see their work, and what they can see.
export default function ManagerNote() {
  const { user } = useAuth();
  if (!user.managerName) return null;
  return (
    <section className="card border-steel-600/40 bg-steel-50 dark:bg-steel-950/30" aria-label="Your manager">
      <p className="text-sm font-semibold">Your manager is {user.managerName}</p>
      <p className="mt-1 text-sm muted">
        {user.managerName} can see your daily plan, what you delivered with its proof link, receivers’ answers and comments, and your daily and weekly numbers.
        They can’t change anything, and they never see your receivers’ Slack handles or emails. When you submit work in the evening, {user.managerName} is emailed a report from your own Gmail (connect it on the Integrations page). If {user.managerName} asks their AI assistant about your week, your plan and results are shared with that assistant to write the answer.
      </p>
    </section>
  );
}
