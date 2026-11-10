// ALL scoring logic lives here. Nothing else in the app computes impact, reliability or answer rate.
//
// An "item" given to these functions is a plain object:
//   { plannedDay, status, deliveredAt, askedAt, answer: { value } | null }
//
// Task counts are used only as inputs to ratios and sentences; they are never a score.
const { dayOf, addDays, weekStartOf, weekEndOf } = require('./dates');

const POINTS = { lot: 2, little: 1, none: 0 };

const deliveredDay = (item) => (item.deliveredAt ? dayOf(new Date(item.deliveredAt)) : null);
const inWeek = (day, start) => !!day && day >= start && day <= weekEndOf(start);

// What the item is, right now: due | late | unasked | waiting | lot | little | none | dropped
function itemState(item, today) {
  if (item.status === 'dropped') return 'dropped';
  if (item.status === 'planned') return item.plannedDay < today ? 'late' : 'due';
  if (item.answer) return item.answer.value;
  return item.askedAt ? 'waiting' : 'unasked';
}

function scoreWeek(items, weekStart) {
  const end = weekEndOf(weekStart);

  // Reliability: planned this week (dropped count as not delivered) and delivered by end of week.
  const planned = items.filter((i) => inWeek(i.plannedDay, weekStart));
  const deliveredOfPlanned = planned.filter((i) => {
    const d = deliveredDay(i);
    return i.status === 'delivered' && d && d <= end;
  }).length;

  // Impact and answer rate: everything delivered this week, including late deliveries.
  const delivered = items.filter((i) => i.status === 'delivered' && inWeek(deliveredDay(i), weekStart));
  const answered = delivered.filter((i) => i.answer);
  const asked = delivered.filter((i) => i.askedAt);
  const askedAnswered = asked.filter((i) => i.answer).length;
  const count = (v) => answered.filter((i) => i.answer.value === v).length;

  return {
    weekStart,
    weekEnd: end,
    plannedCount: planned.length,
    deliveredOfPlanned,
    deliveredThisWeek: delivered.length,
    impact: answered.reduce((sum, i) => sum + POINTS[i.answer.value], 0),
    reliability: planned.length ? Math.round((deliveredOfPlanned / planned.length) * 100) : null,
    answerRate: asked.length ? Math.round((askedAnswered / asked.length) * 100) : null,
    asked: asked.length,
    askedAnswered,
    lot: count('lot'),
    little: count('little'),
    none: count('none'),
    waiting: delivered.length - answered.length,
  };
}

function weekPrefix(weekStart, today) {
  const current = weekStartOf(today);
  if (weekStart === current) return 'This week';
  if (weekStart === addDays(current, -7)) return 'Last week';
  if (weekStart > current) return 'Next week';
  return `In the week of ${weekStart}`;
}

function heroSentence(ownerName, s, today) {
  const first = String(ownerName || 'They').split(' ')[0];
  const prefix = weekPrefix(s.weekStart, today);
  const head = s.plannedCount
    ? `${prefix} ${first} delivered ${s.deliveredOfPlanned} of ${s.plannedCount} planned things.`
    : `${prefix} ${first} had nothing planned.`;

  const parts = [];
  if (s.lot) parts.push(`${s.lot} ${s.lot === 1 ? 'person' : 'people'} said it helped a lot`);
  if (s.little) parts.push(`${s.little} said a little`);
  if (s.none) parts.push(`${s.none} said it didn't help`);
  if (s.waiting) parts.push(`${s.waiting} still to answer`);
  if (!parts.length) return head;
  return `${head} ${parts.join(', ')}.`;
}

const EXPLANATIONS = {
  impact: 'Helped a lot = 2, a little = 1, didn’t help = 0, for things delivered this week.',
  reliability: 'Planned for this week and delivered by Sunday, out of everything planned for this week.',
  answerRate: 'How many of the people we asked have answered.',
};

// The last `n` weeks ending at the current week, newest first.
function weeklyTable(items, today, n = 8) {
  const current = weekStartOf(today);
  const rows = [];
  for (let k = 0; k < n; k += 1) rows.push(scoreWeek(items, addDays(current, -7 * k)));
  return rows;
}

module.exports = {
  POINTS,
  EXPLANATIONS,
  deliveredDay,
  itemState,
  scoreWeek,
  heroSentence,
  weeklyTable,
};
