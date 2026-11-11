// Manager-only routes: the team dashboard, one report's read-only desk, and invite links.
const express = require('express');
const store = require('../lib/store');
const { requireAuth } = require('../middleware/auth');
const { generateToken, hashToken } = require('../lib/tokens');
const { buildOverview, buildTeamSummary } = require('../lib/overview');
const { appUrl } = require('../lib/viasocket');

const router = express.Router();
router.use(requireAuth);
router.use((req, res, next) => {
  const me = store.users.byId(req.userId);
  if (!me || !me.isManager) return res.status(403).json({ error: 'The team dashboard is for managers.' });
  req.me = me;
  next();
});

router.get('/', (req, res) => res.json(buildTeamSummary(req.me, req.query.week)));

router.get('/invites', (req, res) => {
  const invites = store.invites.listByManager(req.me.id).map((i) => ({
    id: i.id,
    label: i.label,
    makeManager: i.makeManager,
    createdAt: i.createdAt,
    expiresAt: i.expiresAt,
    joinedName: i.usedBy ? (store.users.byId(i.usedBy) || {}).name || null : null,
    status: i.usedAt ? 'joined' : 'waiting',
  }));
  res.json({ invites });
});

// The raw link is shown once; only its hash is stored. Links expire after 7 days and work once.
router.post('/invites', (req, res) => {
  const label = typeof req.body.label === 'string' ? req.body.label.trim().slice(0, 100) : '';
  const raw = generateToken();
  const invite = store.invites.create(req.me.id, hashToken(raw), { label, makeManager: req.body.makeManager === true });
  res.status(201).json({ id: invite.id, url: `${appUrl()}/join/${raw}`, expiresAt: invite.expiresAt });
});

router.delete('/invites/:id', (req, res) => {
  if (!/^\d+$/.test(req.params.id) || !store.invites.revoke(req.params.id, req.me.id)) {
    return res.status(404).json({ error: 'Invite not found.' });
  }
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
