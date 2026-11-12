// The report emailed to a person's manager when they submit work in the evening.
// It is built only from the person's own items and never includes a receiver's contact details.
const store = require('./store');
const dates = require('./dates');
const scoring = require('./scoring');
const hours = require('./hours');
const { appUrl } = require('./viasocket');
const { sendGmailAs } = require('./viasocketApps');

const REPORT_FROM_HOUR = () => Number(process.env.REPORT_FROM_HOUR ?? 16);
const ANSWER = { helped: 'helped', lot: 'helped a lot', little: 'helped a little', none: 'did not help' };

function buildReport(employee, justDelivered, now = new Date()) {
  const t = dates.localParts(now);
  const byAnswer = new Map(store.answers.listByOwner(employee.id).map((a) => [a.itemId, a]));
  const all = store.items.listByOwner(employee.id).map((i) => ({ ...i, answer: byAnswer.get(i.id) || null }));
  const deliveredDay = (i) => (i.deliveredAt ? dates.dayOf(new Date(i.deliveredAt)) : null);
  const line = (i) =>
    `- ${i.what} (for ${i.forWhom})` +
    (i.proofUrl ? ` - proof: ${i.proofUrl}` : '') +
    (i.answer ? ` - receiver said it ${ANSWER[i.answer.value]}` : i.askedAt ? ' - waiting for an answer' : '');

  const deliveredToday = all.filter((i) => i.status === 'delivered' && deliveredDay(i) === t.day);
  const open = all.filter((i) => i.status === 'planned' && i.plannedDay === t.day);
  const late = all.filter((i) => i.status === 'planned' && i.plannedDay < t.day);
  const score = scoring.scoreWeek(all, dates.weekStartOf(t.day));
  const hrs = hours.dayHours(all, store.blocks.listByDay(employee.id, t.day), t.day);
  const list = (items, fn) => (items.length ? items.map(fn).join('\n') : '- none');

  const body = [
    `${employee.name} just delivered "${justDelivered.what}" (for ${justDelivered.forWhom}).`,
    `Proof: ${justDelivered.proofUrl}`,
    '',
    `The day so far (${t.day})`,
    '',
    'Delivered today:',
    list(deliveredToday, line),
    '',
    'Still open for today:',
    list(open, (i) => `- ${i.what} (for ${i.forWhom}) - deadline ${i.deadlineTime}`),
    '',
    'Late from earlier days:',
    list(late, (i) => `- ${i.what} (for ${i.forWhom}) - planned ${i.plannedDay}`),
    '',
    hrs.planned
      ? `Hours today: ${hours.fmt(hrs.planned)} planned of ${hours.fmt(hrs.capacity)}` +
        (hrs.unplanned ? ` (${hours.fmt(hrs.unplanned)} not planned)` : hrs.over ? ` (${hours.fmt(hrs.over)} over)` : '') +
        `, ${hours.fmt(hrs.deliveredMinutes)} delivered so far.`
      : 'Hours today: nothing planned with a time.',
    scoring.heroSentence(employee.name, score, t.day),
    '',
    `Open the dashboard: ${appUrl()}/team`,
    '',
    'Sent from ' + employee.name + "'s own Gmail by Did it help?.",
  ].join('\n');

  return { subject: `Evening report from ${employee.name}: delivered "${justDelivered.what}"`, body };
}

const WHY = {
  no_gmail: 'Report not emailed: connect your Gmail on the Integrations page so your manager gets it.',
  expired: 'Report not emailed: your Gmail connection expired. Connect it again on the Integrations page.',
  not_configured: 'Report not emailed: email is not set up on the server yet.',
  failed: 'Report not emailed: Gmail did not accept it. It will work again on your next submission.',
};

// Called after an item is delivered. Never throws and never blocks the delivery.
// Returns null when no report is due (before the evening, no manager, or a sample employee).
async function emailManagerReport(item, now = new Date()) {
  try {
    const employee = store.users.byId(item.owner);
    if (!employee || employee.isDemo || !employee.reportsTo) return null;
    if (dates.localParts(now).hour < REPORT_FROM_HOUR()) return null;
    const manager = store.users.byId(employee.reportsTo);
    if (!manager) return null;

    const { subject, body } = buildReport(employee, item, now);
    const r = await sendGmailAs(employee.id, { to: manager.email, subject, body });
    store.items.update(item.id, r.ok ? { reportSentAt: new Date().toISOString(), reportError: '' } : { reportError: WHY[r.reason] || WHY.failed });
    return r;
  } catch (err) {
    console.error('manager report failed', err.message);
    return null;
  }
}

module.exports = { buildReport, emailManagerReport };
