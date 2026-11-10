// Routes called on a timer by the host's scheduler (see embarko.json).
// The host sends "Authorization: Bearer <CRON_SECRET>".
const express = require('express');
const { runReminders } = require('../jobs/reminders');
const { safeEqual } = require('../lib/tokens');

const router = express.Router();

router.get('/reminders', async (req, res) => {
  const expected = process.env.CRON_SECRET;
  const given = req.get('authorization') || '';
  if (!expected || !safeEqual(given, `Bearer ${expected}`)) return res.sendStatus(401);
  const r = await runReminders();
  res.send(`Reminders: checked ${r.checked}, sent ${r.sent}, failed ${r.failed}`);
});

module.exports = router;
