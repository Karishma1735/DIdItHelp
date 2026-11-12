import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../api';
import { useAuth } from '../auth.jsx';

// Employees with a manager: the evening report is emailed from their own Gmail, so Gmail has to be connected.
export default function GmailBanner() {
  const { user } = useAuth();
  const [needs, setNeeds] = useState(false);
  useEffect(() => {
    if (!user.managerName) return;
    api.get('/viasocket/status').then((r) => {
      const g = r.data.apps.find((a) => a.app === 'gmail');
      setNeeds(!g || !g.connected || g.expired);
    }).catch(() => {});
  }, [user.managerName]);
  if (!needs) return null;
  return (
    <section className="card border-amber-400/60 bg-amber-50 dark:bg-amber-950/30" aria-label="Connect Gmail">
      <p className="text-sm font-semibold">Connect your Gmail so {user.managerName} gets your evening report</p>
      <p className="mt-1 text-sm muted">When you submit work in the evening, the report is emailed to {user.managerName} from your own Gmail. Without it, nothing is sent.</p>
      <Link to="/integrations" className="btn-primary mt-3 inline-flex">Connect Gmail</Link>
    </section>
  );
}
