// Day strings are "YYYY-MM-DD". The server decides what "today" is.
export function addDays(str, n) {
  const d = new Date(`${str}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

export function formatDay(str, opts = { weekday: 'short', day: 'numeric', month: 'short' }) {
  return new Date(`${str}T00:00:00Z`).toLocaleDateString('en-GB', { ...opts, timeZone: 'UTC' });
}

export const formatRange = (start, end) =>
  `${formatDay(start, { day: 'numeric', month: 'short' })} – ${formatDay(end, { day: 'numeric', month: 'short', year: 'numeric' })}`;

export const formatWhen = (iso) =>
  iso ? new Date(iso).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '';
