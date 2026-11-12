// Endpoints for viaSocket schedules. Protected by ?key=<DIGEST_KEY>.
const express = require('express');
const store = require('../lib/store');
const dates = require('../lib/dates');
const scoring = require('../lib/scoring');
const { loadItems, serializeItem } = require('../lib/overview');
const { appUrl } = require('../lib/viasocket');
const { safeEqual } = require('../lib/tokens');
const { runReminders } = require('../jobs/reminders');
const { runTick } = require('../jobs/tick');

const router = express.Router();

function keyCheck(req, res, next) {
  const expected = process.env.DIGEST_KEY;
  const given = typeof req.query.key === 'string' ? req.query.key : '';
  if (!expected || !safeEqual(given, expected)) return res.status(401).json({ error: 'Invalid key.' });
  next();
}

// ?user=<email or id> picks whose plan to report; default is the first account.
function pickUser(req) {
  const u = typeof req.query.user === 'string' ? req.query.user.trim() : '';
  if (!u) return store.users.first();
  return /^\d+$/.test(u) ? store.users.byId(u) : store.users.byEmail(u.toLowerCase());
}

const brief = (i) => ({
  id: i.id,
  what: i.what,
  forWhom: i.forWhom,
  plannedDay: i.plannedDay,
  state: i.state,
  proofUrl: i.proofUrl || undefined,
});
const bullets = (list) => (list.length ? list.map((i) => `• ${i.what} (for ${i.forWhom})`).join('\n') : 'None');

router.get('/today', keyCheck, async (req, res) => {
  const user = pickUser(req);
  if (!user) return res.status(404).json({ error: 'No owner account yet.' });
  const today = dates.today();
  const all = (await loadItems(user.id)).map((i) => serializeItem(i, today));

  const plan = all.filter((i) => i.plannedDay === today && i.status !== 'dropped');
  const deliveredToday = all.filter((i) => i.status === 'delivered' && String(i.deliveredAt && dates.dayOf(new Date(i.deliveredAt))) === today);
  const late = all.filter((i) => i.state === 'late');
  const notYetAsked = all.filter((i) => i.state === 'unasked');
  const notDelivered = [...late, ...plan.filter((i) => i.status === 'planned' && !late.includes(i))];

  res.json({
    date: today,
    owner: { name: user.name },
    dashboardUrl: appUrl(),
    plan: plan.map(brief),
    deliveredToday: deliveredToday.map(brief),
    late: late.map(brief),
    notYetAsked: notYetAsked.map(brief),
    notDelivered: notDelivered.map(brief),
    morningMessage: `Good morning ${user.name.split(' ')[0]}. What will you deliver today? ${appUrl()}`,
    eveningMessage:
      `Not delivered yet:\n${bullets(notDelivered)}\n\nDelivered but not asked yet:\n${bullets(notYetAsked)}\n\n${appUrl()}`,
  });
});

router.get('/digest', keyCheck, async (req, res) => {
  const user = pickUser(req);
  if (!user) return res.status(404).json({ error: 'No owner account yet.' });
  const today = dates.today();
  const weekStart = dates.weekStartOf(today);
  const all = await loadItems(user.id);
  const s = scoring.scoreWeek(all, weekStart);
  const hero = scoring.heroSentence(user.name, s, today);
  const numbers = { impact: s.impact, reliability: s.reliability, answerRate: s.answerRate };
  const waiting = all
    .filter((i) => i.status === 'delivered' && !i.answer)
    .map((i) => serializeItem(i, today))
    .map((i) => ({ ...brief(i), askedAt: i.askedAt, askedVia: i.askedVia }));
  const pct = (v) => (v === null ? 'n/a' : `${v}%`);

  res.json({
    date: today,
    week: { start: weekStart, end: s.weekEnd },
    owner: { name: user.name },
    mentor: { name: user.mentorName, contact: user.mentorContact },
    hero,
    numbers,
    waiting,
    summaryText:
      `${hero}\n\nImpact: ${s.impact} pts · Reliability: ${pct(s.reliability)} · Answer rate: ${pct(s.answerRate)}` +
      `\n\nStill waiting for an answer:\n${bullets(waiting)}\n\n${appUrl()}`,
  });
});

// Backup trigger for the reminder job, for hosts that sleep and miss the daily cron.
router.get('/jobs/reminders', keyCheck, async (req, res) => {
  res.json(await runReminders());
});

// Backup trigger for the 5-minute job, for a flow or host that cannot use the scheduler.
router.get('/jobs/tick', keyCheck, async (req, res) => {
  res.json(await runTick());
});

module.exports = router;
