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


// Enables the app once for the person and gives viaSocket's flow a readable title (it would otherwise show the app's id).
const titled = new Set();
async function ensureEnabled(userId, slug, conn) {
  const user = scopeFor(userId);
  const scriptId = (await user.findEnabled(slug)) ?? (await user.enable(slug, conn.id)).scriptId;
  if (!titled.has(scriptId)) {
    titled.add(scriptId);
    user.renameFlow(scriptId, { title: `${FEATURED[slug].name} (used by Did it help?)` }).catch(() => {});
  }
  return scriptId;
}

// Gives an already-enabled app's flow its readable title, once per person and app per run of the server.
async function tidyFlowTitle(userId, slug) {
  const key = `${userId}:${slug}`;
  if (titled.has(key)) return;
  titled.add(key);
  try {
    const user = scopeFor(userId);
    const scriptId = await user.findEnabled(slug);
    if (scriptId && !titled.has(scriptId)) {
      titled.add(scriptId);
      await user.renameFlow(scriptId, { title: `${FEATURED[slug].name} (used by Did it help?)` });
    }
  } catch { /* cosmetic only */ }
}

// No viaSocket call may hang a request or a timed job: each send gets a time limit and then reports a plain failure.
const LIMIT_MS = Number(process.env.VIASOCKET_CALL_LIMIT_MS || 20000);
const guarded = (label, fn) => async (...args) => {
  let timer;
  try {
    return await Promise.race([
      fn(...args),
      new Promise((_, reject) => { timer = setTimeout(() => reject(new Error(`${label} did not answer in time. Please try again.`)), LIMIT_MS); }),
    ]);
  } catch (err) {
    console.error(`viaSocket ${label} failed:`, String(err.message).slice(0, 120)); // never the message or addresses
    return { ok: false, reason: 'failed', error: friendly(err) };
  } finally {
    clearTimeout(timer);
  }
};

// Every send returns { ok, reason?, error? } and never throws.
//   reason: not_configured | not_connected | expired | not_found | ambiguous | failed
async function ready(userId, slug) {
  if (!getClient()) return { reason: 'not_configured', error: 'viaSocket is not set up on the server.' };
  const conn = await connectionFor(userId, slug);
  if (!conn) return { reason: 'not_connected', error: `${FEATURED[slug].name} is not connected.` };
  if (conn.isExpired) return { reason: 'expired', error: `The ${FEATURED[slug].name} connection expired.` };
  return { conn };
}

const failure = (out, fallback) =>
  String((out && out.errorMsg && out.errorMsg.message) || (out && out.message) || fallback).slice(0, 200);

// Sends an email FROM the person's own connected Gmail.
const sendGmailAs = guarded('Gmail', async (userId, { to, subject, body }) => {
  try {
    const r = await ready(userId, 'gmail');
    if (!r.conn) return { ok: false, reason: r.reason === 'not_connected' ? 'no_gmail' : r.reason, error: r.error };
    const act = await sendAction('gmail');
    const scriptId = await ensureEnabled(userId, 'gmail', r.conn);
    const out = await getClient().runAction(scriptId, act.key, { to, subject, messageBody: body }, { version: act.version });
    if (runFailed(out)) return { ok: false, reason: 'failed', error: failure(out, 'Gmail refused the email.') };
    return { ok: true };
  } catch (err) {
    return { ok: false, reason: 'failed', error: friendly(err) };
  }
});

// Finds exactly one person in the SENDER's Slack for a handle or name like "@rahul". Never guesses between several.
const findSlackUser = guarded('Slack lookup', async (senderId, handle) => {
  try {
    const r = await ready(senderId, 'slack');
    if (!r.conn) return { ok: false, reason: r.reason, error: r.error };
    const q = String(handle).replace(/^@/, '').trim();
    if (!q) return { ok: false, reason: 'not_found', error: 'No Slack name was given.' };
    const act = await sendAction('slack');
    // viaSocket may or may not filter by the search text, so filter here too, and follow the pages (at most 5).
    const norm = (x) => String(x).toLowerCase().replace(/[^a-z0-9]/g, '');
    const want = norm(q);
    const people = [];
    let paginate;
    for (let page = 0; page < 5; page += 1) {
      const res = await scopeFor(senderId).listOptions('slack', act.key, {
        fieldKey: 'destination.userId',
        authId: r.conn.id,
        version: act.version,
        existingFields: { destination: { messageto: 'user' } },
        search: q,
        paginate,
      });
      people.push(...res.options);
      if (!res.hasMore || res.paginate == null) break;
      paginate = res.paginate;
    }
    const exact = people.filter((o) => norm(o.label) === want);
    const pool = exact.length ? exact : people.filter((o) => want && norm(o.label).includes(want));
    if (pool.length === 1) return { ok: true, id: String(pool[0].value), label: pool[0].label };
    if (!pool.length) return { ok: false, reason: 'not_found', error: `No one called “${q}” was found in your Slack.` };
    return { ok: false, reason: 'ambiguous', error: `More than one person in your Slack matches “${q}” (${pool.slice(0, 4).map((o) => o.label).join(', ')}). Use their email instead, or their full Slack name.` };
  } catch (err) {
    return { ok: false, reason: 'failed', error: friendly(err) };
  }
});

// A direct message FROM the person's own Slack to one Slack user id.
const sendSlackDM = guarded('Slack', async (senderId, slackUserId, text) => {
  try {
    const r = await ready(senderId, 'slack');
    if (!r.conn) return { ok: false, reason: r.reason, error: r.error };
    const act = await sendAction('slack');
    const scriptId = await ensureEnabled(senderId, 'slack', r.conn);
    const out = await getClient().runAction(
      scriptId,
      act.key,
      { destination: { messageto: 'user', userId: [String(slackUserId)] }, markdown_content: text },
      { version: act.version }
    );
    if (runFailed(out)) return { ok: false, reason: 'failed', error: failure(out, 'Slack refused the message.') };
    return { ok: true };
  } catch (err) {
    return { ok: false, reason: 'failed', error: friendly(err) };
  }
});

module.exports = { FEATURED, serviceIdFor, iconFor, sendAction, connectionFor, runFailed, friendly, ensureEnabled, tidyFlowTitle, sendGmailAs, findSlackUser, sendSlackDM };
