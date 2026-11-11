import { useEffect, useRef, useState } from 'react';

const SCRIPT = 'https://embed.viasocket.com/prod-embedcomponent.js';
const ORIGIN = 'https://embedfrontend.viasocket.com';

function loadScript() {
  if (window.viaSocket) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const existing = document.querySelector(`script[src="${SCRIPT}"]`);
    const s = existing || document.createElement('script');
    s.addEventListener('load', resolve, { once: true });
    s.addEventListener('error', () => reject(new Error('script')), { once: true });
    if (!existing) {
      s.src = SCRIPT;
      document.head.appendChild(s);
    }
  });
}

// viaSocket's own screens: the catalog of every app, Connect, every action's form, and the person's own automations.
export default function EmbedBox({ token }) {
  const box = useRef(null);
  const [state, setState] = useState('loading');
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!token) return undefined;
    let embed = null;
    let dead = false;
    // Only trust messages that come from the embed's own origin.
    const onMessage = (event) => {
      if (event.origin !== ORIGIN) return;
    };
    window.addEventListener('message', onMessage);
    setState('loading');
    loadScript()
      .then(() => {
        if (dead || !box.current) return;
        embed = window.viaSocket.mount({
          embedToken: token,
          parent: box.current,
          config: {
            pageheading: 'Automation',
            showEnabled: true, // land on the person's own list
            hideFunction: true, // no custom-code cards
            hideApi: true, // no raw HTTP card
            themeJson: { '--primary-color': '#2B4257', '--font-family': 'DM Sans' },
          },
        });
        embed.on('error', () => !dead && setState('error'));
        setState('ready');
      })
      .catch(() => !dead && setState('error'));
    return () => {
      dead = true;
      window.removeEventListener('message', onMessage);
      try { embed && embed.destroy(); } catch { /* already gone */ }
    };
  }, [token, attempt]);

  return (
    <div>
      {state === 'error' && (
        <div className="card space-y-2">
          <p role="alert" className="text-sm text-red-700 dark:text-red-400">The app catalog could not load. Check your connection and try again.</p>
          <button className="btn-ghost" onClick={() => setAttempt((n) => n + 1)}>Try again</button>
        </div>
      )}
      {state === 'loading' && <p className="mb-2 text-sm muted">Loading the app catalog…</p>}
      <div ref={box} style={{ height: 720 }} className={`overflow-hidden rounded-2xl border border-mist-300 bg-white dark:border-ink-800 ${state === 'error' ? 'hidden' : ''}`} />
    </div>
  );
}
