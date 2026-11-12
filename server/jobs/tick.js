// Runs every 5 minutes (see embarko.json): the morning "what will you deliver?" prompt and deadline reminders.
// Every message is claimed in the database BEFORE it is sent, so overlapping runs can never send one twice.
// If viaSocket fails, the claim is released and the next run tries again.
const store = require('../lib/store');
const dates = require('../lib/dates');
const { sendReminder } = require('../lib/viasocket');

const MORNING_HOUR = () => Number(process.env.MORNING_HOUR || 10);
const MORNING_UNTIL = 14; // a missed morning prompt is still sent until 14:00, then dropped

async function runTick(now = new Date()) {
  const t = dates.localParts(now);
  const out = { morning: { sent: 0, failed: 0 }, deadlines: { sent: 0, failed: 0 } };

  // Morning: everyone with nothing planned for today, on weekdays, once.
  if (t.weekday && t.hour >= MORNING_HOUR() && t.hour < MORNING_UNTIL) {
    for (const user of store.users.withoutPlanFor(t.day)) {
      if (!store.notices.claim(user.id, 'morning_plan', t.day)) continue;
      const r = await sendReminder(user, { kind: 'morning_plan', day: t.day });
      if (r.ok) out.morning.sent += 1;
      else {
        out.morning.failed += 1;
        store.notices.release(user.id, 'morning_plan', t.day);
      }
    }
  }

  // Deadlines: items planned for today whose time has passed and that are not delivered. One reminder per item.
  for (const item of store.items.dueForDeadline(t.day, t.hm)) {
    if (!store.items.claimDeadlineReminder(item.id)) continue;
    const owner = store.users.byId(item.owner);
    const r = owner
      ? await sendReminder(owner, { kind: 'deadline', what: item.what, forWhom: item.forWhom, deadline: item.deadlineTime, plannedDay: item.plannedDay })
      : { ok: false };
    if (r.ok) out.deadlines.sent += 1;
    else {
      out.deadlines.failed += 1;
      store.items.releaseDeadlineReminder(item.id);
    }
  }
  return out;
}

module.exports = { runTick };
