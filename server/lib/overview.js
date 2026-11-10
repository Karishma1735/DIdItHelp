// Builds the payload used by both the owner dashboard and the read-only manager view.
const Item = require('../models/Item');
const Answer = require('../models/Answer');
const dates = require('./dates');
const scoring = require('./scoring');

async function loadItems(ownerId) {
  const items = await Item.find({ owner: ownerId }).sort({ plannedDay: 1, createdAt: 1 }).lean();
  const answers = await Answer.find({ item: { $in: items.map((i) => i._id) } }).lean();
  const byItem = new Map(answers.map((a) => [String(a.item), a]));
  return items.map((i) => ({ ...i, answer: byItem.get(String(i._id)) || null }));
}

function serializeItem(item, today, { forManager = false } = {}) {
  const delivered = scoring.deliveredDay(item);
  return {
    id: String(item._id),
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
  const all = await loadItems(user._id);
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

module.exports = { loadItems, serializeItem, buildOverview };
