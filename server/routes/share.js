const express = require('express');
const ShareLink = require('../models/ShareLink');
const User = require('../models/User');
const { generateToken, hashToken } = require('../lib/tokens');
const { requireAuth } = require('../middleware/auth');
const { buildOverview } = require('../lib/overview');
const { appUrl } = require('../lib/viasocket');
const { answerLimiter } = require('../middleware/rateLimits');

const owner = express.Router();
owner.use(requireAuth);

owner.get('/', async (req, res) => {
  const link = await ShareLink.findOne({ owner: req.userId, revokedAt: null });
  res.json({ active: !!link, createdAt: link ? link.createdAt : null });
});

// Creating a new link revokes the old one. The raw token is shown once; only its hash is stored.
owner.post('/', async (req, res) => {
  await ShareLink.updateMany({ owner: req.userId, revokedAt: null }, { revokedAt: new Date() });
  const raw = generateToken();
  const link = await ShareLink.create({ owner: req.userId, tokenHash: hashToken(raw) });
  res.status(201).json({ active: true, createdAt: link.createdAt, url: `${appUrl()}/m/${raw}` });
});

owner.delete('/', async (req, res) => {
  await ShareLink.updateMany({ owner: req.userId, revokedAt: null }, { revokedAt: new Date() });
  res.json({ active: false });
});

const manager = express.Router();
manager.use(answerLimiter);

manager.get('/:token', async (req, res) => {
  const link = await ShareLink.findOne({ tokenHash: hashToken(req.params.token), revokedAt: null });
  if (!link) return res.status(404).json({ error: 'This link is not valid any more.' });
  const user = await User.findById(link.owner);
  res.json(await buildOverview(user, req.query.week, { forManager: true }));
});

module.exports = { owner, manager };
