import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './auth.jsx';
import Login from './pages/Login.jsx';
import Dashboard from './pages/Dashboard.jsx';
import Manager from './pages/Manager.jsx';
import Answer from './pages/Answer.jsx';

function Private({ children }) {
  const { user, ready } = useAuth();
  if (!ready) return <p className="p-6 muted">Loading…</p>;
  return user ? children : <Navigate to="/login" replace />;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/m/:token" element={<Manager />} />
      <Route path="/a/:token" element={<Answer />} />
      <Route path="/" element={<Private><Dashboard /></Private>} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
