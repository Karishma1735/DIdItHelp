// Manager-only routes: the team dashboard, one report's read-only desk, and invite links.
const express = require('express');
const store = require('../lib/store');
const { requireAuth } = require('../middleware/auth');
const { generateToken, hashToken } = require('../lib/tokens');
const { buildOverview, buildTeamSummary } = require('../lib/overview');
const { appUrl } = require('../lib/viasocket');
const { sendInvite } = require('../lib/messenger');
const { seedDemo } = require('../lib/demo');

const router = express.Router();
router.use(requireAuth);
router.use((req, res, next) => {
  const me = store.users.byId(req.userId);
  if (!me || !me.isManager) return res.status(403).json({ error: 'The team dashboard is for managers.' });
  req.me = me;
  next();
});

router.get('/', (req, res) => res.json(buildTeamSummary(req.me, req.query.week)));

const clean = (v, max) => (typeof v === 'string' ? v.trim().slice(0, max) : '');

const inviteRow = (i) => ({
  id: i.id,
  label: i.label,
  contact: i.contact,
  makeManager: i.makeManager,
  createdAt: i.createdAt,
  expiresAt: i.expiresAt,
  sentAt: i.sentAt,
  sentVia: i.sentVia,
  sendError: i.sendError || undefined,
  joinedName: i.usedBy ? (store.users.byId(i.usedBy) || {}).name || null : null,
  status: i.usedAt ? 'joined' : 'waiting',
});

router.get('/invites', (req, res) => {
  res.json({ invites: store.invites.listByManager(req.me.id).map(inviteRow) });
});

// Creates the invite and, if a Slack @name or email was given, sends the link through viaSocket.
// The raw link is shown once; only its hash is stored. Links expire after 7 days and work once.
async function createAndSend(me, { label, contact, makeManager }) {
  const raw = generateToken();
  const invite = store.invites.create(me.id, hashToken(raw), { label, contact, makeManager });
  const url = `${appUrl()}/join/${raw}`;
  let sent = null;
  if (contact) {
    const r = await sendInvite({ senderId: me.id, contact, name: label, managerName: me.name, joinUrl: url, expiresAt: invite.expiresAt, makeManager });
    store.invites.setSent(invite.id, r.ok ? { sentAt: new Date().toISOString(), sentVia: r.channel } : { sendError: r.error });
    sent = { ok: r.ok, channel: r.channel, error: r.ok ? undefined : r.error };
  }
  return { id: invite.id, url, expiresAt: invite.expiresAt, sent };
}

router.post('/invites', async (req, res) => {
  const label = clean(req.body.label, 100);
  const contact = clean(req.body.contact, 200);
  if (contact && !label) return res.status(400).json({ error: 'Add their name so the message can greet them.' });
  res.status(201).json(await createAndSend(req.me, { label, contact, makeManager: req.body.makeManager === true }));
});

// The raw link can't be recovered (only its hash is stored), so "resend" replaces the invite with a fresh one.
router.post('/invites/:id/resend', async (req, res) => {
  const old = /^\d+$/.test(req.params.id) ? store.invites.get(req.params.id, req.me.id) : null;
  if (!old || old.usedAt || old.revokedAt) return res.status(404).json({ error: 'Invite not found.' });
  store.invites.revoke(old.id, req.me.id);
  res.status(201).json(await createAndSend(req.me, { label: old.label, contact: old.contact, makeManager: old.makeManager }));
});

router.delete('/invites/:id', (req, res) => {
  if (!/^\d+$/.test(req.params.id) || !store.invites.revoke(req.params.id, req.me.id)) {
    return res.status(404).json({ error: 'Invite not found.' });
  }
  res.json({ ok: true });
});

// Sample employee so a new manager can see a filled-in dashboard. Removable in one click.
router.post('/demo', (req, res) => {
  if (store.users.reportsOf(req.me.id).some((u) => u.isDemo)) return res.status(409).json({ error: 'The sample employee is already on your team.' });
  seedDemo(req.me);
  res.status(201).json({ ok: true });
});

router.delete('/demo', (req, res) => {
  const demo = store.users.reportsOf(req.me.id).find((u) => u.isDemo);
  if (!demo) return res.status(404).json({ error: 'There is no sample employee to remove.' });
  store.removeDemoUser(demo.id);
  res.json({ ok: true });
});

// A manager can open only their own direct reports, and only read.
router.get('/:userId/overview', async (req, res) => {
  const member = /^\d+$/.test(req.params.userId) ? store.users.byId(req.params.userId) : null;
  if (!member || member.reportsTo !== req.me.id) return res.status(404).json({ error: 'That person is not on your team.' });
  const data = await buildOverview(member, req.query.week, { forManager: true });
  res.json({ ...data, owner: { ...data.owner, id: member.id } });
});

module.exports = router;
