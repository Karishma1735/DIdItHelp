// Shared viaSocket helpers: a person's own Slack and Gmail connections, and sending as that person.
// auth_id and script_id are credentials: they stay on the server and are only ever used for the person they belong to.
const store = require('./store');
const { getClient, scopeFor } = require('./viasocketClient');

// The two apps featured at the top. Each person's test message goes only to themself.
const FEATURED = {
  slack: { name: 'Slack', send: 'Send_Message' },
  gmail: { name: 'Gmail', send: 'Send_Email' },
};

const day = 24 * 60 * 60 * 1000;
const cache = new Map();
async function cached(key, fn) {
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < day) return hit.value;
  const value = await fn();
  cache.set(key, { at: Date.now(), value });
  return value;
}

// The app's icon and name come from viaSocket's public catalog.
const iconFor = (slug) =>
  cached(`icon:${slug}`, async () => {
    const v = await getClient().catalog.versions(await serviceIdFor(slug));
    return (v && v.service && v.service.icon_url) || null;
  });

const serviceIdFor = (slug) => cached(`sid:${slug}`, () => scopeFor('catalog').serviceIdFor(slug));

// key, published version and action_id come from viaSocket's own listing, never from memory.
async function sendAction(slug) {
  return cached(`act:${slug}`, async () => {
    const list = await scopeFor('catalog').listActions(slug);
    const a = list.actions.find((x) => x.key === FEATURED[slug].send);
    if (!a) throw new Error(`The ${FEATURED[slug].name} send action was not found.`);
    return { key: a.key, version: String(a.version).toLowerCase(), actionId: a.actionId };
  });
}


const friendly = (err) => {
  const m = String((err && err.message) || '').slice(0, 200);
  return m || 'viaSocket did not answer. Please try again.';
};

// A run failed when the reply says so (the skill's own check).
const runFailed = (out) =>
  out && typeof out === 'object' && (typeof out.success === 'boolean' && 'data' in out ? !out.success : out.success === false);

// The person's connection to one app: the one we saved if it still exists, else their newest.
async function connectionFor(userId, slug) {
  const user = scopeFor(userId);
  const [sid, conns] = await Promise.all([serviceIdFor(slug), user.listConnections()]);
  const mine = conns.filter((c) => c.service_id === sid);
  if (!mine.length) return null;
  const saved = store.vsConn.get(userId, slug);
  const chosen =
    (saved && mine.find((c) => c.id === saved.authId)) ||
    mine.slice().sort((a, b) => String(b.updated_at).localeCompare(String(a.updated_at)))[0];
  store.vsConn.upsert(userId, slug, chosen.id); // also picks up a connection made in the embedded screens
  return chosen;
}


// Sends an email FROM the person's own connected Gmail. Never throws: returns { ok, reason, error }.
//   reason: 'not_configured' | 'no_gmail' | 'expired' | 'failed'
async function sendGmailAs(userId, { to, subject, body }) {
  if (!getClient()) return { ok: false, reason: 'not_configured', error: 'viaSocket is not set up on the server.' };
  try {
    const conn = await connectionFor(userId, 'gmail');
    if (!conn) return { ok: false, reason: 'no_gmail', error: 'Gmail is not connected.' };
    if (conn.isExpired) return { ok: false, reason: 'expired', error: 'The Gmail connection expired.' };
    const act = await sendAction('gmail');
    const user = scopeFor(userId);
    const scriptId = (await user.findEnabled('gmail')) ?? (await user.enable('gmail', conn.id)).scriptId;
    const out = await getClient().runAction(scriptId, act.key, { to, subject, messageBody: body }, { version: act.version });
    if (runFailed(out)) return { ok: false, reason: 'failed', error: String((out.errorMsg && out.errorMsg.message) || out.message || 'Gmail refused the email.').slice(0, 200) };
    return { ok: true };
  } catch (err) {
    return { ok: false, reason: 'failed', error: friendly(err) };
  }
}

module.exports = { FEATURED, serviceIdFor, iconFor, sendAction, connectionFor, runFailed, friendly, sendGmailAs };
