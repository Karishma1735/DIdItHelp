// Blocks: time in the 8-hour day with no receiver (meetings, learning, support, admin). Never scored.
const express = require('express');
const store = require('../lib/store');
const dates = require('../lib/dates');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();
router.use(requireAuth);

const KINDS = ['meeting', 'learning', 'support', 'admin', 'other'];

router.post('/', (req, res) => {
  const title = typeof req.body.title === 'string' ? req.body.title.trim().slice(0, 120) : '';
  const minutes = Number(req.body.minutes);
  const day = req.body.day === undefined ? dates.today() : req.body.day;
  const kind = KINDS.includes(req.body.kind) ? req.body.kind : 'other';
  const startTime = req.body.startTime ? req.body.startTime : null;
  if (!title) return res.status(400).json({ error: 'Say what the time is for, like “Team standup”.' });
  if (!Number.isInteger(minutes) || minutes < 5 || minutes > 720) return res.status(400).json({ error: 'The time must be between 5 minutes and 12 hours.' });
  if (!dates.isDay(day) || day < dates.today()) return res.status(400).json({ error: 'Pick today or a later day.' });
  if (startTime !== null && !dates.isTime(startTime)) return res.status(400).json({ error: 'Pick a start time, like 10:00.' });
  res.status(201).json({ block: store.blocks.create(req.userId, { day, title, minutes, startTime, kind }) });
});

router.delete('/:id', (req, res) => {
  if (!/^\d+$/.test(req.params.id) || !store.blocks.remove(req.params.id, req.userId)) return res.status(404).json({ error: 'Block not found.' });
  res.json({ ok: true });
});

module.exports = router;
