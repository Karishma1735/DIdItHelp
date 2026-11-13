// The only place the server talks to viaSocket. Never called from the browser.
const { generateToken, hashToken } = require('./tokens');
const store = require('./store');
const alerts = require('./alerts');

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
    helpedUrl: `${answerUrl}?v=helped`,
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
    `Helped: ${links.helpedUrl}`,
    `Didn't help: ${links.noneUrl}`,
    '',
    `Thanks, ${owner.name}`,
  ].join('\n');
}

const esc = (v) =>
  String(v).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');

// The ask as an HTML email: two big buttons, Helped and Didn't help. Everything that came from a person is escaped.
function emailHtml(item, owner, links, isReminder = false) {
  const button = (href, label, bg) =>
    `<a href="${esc(href)}" style="display:inline-block;padding:14px 30px;margin:6px 10px 6px 0;border-radius:8px;background:${bg};color:#ffffff;font-family:Arial,Helvetica,sans-serif;font-size:16px;font-weight:bold;text-decoration:none">${esc(label)}</a>`;
  return `<div style="font-family:Arial,Helvetica,sans-serif;max-width:520px;color:#14202E;line-height:1.55;font-size:15px">
${isReminder ? '<p style="margin:0 0 10px;color:#5F7285;font-size:13px">Reminder</p>' : ''}<p style="margin:0 0 12px">Hi ${esc(item.forWhom)},</p>
<p style="margin:0 0 12px">${esc(owner.name)} delivered <strong>“${esc(item.what)}”</strong>. Did it help you?</p>
<p style="margin:0 0 18px"><a href="${esc(item.proofUrl)}" style="color:#2B4257">See what was delivered</a></p>
<p style="margin:0 0 8px">${button(links.helpedUrl, 'Helped', '#1F6B4A')}${button(links.noneUrl, "Didn't help", '#5F7285')}</p>
<p style="margin:14px 0 0;color:#8396A8;font-size:12px">One tap is enough. No login needed.</p>
</div>`;
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
    if (res.status >= 200 && res.status < 300) { alerts.ok('messages-failing'); return { ok: true, channel: payload.channel }; }
    alerts.bad('messages-failing', { who: `webhook:${envName}`, detail: `a viaSocket webhook answered with status ${res.status}` });
    return { ok: false, channel: payload.channel, error: `viaSocket answered with status ${res.status}.` };
  } catch (err) {
    const why = err.name === 'AbortError' ? 'timed out' : 'could not be reached';
    alerts.bad('messages-failing', { who: `webhook:${envName}`, detail: `a viaSocket webhook ${why}` });
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

module.exports = { appUrl, channelFor, createAnswerLinks, messageText, emailHtml, postToViaSocket, sendAskViaWebhook, sendInviteViaWebhook, sendReminderViaWebhook };
