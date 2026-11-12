// Builds the payload used by both the owner dashboard and the read-only manager view.
const store = require('./store');
const dates = require('./dates');
const scoring = require('./scoring');
const hours = require('./hours');

function loadItems(ownerId) {
  const byItem = new Map(store.answers.listByOwner(ownerId).map((a) => [a.itemId, a]));
  return store.items.listByOwner(ownerId).map((i) => ({ ...i, answer: byItem.get(i.id) || null }));
}

function serializeItem(item, today, { forManager = false } = {}) {
  const delivered = scoring.deliveredDay(item);
  return {
    id: item.id,
    what: item.what,
    forWhom: item.forWhom,
    contact: forManager ? undefined : item.contact,
    isForMentor: item.isForMentor,
    plannedDay: item.plannedDay,
    deadlineTime: item.deadlineTime,
    estimateMinutes: item.estimateMinutes,
    estimateAssumed: item.estimateAssumed,
    startTime: item.startTime,
    endTime: item.startTime && item.estimateMinutes ? hours.toHm(Math.min(1439, hours.toMin(item.startTime) + item.estimateMinutes)) : null,
    pastDeadline: item.status === 'planned' && (item.plannedDay < today || (item.plannedDay === today && dates.localParts().hm >= item.deadlineTime)),
    reportSentAt: item.reportSentAt,
    reportError: forManager ? undefined : item.reportError || undefined,
    status: item.status,
    state: scoring.itemState(item, today),
    proofUrl: item.proofUrl,
    proofFile: item.proofFileName ? { name: item.proofFileName, size: item.proofFileSize } : null,
    createdAt: item.createdAt,
    deliveredAt: item.deliveredAt,
    deliveredLate: !!delivered && delivered > item.plannedDay,
    askedAt: item.askedAt,
    askedVia: item.askedVia,
    askError: forManager ? undefined : item.askError || undefined,
    reminderSentAt: item.reminderSentAt,
    answeredAt: item.answeredAt,
    answer: item.answer ? { value: item.answer.value, comment: item.answer.comment } : null,
  };
}

// Which period is being looked at: ?view=day|week and ?date=YYYY-MM-DD (default: today, in the day view).
// The old ?week=YYYY-MM-DD still works and means that week.
function periodFor(params, today) {
  const q = params && typeof params === 'object' ? params : { date: params };
  const legacyWeek = q.week && dates.isDay(q.week) ? q.week : null;
  const view = legacyWeek || q.view === 'week' ? 'week' : 'day';
  const date = legacyWeek || (dates.isDay(q.date) ? q.date : today);
  const start = view === 'week' ? dates.weekStartOf(date) : date;
  const end = view === 'week' ? dates.weekEndOf(start) : date;
  return { kind: view, start, end, isCurrent: today >= start && today <= end };
}

async function buildOverview(user, params, opts = {}) {
  const today = dates.today();
  const period = periodFor(params, today);
  const all = loadItems(user.id);
  const ser = (i) => serializeItem(i, today, opts);

  const score = scoring.scorePeriod(all, period.start, period.end);
  const inPeriod = all.filter(
    (i) =>
      (i.plannedDay >= period.start && i.plannedDay <= period.end) ||
      (i.status === 'delivered' && scoring.deliveredDay(i) >= period.start && scoring.deliveredDay(i) <= period.end)
  );

  return {
    owner: { name: user.name, role: user.role },
    today,
    period,
    todaySection: {
      planned: all.filter((i) => i.plannedDay === today && i.status !== 'dropped').map(ser),
      deliveredToday: all.filter((i) => i.status === 'delivered' && scoring.deliveredDay(i) === today).map(ser),
      late: all.filter((i) => i.status === 'planned' && i.plannedDay < today).map(ser),
    },
    // The 8-hour day is shown for a single day. Hours are coverage, never a score.
    hours: period.kind === 'day' ? hours.dayHours(all, store.blocks.listByDay(user.id, period.start), period.start) : null,
    timeline: period.kind === 'day' ? hours.timeline(all, store.blocks.listByDay(user.id, period.start), period.start) : [],
    blocks: period.kind === 'day' ? store.blocks.listByDay(user.id, period.start) : [],
    hero: scoring.heroSentence(user.name, score, today),
    numbers: {
      impact: score.impact,
      reliability: score.reliability,
      answerRate: score.answerRate,
      explanations: scoring.explanations(period.kind),
    },
    items: inPeriod.map(ser),
    history: scoring.history(all, today, period.kind),
  };
}

// What a manager sees on the Team tab: one row per direct report plus a team roll-up.
// Contacts are never included, and items are summarised by state, not counted as a score.
function buildTeamSummary(manager, params) {
  const today = dates.today();
  const period = periodFor(params, today);
  const lite = (i) => ({ id: i.id, what: i.what, forWhom: i.forWhom, state: i.state, deadlineTime: i.deadlineTime, pastDeadline: i.pastDeadline });

  const rows = store.users.reportsOf(manager.id).map((member) => {
    const all = loadItems(member.id);
    const score = scoring.scorePeriod(all, period.start, period.end);
    const ser = (i) => serializeItem(i, today, { forManager: true });
    return {
      score,
      member: {
        id: member.id,
        name: member.name,
        role: member.role,
        isManager: member.isManager,
        isDemo: member.isDemo,
        hero: scoring.heroSentence(member.name, score, today),
        numbers: { impact: score.impact, reliability: score.reliability, answerRate: score.answerRate },
        today: {
          planned: all.filter((i) => i.plannedDay === today && i.status !== 'dropped').map(ser).map(lite),
          deliveredToday: all.filter((i) => i.status === 'delivered' && scoring.deliveredDay(i) === today).map(ser).map(lite),
          late: all.filter((i) => i.status === 'planned' && i.plannedDay < today).map(ser).map(lite),
        },
        waitingForAnswer: score.waiting > 0,
        hours: period.kind === 'day' ? hours.dayHours(all, store.blocks.listByDay(member.id, period.start), period.start) : null,
      },
    };
  });

  const team = scoring.teamScore(rows.map((r) => r.score), period.start, period.end);
  return {
    manager: { name: manager.name, role: manager.role },
    today,
    period,
    team: {
      hero: scoring.heroSentence('', team, today, { team: true }),
      numbers: {
        impact: team.impact,
        reliability: team.reliability,
        answerRate: team.answerRate,
        explanations: scoring.explanations(period.kind),
      },
    },
    members: rows.map((r) => r.member),
  };
}

module.exports = { loadItems, serializeItem, buildOverview, buildTeamSummary, periodFor };
