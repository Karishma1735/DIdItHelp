const express = require('express');
const AnswerToken = require('../models/AnswerToken');
const Answer = require('../models/Answer');
const Item = require('../models/Item');
const User = require('../models/User');
const { hashToken } = require('../lib/tokens');
const { userIdFromRequest } = require('../middleware/auth');
const { answerLimiter } = require('../middleware/rateLimits');

const router = express.Router();
router.use(answerLimiter);

async function resolve(token) {
  const found = await AnswerToken.findOne({ tokenHash: hashToken(token) });
  if (!found) return null;
  const item = await Item.findById(found.item);
  if (!item || item.status !== 'delivered') return null;
  return item;
}

async function info(item) {
  const owner = await User.findById(item.owner);
  const answer = await Answer.findOne({ item: item._id });
  return {
    what: item.what,
    receiverName: item.forWhom,
    ownerName: owner ? owner.name : '',
    proofUrl: item.proofUrl,
    deliveredAt: item.deliveredAt,
    answer: answer ? { value: answer.value, comment: answer.comment } : null,
  };
}

router.get('/:token', async (req, res) => {
  const item = await resolve(req.params.token);
  if (!item) return res.status(404).json({ error: 'This link is not valid any more.' });
  res.json(await info(item));
});

router.post('/:token', async (req, res) => {
  const item = await resolve(req.params.token);
  if (!item) return res.status(404).json({ error: 'This link is not valid any more.' });

  // The owner can't answer their own items.
  const callerId = userIdFromRequest(req);
  if (callerId && String(callerId) === String(item.owner)) {
    return res.status(403).json({ error: 'You can’t answer your own items.' });
  }

  const existing = await Answer.findOne({ item: item._id });
  const value = req.body.value === undefined ? existing && existing.value : req.body.value;
  if (!['lot', 'little', 'none'].includes(value)) {
    return res.status(400).json({ error: 'Pick one of the three answers.' });
  }
  const update = { value };
  if (typeof req.body.comment === 'string') update.comment = req.body.comment.trim().slice(0, 1000);
  if (!existing) update.answeredAt = new Date();

  await Answer.findOneAndUpdate({ item: item._id }, { $set: update }, { upsert: true, new: true, setDefaultsOnInsert: true });
  if (!item.answeredAt) {
    item.answeredAt = new Date();
    await item.save();
  }
  res.json(await info(item));
});

module.exports = router;
