// Builds the payload used by both the owner dashboard and the read-only manager view.
const store = require('./store');
const dates = require('./dates');
const scoring = require('./scoring');

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
    status: item.status,
    state: scoring.itemState(item, today),
    proofUrl: item.proofUrl,
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

async function buildOverview(user, weekParam, opts = {}) {
  const today = dates.today();
  const weekStart = dates.isDay(weekParam) ? dates.weekStartOf(weekParam) : dates.weekStartOf(today);
  const all = loadItems(user.id);
  const ser = (i) => serializeItem(i, today, opts);

  const score = scoring.scoreWeek(all, weekStart);
  const weekItems = all.filter(
    (i) =>
      (i.plannedDay >= weekStart && i.plannedDay <= score.weekEnd) ||
      (i.status === 'delivered' && scoring.deliveredDay(i) >= weekStart && scoring.deliveredDay(i) <= score.weekEnd)
  );

  return {
    owner: { name: user.name, role: user.role },
    today,
    week: { start: weekStart, end: score.weekEnd, isCurrent: weekStart === dates.weekStartOf(today) },
    todaySection: {
      planned: all.filter((i) => i.plannedDay === today && i.status !== 'dropped').map(ser),
      deliveredToday: all.filter((i) => i.status === 'delivered' && scoring.deliveredDay(i) === today).map(ser),
      late: all.filter((i) => i.status === 'planned' && i.plannedDay < today).map(ser),
    },
    hero: scoring.heroSentence(user.name, score, today),
    numbers: {
      impact: score.impact,
      reliability: score.reliability,
      answerRate: score.answerRate,
      explanations: scoring.EXPLANATIONS,
    },
    items: weekItems.map(ser),
    weeks: scoring.weeklyTable(all, today, 8),
  };
}

// What a manager sees on the Team tab: one row per direct report plus a team roll-up.
// Contacts are never included, and items are summarised by state, not counted as a score.
function buildTeamSummary(manager, weekParam) {
  const today = dates.today();
  const weekStart = dates.isDay(weekParam) ? dates.weekStartOf(weekParam) : dates.weekStartOf(today);
  const lite = (i) => ({ id: i.id, what: i.what, forWhom: i.forWhom, state: i.state });

  const rows = store.users.reportsOf(manager.id).map((member) => {
    const all = loadItems(member.id);
    const score = scoring.scoreWeek(all, weekStart);
    const ser = (i) => serializeItem(i, today, { forManager: true });
    return {
      score,
      member: {
        id: member.id,
        name: member.name,
        role: member.role,
        isManager: member.isManager,
        hero: scoring.heroSentence(member.name, score, today),
        numbers: { impact: score.impact, reliability: score.reliability, answerRate: score.answerRate },
        today: {
          planned: all.filter((i) => i.plannedDay === today && i.status !== 'dropped').map(ser).map(lite),
          deliveredToday: all.filter((i) => i.status === 'delivered' && scoring.deliveredDay(i) === today).map(ser).map(lite),
          late: all.filter((i) => i.status === 'planned' && i.plannedDay < today).map(ser).map(lite),
        },
        waitingForAnswer: score.waiting > 0,
      },
    };
  });

  const team = scoring.teamScore(rows.map((r) => r.score), weekStart);
  return {
    manager: { name: manager.name, role: manager.role },
    today,
    week: { start: weekStart, end: team.weekEnd, isCurrent: weekStart === dates.weekStartOf(today) },
    team: {
      hero: scoring.heroSentence('', team, today, { team: true }),
      numbers: {
        impact: team.impact,
        reliability: team.reliability,
        answerRate: team.answerRate,
        explanations: scoring.EXPLANATIONS,
      },
    },
    members: rows.map((r) => r.member),
  };
}

module.exports = { loadItems, serializeItem, buildOverview, buildTeamSummary };
