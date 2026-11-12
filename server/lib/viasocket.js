// The only place the server talks to viaSocket. Never called from the browser.
const { generateToken, hashToken } = require('./tokens');
const store = require('./store');

const appUrl = () => (process.env.APP_URL || 'http://localhost:5000').replace(/\/+$/, '');
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// An email address means "email", anything else (e.g. @rahul) means "slack".
const channelFor = (contact) => (EMAIL_RE.test(String(contact).trim()) ? 'email' : 'slack');

// Every ask or copied message gets a fresh token. Earlier links keep working.
async function createAnswerLinks(itemId) {
  const raw = generateToken();
  store.tokens.create(itemId, hashToken(raw));
  const answerUrl = `${appUrl()}/a/${raw}`;
  return {
    answerUrl,
    lotUrl: `${answerUrl}?v=lot`,
    littleUrl: `${answerUrl}?v=little`,
    noneUrl: `${answerUrl}?v=none`,
  };
}

function buildPayload(item, owner, links, isReminder) {
  const contact = item.contact.trim();
  return {
    channel: channelFor(contact),
    to: contact,
    receiverName: item.forWhom,
    ownerName: owner.name,
    what: item.what,
    proofUrl: item.proofUrl,
    ...links,
    isReminder: !!isReminder,
  };
}

function messageText(item, owner, links) {
  return [
    `Hi ${item.forWhom}, I delivered “${item.what}”. Did it help you?`,
    `Proof: ${item.proofUrl}`,
    '',
    `Helped a lot: ${links.lotUrl}`,
    `Helped a little: ${links.littleUrl}`,
    `Didn't help: ${links.noneUrl}`,
    '',
    `Thanks, ${owner.name}`,
  ].join('\n');
}

// Returns { ok, channel, error }. ok is true only for a 2xx response.
async function postToViaSocket(payload, envName = 'VIASOCKET_ASK_WEBHOOK_URL') {
  const url = process.env[envName];
  if (!url) return { ok: false, channel: payload.channel, error: `The viaSocket webhook (${envName}) is not set up on the server.` };
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 10000);
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
    if (res.status >= 200 && res.status < 300) return { ok: true, channel: payload.channel };
    return { ok: false, channel: payload.channel, error: `viaSocket answered with status ${res.status}.` };
  } catch (err) {
    const why = err.name === 'AbortError' ? 'timed out' : 'could not be reached';
    return { ok: false, channel: payload.channel, error: `viaSocket ${why}.` };
  } finally {
    clearTimeout(timer);
  }
}

async function sendAskViaWebhook(item, owner, links, isReminder = false) {
  return postToViaSocket(buildPayload(item, owner, links, isReminder));
}

// Sends a team invite link to the new person's Slack or email through a separate viaSocket flow.
async function sendInviteViaWebhook({ contact, name, managerName, joinUrl, expiresAt, makeManager }) {
  return postToViaSocket(
    {
      kind: 'invite',
      channel: channelFor(contact),
      to: contact.trim(),
      receiverName: name || '',
      managerName,
      joinUrl,
      expiresAt,
      isManager: !!makeManager,
    },
    'VIASOCKET_INVITE_WEBHOOK_URL'
  );
}

// Reminders to a person about their OWN day: the morning prompt and the deadline reminder.
// Goes to the person's reminder contact (Slack @name or email), by default their account email.
async function sendReminderViaWebhook(user, extra) {
  const contact = (user.alertContact || user.email).trim();
  return postToViaSocket(
    { channel: channelFor(contact), to: contact, receiverName: user.name, dashboardUrl: appUrl(), ...extra },
    'VIASOCKET_REMINDER_WEBHOOK_URL'
  );
}

module.exports = { appUrl, channelFor, createAnswerLinks, messageText, postToViaSocket, sendAskViaWebhook, sendInviteViaWebhook, sendReminderViaWebhook };
