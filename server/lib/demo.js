// Sample employee with realistic data, so a manager can see a filled-in dashboard.
// Everything created here is flagged is_demo and can be removed in one click.
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const store = require('./store');
const dates = require('./dates');

// [days from today, what, for whom, outcome, comment]
const PLAN = [
  [-9, 'Onboarding checklist', 'Priya', 'helped', ''],
  [-8, 'Release notes template', 'Arjun', 'helped', ''],
  [-6, 'Staging environment fix', 'Neha', 'helped', 'Unblocked our whole QA round.'],
  [-5, 'API docs refresh', 'Priya', 'none', 'Useful, but I needed the auth section.'],
  [-4, 'Old weekly report', 'Arjun', 'dropped', ''],
  [-3, 'Zoho plug', 'Rahul', 'helped', 'Saved me an afternoon.'],
  [-2, 'Bug triage sheet', 'Arjun', 'helped', ''],
  [-1, 'Slack alert flow', 'Neha', 'waiting', ''],
  [-1, 'Refactor billing module', 'Priya', 'late', ''],
  [0, 'Sprint demo deck', 'Neha', 'helped', 'Exactly what I needed for the demo.'],
  [0, 'Customer FAQ page', 'Priya', 'deliveredToday', ''],
  [0, 'Weekly metrics dashboard', 'Rahul', 'due', ''],
];

function seedDemo(manager) {
  const today = dates.today();
  const passwordHash = bcrypt.hashSync(crypto.randomBytes(24).toString('hex'), 4); // nobody can log in as the sample user
  return store.tx(() => {
    const demo = store.users.create({
      name: 'Demo Employee',
      role: 'Sample data (safe to remove)',
      email: `demo-${crypto.randomBytes(5).toString('hex')}@sample.invalid`,
      passwordHash,
      reportsTo: manager.id,
      isDemo: true,
    });
    PLAN.forEach(([offset, what, forWhom, outcome, comment], n) => {
      const day = dates.addDays(today, offset);
      const item = store.items.create({
        owner: demo.id, what, forWhom, contact: `@${forWhom.toLowerCase()}`, isForMentor: false, plannedDay: day,
      });
      if (outcome === 'dropped') return store.items.update(item.id, { status: 'dropped', droppedAt: `${day}T08:00:00.000Z` });
      if (outcome === 'late' || outcome === 'due') return null;
      const deliveredAt = `${day}T09:00:00.000Z`;
      const askedAt = `${day}T10:00:00.000Z`;
      store.items.update(item.id, {
        status: 'delivered',
        proofUrl: `https://example.com/proof/${n + 1}`,
        deliveredAt,
        askedAt,
        askedVia: 'slack',
        reminderSentAt: askedAt, // keeps the sample from ever triggering a real reminder
      });
      if (['helped', 'none'].includes(outcome)) {
        store.answers.upsert(item.id, outcome, comment);
        store.items.update(item.id, { answeredAt: `${day}T15:00:00.000Z` });
      }
      return null;
    });
    return demo;
  });
}

module.exports = { seedDemo };
