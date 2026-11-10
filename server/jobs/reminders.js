const cron = require('node-cron');
const Item = require('../models/Item');
const User = require('../models/User');
const { sendAsk } = require('../lib/viasocket');
const dates = require('../lib/dates');

const TWO_DAYS = 2 * 24 * 60 * 60 * 1000;

// Sends at most ONE reminder per item. The item is claimed atomically (reminderSentAt set first),
// so overlapping runs can't double-send. If viaSocket fails, the claim is released to retry next run.
async function runReminders() {
  const cutoff = new Date(Date.now() - TWO_DAYS);
  const due = await Item.find({
    status: 'delivered',
    askedAt: { $lte: cutoff },
    answeredAt: null,
    reminderSentAt: null,
  });

  let sent = 0;
  let failed = 0;
  for (const candidate of due) {
    const claimed = await Item.findOneAndUpdate(
      { _id: candidate._id, reminderSentAt: null, answeredAt: null },
      { $set: { reminderSentAt: new Date() } },
      { new: true }
    );
    if (!claimed) continue;
    const owner = await User.findById(claimed.owner);
    const result = owner ? await sendAsk(claimed, owner, true) : { ok: false };
    if (result.ok) {
      sent += 1;
    } else {
      failed += 1;
      await Item.updateOne({ _id: claimed._id }, { $set: { reminderSentAt: null } });
    }
  }
  return { checked: due.length, sent, failed };
}

function startReminderJob() {
  cron.schedule(
    '0 9 * * *',
    () => runReminders().then((r) => console.log('Reminder job:', r)).catch((e) => console.error('Reminder job failed', e)),
    { timezone: dates.TZ }
  );
  // Catch up shortly after boot in case the host was asleep at 09:00.
  setTimeout(() => runReminders().catch((e) => console.error('Reminder job failed', e)), 30000);
}

module.exports = { runReminders, startReminderJob };
