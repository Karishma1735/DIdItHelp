const store = require('../lib/store');
const { sendAsk } = require('../lib/messenger');

const TWO_DAYS = 2 * 24 * 60 * 60 * 1000;

// Sends at most ONE reminder per item. The item is claimed atomically (reminderSentAt set first),
// so overlapping runs can't double-send. If viaSocket fails, the claim is released to retry next run.
async function runReminders() {
  const cutoff = new Date(Date.now() - TWO_DAYS).toISOString();
  const due = store.items.dueForReminder(cutoff);

  let sent = 0;
  let failed = 0;
  for (const candidate of due) {
    if (!store.items.claimReminder(candidate.id)) continue;
    const claimed = store.items.get(candidate.id);
    const owner = store.users.byId(claimed.owner);
    const result = owner ? await sendAsk(claimed, owner, true) : { ok: false };
    if (result.ok) {
      sent += 1;
    } else {
      failed += 1;
      store.items.releaseReminder(claimed.id);
    }
  }
  return { checked: due.length, sent, failed };
}

module.exports = { runReminders };
