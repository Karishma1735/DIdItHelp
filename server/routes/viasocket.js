// Each person's own viaSocket connections: Slack and Gmail first, with the whole catalog in the embedded screens.
// auth_id and script_id are credentials: they stay on the server and are only ever used for the signed-in person.
const express = require('express');
const rateLimit = require('express-rate-limit');
const store = require('../lib/store');
const { requireAuth } = require('../middleware/auth');
const { configured, getClient, scopeFor } = require('../lib/viasocketClient');

const router = express.Router();
router.use(requireAuth);
router.use((req, res, next) => {
  if (!configured()) return res.status(503).json({ error: 'viaSocket is not set up on the server yet.' });
  next();
});

const sendLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => `u${req.userId}`,
  message: { error: 'Too many test messages. Please try again in a few minutes.' },
});

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

const featuredSlug = (req, res) => {
  const slug = String(req.params.app || '');
  if (!FEATURED[slug]) {
    res.status(404).json({ error: 'Unknown app.' });
    return null;
  }
  return slug;
};

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

// Per-person embed token for the Connect popup and the embedded screens. The only viaSocket value a browser holds.
router.get('/token', async (req, res) => {
  try {
    const user = scopeFor(req.userId);
    const slugs = String(req.query.apps || '').split(',').filter((s) => FEATURED[s]).slice(0, 5);
    const entries = await Promise.all(
      slugs.map(async (slug) => [slug, { serviceId: await user.serviceIdFor(slug), actionId: (await sendAction(slug)).actionId }])
    );
    res.json({ token: await user.token(), apps: Object.fromEntries(entries) });
  } catch (err) {
    res.status(502).json({ error: friendly(err) });
  }
});

router.get('/status', async (req, res) => {
  try {
    const me = store.users.byId(req.userId);
    const apps = [];
    for (const slug of Object.keys(FEATURED)) {
      const conn = await connectionFor(req.userId, slug);
      const saved = store.vsConn.get(req.userId, slug);
      apps.push({
        app: slug,
        name: FEATURED[slug].name,
        connected: !!conn,
        expired: !!(conn && conn.isExpired),
        label: conn ? conn.connection_label || null : null,
        iconUrl: (conn && conn.iconUrl) || (await iconFor(slug).catch(() => null)),
        slackMe: slug === 'slack' && saved && saved.slackUserId ? { label: saved.slackUserLabel } : null,
        testTo: slug === 'gmail' ? me.email : null,
      });
    }
    res.json({ apps });
  } catch (err) {
    res.status(502).json({ error: friendly(err) });
  }
});

// Called by the Connect button with the connection it got back. The id must be one of THIS person's own connections.
router.post('/connected', async (req, res) => {
  const slug = featuredSlug({ params: { app: req.body.app } }, res);
  if (!slug) return;
  try {
    const authId = typeof req.body.authId === 'string' ? req.body.authId : '';
    const sid = await serviceIdFor(slug);
    const conns = await scopeFor(req.userId).listConnections();
    const found = conns.find((c) => c.id === authId && c.service_id === sid);
    if (!found) return res.status(400).json({ error: 'That connection was not found on your account.' });
    store.vsConn.upsert(req.userId, slug, found.id);
    res.json({ ok: true });
  } catch (err) {
    res.status(502).json({ error: friendly(err) });
  }
});

// Slack people for "which one is you?", searchable and paged by viaSocket.
router.get('/slack/people', async (req, res) => {
  try {
    const conn = await connectionFor(req.userId, 'slack');
    if (!conn) return res.status(409).json({ error: 'Connect Slack first.' });
    const act = await sendAction('slack');
    const r = await scopeFor(req.userId).listOptions('slack', act.key, {
      fieldKey: 'destination.userId',
      authId: conn.id,
      version: act.version,
      existingFields: { destination: { messageto: 'user' } },
      search: typeof req.query.search === 'string' ? req.query.search.slice(0, 100) : undefined,
      paginate: req.query.paginate ? String(req.query.paginate) : undefined,
    });
    res.json({
      options: r.options.map((o) => ({ label: o.label, value: o.value })),
      hasMore: !!r.hasMore,
      paginate: r.paginate == null ? null : r.paginate,
      message: r.message || undefined,
    });
  } catch (err) {
    res.status(502).json({ error: friendly(err) });
  }
});

// Which Slack person is me: chosen once after connecting, stored with the connection, changeable.
router.post('/slack/me', async (req, res) => {
  try {
    const value = typeof req.body.value === 'string' ? req.body.value.trim().slice(0, 100) : '';
    const label = typeof req.body.label === 'string' ? req.body.label.trim().slice(0, 120) : '';
    if (!value || !label) return res.status(400).json({ error: 'Pick your name from the list.' });
    const conn = await connectionFor(req.userId, 'slack');
    if (!conn) return res.status(409).json({ error: 'Connect Slack first.' });
    const act = await sendAction('slack');
    const r = await scopeFor(req.userId).listOptions('slack', act.key, {
      fieldKey: 'destination.userId',
      authId: conn.id,
      version: act.version,
      existingFields: { destination: { messageto: 'user' } },
      search: label,
    });
    if (!r.options.some((o) => String(o.value) === value)) return res.status(400).json({ error: 'That person is not in your Slack list.' });
    store.vsConn.setSlackMe(req.userId, value, label);
    res.json({ ok: true });
  } catch (err) {
    res.status(502).json({ error: friendly(err) });
  }
});

// A fixed test line, sent to the signed-in person themself and nobody else.
router.post('/test/:app', sendLimiter, async (req, res) => {
  const slug = featuredSlug(req, res);
  if (!slug) return;
  try {
    const conn = await connectionFor(req.userId, slug);
    if (!conn) return res.status(409).json({ error: `Connect ${FEATURED[slug].name} first.` });
    if (conn.isExpired) return res.status(409).json({ error: `Your ${FEATURED[slug].name} connection expired. Connect it again.` });
    const me = store.users.byId(req.userId);
    const act = await sendAction(slug);
    let inputData;
    if (slug === 'slack') {
      const saved = store.vsConn.get(req.userId, 'slack');
      if (!saved || !saved.slackUserId) return res.status(409).json({ error: 'Pick which Slack person is you first.' });
      inputData = {
        destination: { messageto: 'user', userId: [saved.slackUserId] },
        markdown_content: 'Did it help? is connected to your Slack. This is a test message, sent only to you.',
      };
    } else {
      inputData = {
        to: me.email,
        subject: 'Did it help? is connected to your Gmail',
        messageBody: 'This is a test email from Did it help?, sent only to you. Your Gmail is connected.',
      };
    }
    const user = scopeFor(req.userId);
    const scriptId = (await user.findEnabled(slug)) ?? (await user.enable(slug, conn.id)).scriptId;
    const out = await getClient().runAction(scriptId, act.key, inputData, { version: act.version });
    if (runFailed(out)) {
      const msg = (out.errorMsg && out.errorMsg.message) || out.message || 'The app refused the message.';
      return res.status(502).json({ error: String(msg).slice(0, 200) });
    }
    res.json({ ok: true, to: slug === 'gmail' ? me.email : 'you on Slack' });
  } catch (err) {
    res.status(502).json({ error: friendly(err) });
  }
});

module.exports = router;
