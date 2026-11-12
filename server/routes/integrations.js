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
        purpose: 'Backup for the “Did it help?” ask. The app sends it from the person’s own connected Slack or Gmail. This shared flow is used only when the sender has neither connected.',
        fields: ['channel', 'to', 'receiverName', 'ownerName', 'what', 'proofUrl', 'answerUrl', 'helpedUrl', 'noneUrl', 'isReminder'],
      },
      {
        id: 'reminder',
        name: 'Morning prompt and deadline reminder',
        env: 'VIASOCKET_REMINDER_WEBHOOK_URL',
        configured: set('VIASOCKET_REMINDER_WEBHOOK_URL'),
        purpose: 'Backup for the 10:00 “What will you deliver today?” prompt and the deadline reminder. The app sends them to each person from their own connected Slack or Gmail. This shared flow is used only for people who have neither connected.',
        fields: ['kind', 'channel', 'to', 'receiverName', 'dashboardUrl', 'what', 'forWhom', 'deadline', 'plannedDay'],
      },
      {
        id: 'invite',
        name: 'Team invite',
        env: 'VIASOCKET_INVITE_WEBHOOK_URL',
        configured: set('VIASOCKET_INVITE_WEBHOOK_URL'),
        purpose: 'Backup for team invites. The app sends them from the manager’s own connected Slack or Gmail. This shared flow is used only when the manager has neither connected.',
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
