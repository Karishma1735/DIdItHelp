// Read-only status of the viaSocket wiring, for the Integrations page. Never returns secrets.
const express = require('express');
const store = require('../lib/store');
const { requireAuth } = require('../middleware/auth');
const { appUrl } = require('../lib/viasocket');

const router = express.Router();
router.use(requireAuth);
router.use((req, res, next) => {
  const me = store.users.byId(req.userId);
  if (!me || !me.isManager) return res.status(403).json({ error: 'Integrations are for managers.' });
  next();
});

router.get('/', (req, res) => {
  const base = appUrl();
  const set = (k) => !!process.env[k];
  res.json({
    appUrl: base,
    flows: [
      {
        id: 'ask',
        name: 'Ask message',
        env: 'VIASOCKET_ASK_WEBHOOK_URL',
        configured: set('VIASOCKET_ASK_WEBHOOK_URL'),
        purpose: 'Sends “Did it help?” with three one-tap links to the receiver when you mark something delivered or ask again, plus one reminder after 2 days.',
        fields: ['channel', 'to', 'receiverName', 'ownerName', 'what', 'proofUrl', 'answerUrl', 'lotUrl', 'littleUrl', 'noneUrl', 'isReminder'],
      },
      {
        id: 'reminder',
        name: 'Morning prompt and deadline reminder',
        env: 'VIASOCKET_REMINDER_WEBHOOK_URL',
        configured: set('VIASOCKET_REMINDER_WEBHOOK_URL'),
        purpose: 'Every weekday at 10:00 asks each person who has not planned yet “What will you deliver today?”, and reminds a person once when an item’s deadline passes without delivery. Goes to their Slack @name or email.',
        fields: ['kind', 'channel', 'to', 'receiverName', 'dashboardUrl', 'what', 'forWhom', 'deadline', 'plannedDay'],
      },
      {
        id: 'invite',
        name: 'Team invite',
        env: 'VIASOCKET_INVITE_WEBHOOK_URL',
        configured: set('VIASOCKET_INVITE_WEBHOOK_URL'),
        purpose: 'Sends a new teammate their invite link on Slack or email when you add them on the Team page.',
        fields: ['kind', 'channel', 'to', 'receiverName', 'managerName', 'joinUrl', 'expiresAt', 'isManager'],
      },
    ],
    routines: {
      keySet: set('DIGEST_KEY'),
      items: [
        { id: 'morning', name: 'Morning plan', when: '10:00 on weekdays', cron: '0 10 * * 1-5', url: `${base}/api/today?key=<DIGEST_KEY>`, send: 'morningMessage', to: 'you' },
        { id: 'evening', name: 'Evening check', when: '18:30 on weekdays', cron: '30 18 * * 1-5', url: `${base}/api/today?key=<DIGEST_KEY>`, send: 'eveningMessage', to: 'you' },
        { id: 'friday', name: 'Weekly summary', when: 'Friday 17:00', cron: '0 17 * * 5', url: `${base}/api/digest?key=<DIGEST_KEY>`, send: 'summaryText', to: 'your mentor' },
      ],
      reminders: { when: 'Every day at 09:00', path: '/tasks/reminders' },
    },
    embed: {
      orgId: process.env.VIASOCKET_ORG_ID || null,
      projectId: process.env.VIASOCKET_PROJECT_ID || null,
      secretSet: set('VIASOCKET_EMBED_SECRET'),
      panelEnabled: false,
    },
  });
});

module.exports = router;
