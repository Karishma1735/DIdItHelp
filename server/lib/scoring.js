// ALL scoring logic lives here. Nothing else in the app computes impact, reliability or answer rate.
//
// An "item" given to these functions is a plain object:
//   { plannedDay, status, deliveredAt, askedAt, answer: { value } | null }
//
// Task counts are used only as inputs to ratios and sentences; they are never a score.
const { dayOf, addDays, weekStartOf, weekEndOf } = require('./dates');

// Two answers now: helped (1 point) and didn't help (0). Older answers keep what they were worth: a lot = 2, a little = 1.
const POINTS = { helped: 1, lot: 2, little: 1, none: 0 };

const deliveredDay = (item) => (item.deliveredAt ? dayOf(new Date(item.deliveredAt)) : null);
const inRange = (day, start, end) => !!day && day >= start && day <= end;

// What the item is, right now: due | late | unasked | waiting | helped | none | dropped (older answers: lot | little)
function itemState(item, today) {
  if (item.status === 'dropped') return 'dropped';
  if (item.status === 'planned') return item.plannedDay < today ? 'late' : 'due';
  if (item.answer) return item.answer.value;
  return item.askedAt ? 'waiting' : 'unasked';
}

// One period: a single day (start === end) or a week. The same formulas for both.
function scorePeriod(items, start, end) {
  // Reliability: planned in this period (dropped count as not delivered) and delivered by the end of it.
  const planned = items.filter((i) => inRange(i.plannedDay, start, end));
  const deliveredOfPlanned = planned.filter((i) => {
    const d = deliveredDay(i);
    return i.status === 'delivered' && d && d <= end;
  }).length;

  // Impact and answer rate: everything delivered in this period, including late deliveries.
  const delivered = items.filter((i) => i.status === 'delivered' && inRange(deliveredDay(i), start, end));
  const answered = delivered.filter((i) => i.answer);
  const asked = delivered.filter((i) => i.askedAt);
  const askedAnswered = asked.filter((i) => i.answer).length;
  const count = (v) => answered.filter((i) => i.answer.value === v).length;

  return {
    kind: start === end ? 'day' : 'week',
    start,
    end,
    plannedCount: planned.length,
    deliveredOfPlanned,
    deliveredThisPeriod: delivered.length,
    impact: answered.reduce((sum, i) => sum + POINTS[i.answer.value], 0),
    reliability: planned.length ? Math.round((deliveredOfPlanned / planned.length) * 100) : null,
    answerRate: asked.length ? Math.round((askedAnswered / asked.length) * 100) : null,
    asked: asked.length,
    askedAnswered,
    helped: count('helped'),
    lot: count('lot'),
    little: count('little'),
    helpedAny: count('helped') + count('lot') + count('little'), // everyone who said it helped, old or new answers
    none: count('none'),
    waiting: delivered.length - answered.length,
  };
}

const scoreDay = (items, day) => scorePeriod(items, day, day);

function scoreWeek(items, weekStart) {
  const s = scorePeriod(items, weekStart, weekEndOf(weekStart));
  return { ...s, weekStart, weekEnd: s.end };
}

// "Today", "Yesterday", "This week"... for the sentence.
function periodPrefix(s, today) {
  if (s.kind === 'day') {
    if (s.start === today) return 'Today';
    if (s.start === addDays(today, -1)) return 'Yesterday';
    if (s.start === addDays(today, 1)) return 'Tomorrow';
    return `On ${s.start}`;
  }
  const current = weekStartOf(today);
  if (s.start === current) return 'This week';
  if (s.start === addDays(current, -7)) return 'Last week';
  if (s.start > current) return 'Next week';
  return `In the week of ${s.start}`;
}

function heroSentence(ownerName, s, today, { team = false } = {}) {
  const first = team ? 'the team' : String(ownerName || 'They').split(' ')[0];
  const prefix = periodPrefix(s, today);
  const head = s.plannedCount
    ? `${prefix} ${first} delivered ${s.deliveredOfPlanned} of ${s.plannedCount} planned things.`
    : `${prefix} ${first} had nothing planned.`;

  const parts = [];
  if (s.helpedAny) parts.push(`${s.helpedAny} ${s.helpedAny === 1 ? 'person' : 'people'} said it helped`);
  if (s.none) parts.push(`${s.none} said it didn't help`);
  if (s.waiting) parts.push(`${s.waiting} still to answer`);
  if (!parts.length) return head;
  return `${head} ${parts.join(', ')}.`;
}

// One-line explanations, worded for a day or a week.
function explanations(kind = 'week') {
  const day = kind === 'day';
  return {
    impact: `Each “helped” = 1 point, “didn’t help” = 0 (older answers: a lot = 2, a little = 1), for things delivered ${day ? 'that day' : 'this week'}.`,
    reliability: day
      ? 'Planned for that day and delivered by the end of that day, out of everything planned for that day.'
      : 'Planned for this week and delivered by Sunday, out of everything planned for this week.',
    answerRate: 'How many of the people we asked have answered.',
  };
}
const EXPLANATIONS = explanations('week');

// Combines several people's scores for the same period into one team score, using the same formulas on the summed inputs.
function teamScore(scores, start, end = start) {
  const sum = (k) => scores.reduce((a, s) => a + s[k], 0);
  const planned = sum('plannedCount');
  const asked = sum('asked');
  return {
    kind: start === end ? 'day' : 'week',
    start,
    end,
    weekStart: start,
    weekEnd: end,
    plannedCount: planned,
    deliveredOfPlanned: sum('deliveredOfPlanned'),
    impact: sum('impact'),
    reliability: planned ? Math.round((sum('deliveredOfPlanned') / planned) * 100) : null,
    answerRate: asked ? Math.round((sum('askedAnswered') / asked) * 100) : null,
    helped: sum('helped'),
    lot: sum('lot'),
    little: sum('little'),
    helpedAny: sum('helpedAny'),
    none: sum('none'),
    waiting: sum('waiting'),
  };
}

// The recent history, newest first: the last 14 days, or the last 8 weeks.
function history(items, today, kind = 'day') {
  const rows = [];
  if (kind === 'week') {
    const current = weekStartOf(today);
    for (let k = 0; k < 8; k += 1) rows.push(scoreWeek(items, addDays(current, -7 * k)));
  } else {
    for (let k = 0; k < 14; k += 1) rows.push(scoreDay(items, addDays(today, -k)));
  }
  return rows;
}
const weeklyTable = (items, today, n = 8) => history(items, today, 'week').slice(0, n);

module.exports = {
  POINTS,
  EXPLANATIONS,
  explanations,
  deliveredDay,
  itemState,
  scorePeriod,
  scoreDay,
  scoreWeek,
  heroSentence,
  teamScore,
  history,
  weeklyTable,
};
