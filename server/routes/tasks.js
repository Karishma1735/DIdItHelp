// Routes called on a timer by the host's scheduler (see embarko.json).
// The host sends "Authorization: Bearer <CRON_SECRET>".
const express = require('express');
const { runReminders } = require('../jobs/reminders');
const { runTick } = require('../jobs/tick');
const { safeEqual } = require('../lib/tokens');

const router = express.Router();

function authorised(req) {
  const expected = process.env.CRON_SECRET;
  const given = req.get('authorization') || '';
  return !!expected && safeEqual(given, `Bearer ${expected}`);
}

router.get('/reminders', async (req, res) => {
  if (!authorised(req)) return res.sendStatus(401);
  const r = await runReminders();
  res.send(`Reminders: checked ${r.checked}, sent ${r.sent}, failed ${r.failed}`);
});

// Every 5 minutes: the morning prompt and deadline reminders.
router.get('/tick', async (req, res) => {
  if (!authorised(req)) return res.sendStatus(401);
  const r = await runTick();
  res.send(`Morning: sent ${r.morning.sent}, failed ${r.morning.failed}. Deadlines: sent ${r.deadlines.sent}, failed ${r.deadlines.failed}`);
});

module.exports = router;
