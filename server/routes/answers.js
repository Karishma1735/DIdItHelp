const express = require('express');
const store = require('../lib/store');
const { hashToken } = require('../lib/tokens');
const { userIdFromRequest } = require('../middleware/auth');
const { answerLimiter } = require('../middleware/rateLimits');

const router = express.Router();
router.use(answerLimiter);

function resolve(token) {
  const itemId = store.tokens.itemIdByHash(hashToken(token));
  const item = itemId && store.items.get(itemId);
  return item && item.status === 'delivered' ? item : null;
}

function info(item) {
  const owner = store.users.byId(item.owner);
  const answer = store.answers.get(item.id);
  return {
    what: item.what,
    receiverName: item.forWhom,
    ownerName: owner ? owner.name : '',
    proofUrl: item.proofUrl,
    deliveredAt: item.deliveredAt,
    answer: answer ? { value: answer.value, comment: answer.comment } : null,
  };
}

router.get('/:token', (req, res) => {
  const item = resolve(req.params.token);
  if (!item) return res.status(404).json({ error: 'This link is not valid any more.' });
  res.json(info(item));
});

router.post('/:token', (req, res) => {
  const item = resolve(req.params.token);
  if (!item) return res.status(404).json({ error: 'This link is not valid any more.' });

  // The owner can't answer their own items.
  const callerId = userIdFromRequest(req);
  if (callerId && String(callerId) === item.owner) {
    return res.status(403).json({ error: 'You can’t answer your own items.' });
  }

  const existing = store.answers.get(item.id);
  const value = req.body.value === undefined ? existing && existing.value : req.body.value;
  if (!['lot', 'little', 'none'].includes(value)) {
    return res.status(400).json({ error: 'Pick one of the three answers.' });
  }
  const comment = typeof req.body.comment === 'string' ? req.body.comment.trim().slice(0, 1000) : undefined;
  store.answers.upsert(item.id, value, comment);
  if (!item.answeredAt) store.items.update(item.id, { answeredAt: new Date().toISOString() });
  res.json(info(item));
});

module.exports = router;
