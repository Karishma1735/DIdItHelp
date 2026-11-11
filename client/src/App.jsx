import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './auth.jsx';
import Login from './pages/Login.jsx';
import Dashboard from './pages/Dashboard.jsx';
import Manager from './pages/Manager.jsx';
import Answer from './pages/Answer.jsx';
import Team from './pages/Team.jsx';
import TeamMember from './pages/TeamMember.jsx';
import Join from './pages/Join.jsx';
import Settings from './pages/Settings.jsx';
import Integrations from './pages/Integrations.jsx';

function Private({ children, manager = false }) {
  const { user, ready } = useAuth();
  if (!ready) return <p className="p-6 muted">Loading…</p>;
  if (!user) return <Navigate to="/login" replace />;
  if (manager && !user.isManager) return <Navigate to="/" replace />;
  return children;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/m/:token" element={<Manager />} />
      <Route path="/a/:token" element={<Answer />} />
      <Route path="/join/:token" element={<Join />} />
      <Route path="/" element={<Private><Dashboard /></Private>} />
      <Route path="/settings" element={<Private><Settings /></Private>} />
      <Route path="/integrations" element={<Private manager><Integrations /></Private>} />
      <Route path="/team" element={<Private manager><Team /></Private>} />
      <Route path="/team/:userId" element={<Private manager><TeamMember /></Private>} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
