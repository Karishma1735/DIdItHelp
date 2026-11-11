import { useState } from 'react';

export default function ThemeToggle({ className = '' }) {
  const [dark, setDark] = useState(document.documentElement.classList.contains('dark'));
  const toggle = () => {
    const next = !dark;
    document.documentElement.classList.toggle('dark', next);
    try { localStorage.setItem('theme', next ? 'dark' : 'light'); } catch { /* ignore */ }
    setDark(next);
  };
  return (
    <button onClick={toggle} className={`btn-ghost ${className}`} aria-label="Switch between light and dark mode">
      {dark ? 'Light' : 'Dark'}
    </button>
  );
}
