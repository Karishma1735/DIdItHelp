// Day strings ("YYYY-MM-DD") in APP_TIMEZONE. Weeks run Monday to Sunday.
const TZ = process.env.APP_TIMEZONE || 'UTC';

function dayOf(date) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}

const today = () => dayOf(new Date());

// Wall-clock parts of a moment in APP_TIMEZONE: { day, hour, minute, hm: 'HH:MM', weekday: true Mon-Fri }.
function localParts(date = new Date()) {
  const f = new Intl.DateTimeFormat('en-GB', { timeZone: TZ, hourCycle: 'h23', hour: '2-digit', minute: '2-digit', weekday: 'short' });
  const p = Object.fromEntries(f.formatToParts(date).map((x) => [x.type, x.value]));
  const hour = Number(p.hour);
  const minute = Number(p.minute);
  return {
    day: dayOf(date),
    hour,
    minute,
    hm: `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`,
    weekday: !['Sat', 'Sun'].includes(p.weekday),
  };
}

const isTime = (s) => typeof s === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(s);

function isDay(str) {
  if (typeof str !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(str)) return false;
  const d = new Date(`${str}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === str;
}

function addDays(str, n) {
  const d = new Date(`${str}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

function weekStartOf(str) {
  const d = new Date(`${str}T00:00:00Z`);
  return addDays(str, -((d.getUTCDay() + 6) % 7));
}

const weekEndOf = (weekStart) => addDays(weekStart, 6);

module.exports = { TZ, dayOf, today, localParts, isTime, isDay, addDays, weekStartOf, weekEndOf };
