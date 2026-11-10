const express = require('express');
const store = require('../lib/store');
const { generateToken, hashToken } = require('../lib/tokens');
const { requireAuth } = require('../middleware/auth');
const { buildOverview } = require('../lib/overview');
const { appUrl } = require('../lib/viasocket');
const { answerLimiter } = require('../middleware/rateLimits');

const owner = express.Router();
owner.use(requireAuth);

owner.get('/', (req, res) => {
  const link = store.share.active(req.userId);
  res.json({ active: !!link, createdAt: link ? link.created_at : null });
});

// Creating a new link revokes the old one. The raw token is shown once; only its hash is stored.
owner.post('/', (req, res) => {
  store.share.revokeAll(req.userId);
  const raw = generateToken();
  const link = store.share.create(req.userId, hashToken(raw));
  res.status(201).json({ active: true, createdAt: link.created_at, url: `${appUrl()}/m/${raw}` });
});

owner.delete('/', (req, res) => {
  store.share.revokeAll(req.userId);
  res.json({ active: false });
});

const manager = express.Router();
manager.use(answerLimiter);

manager.get('/:token', async (req, res) => {
  const ownerId = store.share.ownerByHash(hashToken(req.params.token));
  if (!ownerId) return res.status(404).json({ error: 'This link is not valid any more.' });
  res.json(await buildOverview(store.users.byId(ownerId), req.query.week, { forManager: true }));
});

module.exports = { owner, manager };
