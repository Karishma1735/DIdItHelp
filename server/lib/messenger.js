// Decides HOW a message leaves the app. Order, always:
//   1. the SENDER's own connected Slack or Gmail (through viaSocket), so it really comes from them;
//   2. the shared viaSocket flow (webhook), only when the sender has nothing connected;
//   3. a clear error, so nothing is ever dropped silently.
// If the sender IS connected but the receiver can't be found (or matches several people), that is reported as it is:
// it never silently falls back to a different account.
const store = require('./store');
const apps = require('./viasocketApps'); // used as apps.fn(...) so tests can replace the functions
const via = require('./viasocket');

const NOT_CONNECTED = new Set(['not_configured', 'not_connected', 'no_gmail', 'expired']);

const connectHint = (what) => `${what} Connect Slack or Gmail on the Integrations page so it goes from you.`;

// One message to one contact (an email address or a Slack @name), from `senderId`'s own account.
async function viaOwnAccount(senderId, contact, { subject, text, html }) {
  const channel = via.channelFor(contact);
  if (channel === 'email') {
    const r = await apps.sendGmailAs(senderId, { to: contact.trim(), subject, body: html || text });
    return { ...r, channel };
  }
  const found = await apps.findSlackUser(senderId, contact);
  if (!found.ok) return { ...found, channel };
  const r = await apps.sendSlackDM(senderId, found.id, text);
  return { ...r, channel };
}

// The "Did it help?" ask (and its 2-day reminder), sent to the receiver FROM the person who delivered the work.
async function sendAsk(item, owner, isReminder = false) {
  const links = await via.createAnswerLinks(item.id);
  const text = (isReminder ? 'Reminder: ' : '') + via.messageText(item, owner, links);
  const subject = `${isReminder ? 'Reminder: ' : ''}Did “${item.what}” help you?`;

  // Email gets real buttons (HTML); Slack gets the same question with two links.
  const own = await viaOwnAccount(owner.id, item.contact, { subject, text, html: via.emailHtml(item, owner, links, isReminder) });
  if (own.ok) return { ok: true, channel: own.channel };
  if (!NOT_CONNECTED.has(own.reason)) return { ok: false, channel: own.channel, error: own.error };

  if (process.env.VIASOCKET_ASK_WEBHOOK_URL) return via.sendAskViaWebhook(item, owner, links, isReminder);
  return { ok: false, channel: own.channel, error: connectHint(`This ${own.channel === 'email' ? 'email' : 'Slack message'} could not be sent from your account.`) };
}

// A team invite, sent FROM the manager's own account.
async function sendInvite({ senderId, contact, name, managerName, joinUrl, expiresAt, makeManager }) {
  const text = [
    `Hi ${name || 'there'}, ${managerName} invited you to join their team on Did it help?.`,
    `Create your account here: ${joinUrl}`,
    `The link works once and expires on ${new Date(expiresAt).toDateString()}.${makeManager ? ' You will be able to manage a team too.' : ''}`,
  ].join('\n');
  const own = await viaOwnAccount(senderId, contact, { subject: `${managerName} invited you to Did it help?`, text });
  if (own.ok) return { ok: true, channel: own.channel };
  if (!NOT_CONNECTED.has(own.reason)) return { ok: false, channel: own.channel, error: own.error };

  if (process.env.VIASOCKET_INVITE_WEBHOOK_URL) return via.sendInviteViaWebhook({ contact, name, managerName, joinUrl, expiresAt, makeManager });
  return { ok: false, channel: own.channel, error: connectHint('The invite could not be sent from your account.') };
}

// A reminder to a person about their OWN day, sent to themself. If they set a reminder contact, that channel is used;
// otherwise their own Slack (if connected and "which one is you" is picked), then their own Gmail.
// reason 'no_channel' means there is simply no way to reach them: the caller does not retry that every 5 minutes.
async function sendReminder(user, { kind, day, what, forWhom, deadline, plannedDay }) {
  const first = String(user.name).split(' ')[0];
  const dash = via.appUrl();
  const text =
    kind === 'deadline'
      ? `Hi ${first}, your deadline for “${what}” (${deadline}) has passed and it isn't delivered yet. Open Did it help?: ${dash}`
      : `Good morning ${first}. What will you deliver today? Plan it here: ${dash}`;
  const subject = kind === 'deadline' ? `Deadline passed: ${what}` : 'What will you deliver today?';

  const tries = [];
  const slackMe = store.vsConn.get(user.id, 'slack');
  const explicit = (user.alertContact || '').trim();
  if (explicit) {
    tries.push(via.channelFor(explicit) === 'email' ? { email: explicit } : { slack: slackMe && slackMe.slackUserId });
  } else {
    tries.push({ slack: slackMe && slackMe.slackUserId }, { email: user.email });
  }

  let last = null;
  for (const t of tries) {
    if (t.slack) last = await apps.sendSlackDM(user.id, t.slack, text);
    else if (t.email) last = await apps.sendGmailAs(user.id, { to: t.email, subject, body: text });
    else continue;
    if (last.ok) return { ok: true };
    if (!NOT_CONNECTED.has(last.reason)) return { ok: false, reason: last.reason, error: last.error };
  }

  if (process.env.VIASOCKET_REMINDER_WEBHOOK_URL) return via.sendReminderViaWebhook(user, { kind, day, what, forWhom, deadline, plannedDay });
  return { ok: false, reason: 'no_channel', error: 'No way to reach this person: nothing connected and no shared flow set up.' };
}

module.exports = { sendAsk, sendInvite, sendReminder, viaOwnAccount };
