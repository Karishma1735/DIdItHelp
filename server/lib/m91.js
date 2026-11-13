// M91: a loud alert on the phones of the people in one channel (through silent mode and Do Not Disturb), for the
// moments when something breaks and a person has to act. This is the ONLY file that talks to M91.
//
// The send link is a credential: anyone who has it can ring the channel. It lives in M91_SEND_LINK (environment only),
// is never logged, never put in an error message and never sent to the browser.
//
// What a 2xx means: M91 accepted the alert. `delivered` is how many phones it was sent to, not proof that one rang;
// delivered 0 means nobody can be reached (people invited but not signed in) and is reported, never treated as success.

const TIMEOUT_MS = Number(process.env.M91_TIMEOUT_MS || 10000);
const MAX_HOPS = 3;

// Without a query string: a link ending in ?title=... would RAISE an alert whenever it is fetched.
const linkOf = () => {
  const raw = String(process.env.M91_SEND_LINK || '').trim().split('?')[0];
  return /^https?:\/\/[^/\s]+\/s\/[^/\s#]+$/.test(raw) ? raw : '';
};
const configured = () => !!linkOf();

// Strips the link, and the token inside it, from any text before it is logged or shown.
function redact(text) {
  let out = String(text);
  const link = linkOf();
  if (!link) return out;
  out = out.split(link).join('<m91-link>');
  const token = link.split('/s/')[1];
  if (token) out = out.split(token).join('<token>');
  return out;
}

// POST that keeps being a POST across redirects (a plain fetch turns 301/302 into a GET, and a GET without a title is a
// harmless connection test: the alert would silently never be raised). Stays on the link's own host.
async function request(method, url, body) {
  const host = new URL(url).host;
  let target = url;
  for (let hop = 0; hop <= MAX_HOPS; hop += 1) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
    let res;
    try {
      res = await fetch(target, {
        method,
        redirect: 'manual',
        headers: body ? { 'Content-Type': 'application/json' } : undefined,
        body: body ? JSON.stringify(body) : undefined,
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timer);
    }
    if (res.status >= 300 && res.status < 400 && res.headers.get('location')) {
      const next = new URL(res.headers.get('location'), target);
      if (next.host !== host) throw new Error('M91 redirected somewhere unexpected.');
      target = next.toString();
      continue;
    }
    let json = null;
    try { json = await res.json(); } catch { /* not JSON */ }
    return { status: res.status, json, retryAfter: Number(res.headers.get('retry-after')) || null };
  }
  throw new Error('M91 redirected too many times.');
}

// Turns what came back into one plain shape. Never contains the link.
function failure(res, what) {
  const code = res.json && res.json.error && res.json.error.code;
  if (res.status === 401) return { ok: false, retryable: false, error: `M91 rejected the send link (wrong or revoked). Create a new link in the M91 app and update M91_SEND_LINK.` };
  if (res.status === 429) return { ok: false, retryable: true, error: `M91 is rate limiting this link (try again in ${res.retryAfter || 60}s).` };
  if (res.status === 409 && code === 'CHANNEL_EMPTY') return { ok: false, retryable: false, error: 'The M91 channel has no members who accepted their invite, so nobody can be reached.' };
  return { ok: false, retryable: res.status >= 500 || res.status === 0, error: `M91 ${what} failed (${res.status}${code ? ` ${code}` : ''}).` };
}

async function guarded(what, fn) {
  if (!configured()) return { ok: false, retryable: false, notConfigured: true, error: 'M91_SEND_LINK is not set, so nobody can be woken.' };
  try {
    return await fn();
  } catch (err) {
    const why = err && err.name === 'AbortError' ? 'timed out' : redact((err && err.message) || 'could not be reached');
    return { ok: false, retryable: true, error: `M91 ${what} ${why}.` };
  }
}

// Raise one alert. Every alert has two real answers (one person takes it, or just sees it), so a person can claim it.
// customId names the CONDITION, so a repeat while it is open alerts nobody.
async function send({ title, description = '', severity = 'MEDIUM', customId, responseOptions, isAutoClose }) {
  return guarded('alert', async () => {
    const res = await request('POST', linkOf(), {
      title: String(title).slice(0, 2000),
      description: String(description).slice(0, 2000),
      severity,
      customId,
      responseOptions: responseOptions || [
        { label: "I'll handle it", effect: 'SHARED' },
        { label: 'Seen', effect: 'PERSONAL' },
      ],
      isAutoClose, // left out unless asked for: a SHARED answer then stands the others down but leaves the alert open
    });
    const data = res.json && res.json.data;
    if (res.status >= 200 && res.status < 300 && res.json && res.json.success !== false && data) {
      return { ok: true, delivered: Number(data.delivered) || 0, deduplicated: !!data.deduplicated };
    }
    return failure(res, 'alert');
  });
}

// Close the alert for a condition. 404 (nothing matched) and 403 (already closed) both mean "nothing to close": success.
async function close(customId) {
  return guarded('close', async () => {
    const res = await request('POST', `${linkOf()}/close`, { customId });
    if ((res.status >= 200 && res.status < 300) || res.status === 404 || res.status === 403) return { ok: true };
    return failure(res, 'close');
  });
}

// A bare GET raises nothing and wakes nobody: it only names the channel. For setup checks.
async function check() {
  return guarded('check', async () => {
    const res = await request('GET', linkOf());
    const channel = res.json && res.json.data && res.json.data.channel;
    if (res.status === 200 && channel) return { ok: true, channel: channel.name };
    return failure(res, 'check');
  });
}

module.exports = { configured, send, close, check, redact };
