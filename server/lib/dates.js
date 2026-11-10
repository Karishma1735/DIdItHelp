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

module.exports = { TZ, dayOf, today, isDay, addDays, weekStartOf, weekEndOf };
