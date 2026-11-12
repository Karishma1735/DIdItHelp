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

// Clock times are "HH:MM"; lengths are whole minutes.
export const toMin = (hm) => {
  const m = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(hm || '');
  return m ? Number(m[1]) * 60 + Number(m[2]) : null;
};
export const toHm = (min) => `${String(Math.floor(min / 60)).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}`;
// The end of a slot that starts at `hm` and lasts `minutes`, or null if it would run past midnight.
export const endOf = (hm, minutes) => {
  const s = toMin(hm);
  return s === null || !minutes || s + minutes > 1439 ? null : toHm(s + minutes);
};
export const fmtMinutes = (n) => {
  const h = Math.floor(n / 60);
  const m = n % 60;
  return h && m ? `${h}h ${m}m` : h ? `${h}h` : `${m}m`;
};
