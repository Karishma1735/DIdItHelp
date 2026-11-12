// The 8-hour day: how much of it is planned, and a timeline for it.
// Hours are a COVERAGE check for the person and their manager. They never enter Impact, Reliability or Answer rate.
const WORKDAY = () => Number(process.env.WORKDAY_MINUTES || 480);
const LUNCH = { start: 13 * 60, end: 14 * 60 }; // left free on the timeline
const DAY_START = 9 * 60;
const LAST_MINUTE = 24 * 60 - 1;

const toMin = (hm) => {
  const m = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(String(hm || ''));
  return m ? Number(m[1]) * 60 + Number(m[2]) : null;
};
const toHm = (min) => `${String(Math.floor(min / 60)).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}`;
const roundUp = (min, step = 15) => Math.ceil(min / step) * step;

// items: this person's items (with plannedDay, status, estimateMinutes). blocks: their blocks for the day.
function dayHours(items, blocks, day) {
  const planned = items.filter((i) => i.plannedDay === day && i.status !== 'dropped');
  const itemMinutes = planned.reduce((s, i) => s + (i.estimateMinutes || 0), 0);
  const blockMinutes = blocks.reduce((s, b) => s + b.minutes, 0);
  const total = itemMinutes + blockMinutes;
  const capacity = WORKDAY();
  return {
    capacity,
    itemMinutes,
    blockMinutes,
    planned: total,
    unplanned: Math.max(0, capacity - total),
    over: Math.max(0, total - capacity),
    deliveredMinutes: planned.filter((i) => i.status === 'delivered').reduce((s, i) => s + (i.estimateMinutes || 0), 0),
    withoutEstimate: planned.filter((i) => !i.estimateMinutes).length,
    status: total === 0 ? 'empty' : total < capacity ? 'under' : total > capacity ? 'over' : 'full',
  };
}

// The day in order: tasks and blocks that have a start time, then the rest.
function timeline(items, blocks, day) {
  const entries = [];
  for (const i of items) {
    if (i.plannedDay !== day || i.status === 'dropped' || !i.startTime || !i.estimateMinutes) continue;
    const s = toMin(i.startTime);
    entries.push({ type: 'task', id: i.id, label: i.what, start: i.startTime, end: toHm(Math.min(LAST_MINUTE, s + i.estimateMinutes)), minutes: i.estimateMinutes, status: i.status });
  }
  for (const b of blocks) {
    if (!b.startTime) continue;
    const s = toMin(b.startTime);
    entries.push({ type: 'block', id: b.id, label: b.title, kind: b.kind, start: b.startTime, end: toHm(Math.min(LAST_MINUTE, s + b.minutes)), minutes: b.minutes });
  }
  return entries.sort((a, b) => a.start.localeCompare(b.start));
}

// Places new work on the day without overlaps, around lunch and what is already on the timeline.
//   existing: [{start:'HH:MM', end:'HH:MM'}] already on the day. wanted: [{ minutes, fixedStart?: 'HH:MM' }] in order.
//   fromHm: earliest start. Items with a fixed clock time (a standup at 10:30) are placed FIRST, at that time;
//   everything else then takes the earliest free gap in the order given. Returns [{ start, end } | { start: null, end: null }]
//   (null = it does not fit before midnight).
function layout(existing, wanted, fromHm = '09:00') {
  const busy = [{ s: LUNCH.start, e: LUNCH.end }];
  for (const x of existing) {
    const s = toMin(x.start);
    const e = toMin(x.end);
    if (s !== null && e !== null && e > s) busy.push({ s, e });
  }
  const firstFree = (from, minutes) => {
    let start = from;
    for (let guard = 0; guard < 200; guard += 1) {
      const hit = busy.find((b) => start < b.e && start + minutes > b.s);
      if (!hit) return start;
      start = hit.e;
    }
    return start;
  };
  const from = Math.max(toMin(fromHm) ?? DAY_START, 0);
  const out = new Array(wanted.length);
  const place = (w, i, earliest) => {
    const start = firstFree(earliest, w.minutes);
    if (start + w.minutes > LAST_MINUTE) {
      out[i] = { start: null, end: null };
      return;
    }
    busy.push({ s: start, e: start + w.minutes });
    out[i] = { start: toHm(start), end: toHm(start + w.minutes) };
  };
  wanted.forEach((w, i) => { if (w.fixedStart && toMin(w.fixedStart) !== null) place(w, i, toMin(w.fixedStart)); });
  wanted.forEach((w, i) => { if (!out[i]) place(w, i, from); });
  return out;
}

const fmt = (min) => {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return h && m ? `${h}h ${m}m` : h ? `${h}h` : `${m}m`;
};

module.exports = { WORKDAY, DAY_START, toMin, toHm, roundUp, dayHours, timeline, layout, fmt };
