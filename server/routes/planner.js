// The AI day planner. It only drafts a day; creating items still goes through the normal, validated routes, after the person clicks.
const express = require('express');
const rateLimit = require('express-rate-limit');
const store = require('../lib/store');
const dates = require('../lib/dates');
const planner = require('../lib/planner');
const { requireAuth } = require('../middleware/auth');
const { configured } = require('../lib/viasocketClient');

const router = express.Router();
router.use(requireAuth);
router.use((req, res, next) => {
  if (!configured()) return res.status(503).json({ error: 'The planner is not set up on the server yet. You can still add tasks by hand.' });
  next();
});

const limiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => `p${req.userId}`,
  message: { error: 'Too many requests. Please wait a few minutes.' },
});

router.post('/draft', limiter, async (req, res) => {
  const day = req.body.day === undefined ? dates.today() : req.body.day;
  if (!dates.isDay(day) || day < dates.today()) return res.status(400).json({ error: 'Pick today or a later day.' });
  const r = await planner.draft(store.users.byId(req.userId), req.body.text, day);
  if (!r.ok) return res.status(r.status).json({ error: r.error });
  res.json(r.draft);
});

module.exports = router;
