// When something breaks and a person has to act, this wakes them through M91 (lib/m91.js). It alerts on NAMED conditions
// that persist, never on a generic error handler: one failed message is a blip, five in a row for different people is
// an outage.
//
//   bad(key, ...)  the condition was seen. After `threshold` sightings in a row the alert is raised (once: M91 keeps
//                  one open alert per customId, so repeats alert nobody).
//   ok(key)        the thing worked. Clears the count and closes the alert, so the next problem alerts again.
//
// What is wrong right now is kept in memory and copied to the database, so a restart does not forget it. Alerting must
// never break the app: nothing here throws.
const store = require('./store');
const m91 = require('./m91');
const crashNote = require('./crashNote');

const HOUR = 60 * 60 * 1000;
const STALE_MS = Number(process.env.SCHEDULER_STALE_MINUTES || 20) * 60 * 1000;

const when = (iso) => (iso ? new Date(iso).toISOString().replace('T', ' ').slice(0, 16) + ' UTC' : 'a while ago');

// Every alert: who is asked, what the buttons are (I'll handle it / Seen) and how hard M91 tries.
const CONDITIONS = {
  'scheduler-stalled': {
    threshold: 3,
    severity: 'HIGH',
    title: 'Did it help? reminders have stopped',
    body: (s) => `The 5-minute job that sends morning prompts and deadline reminders has failed ${s.failures} times in a row (since ${when(s.firstBadAt)}). Nobody is being reminded until it works again. Last problem: ${s.detail}. See the app logs on Embarko.`,
  },
  'messages-failing': {
    threshold: 5,
    minWho: 2, // one person's bad address or expired Gmail is not an outage; several people at once is
    severity: 'HIGH',
    title: 'Did it help? messages are not going out',
    body: (s) => `${s.failures} messages in a row failed to send through viaSocket, for ${s.who.length} different people (since ${when(s.firstBadAt)}). Morning prompts, deadline reminders, questions to receivers and manager reports are not arriving. Last problem: ${s.detail}. Check viaSocket and the app logs.`,
  },
  'database-unwritable': {
    threshold: 3,
    severity: 'HIGH',
    title: 'Did it help? the database cannot be written',
    body: (s) => `Saving to the database failed ${s.failures} times in a row (since ${when(s.firstBadAt)}). People cannot plan or deliver work. Last problem: ${s.detail}. The disk may be full or read-only; see the app logs on Embarko.`,
  },
  'file-storage-failing': {
    threshold: 3,
    severity: 'MEDIUM',
    title: 'Did it help? proof files cannot be saved',
    body: (s) => `Uploading proof files failed ${s.failures} times in a row (since ${when(s.firstBadAt)}). Last problem: ${s.detail}. People can still paste a link as proof. The file storage may be full.`,
  },
  'app-crashed': {
    event: true, // raised once per crash, even if the last one is still open
    threshold: 1,
    severity: 'MEDIUM',
    autoCloseAfter: HOUR, // it restarts by itself; the alert clears after an hour of running fine
    title: 'Did it help? crashed and restarted',
    body: (s) => `The app crashed and restarted (${s.detail}). It starts again by itself, so this only needs a look. If it keeps happening, see the app logs on Embarko.`,
  },
};

const mem = new Map();
const busy = new Set(); // keys with a send or close in flight
const pending = new Set(); // promises in flight, so tests can wait for them (idle)

const blank = (key) => ({ key, failures: 0, who: [], firstBadAt: null, detail: '', open: false, openedAt: null });
try {
  for (const r of store.conditions.all()) {
    mem.set(r.key, { key: r.key, failures: r.failures, who: JSON.parse(r.who || '[]'), firstBadAt: r.first_bad_at, detail: r.last_detail, open: !!r.open, openedAt: r.opened_at });
  }
} catch { /* a database that cannot be read is exactly what we report elsewhere */ }

const get = (key) => mem.get(key) || mem.set(key, blank(key)).get(key);
const persist = (c) => { try { store.conditions.save(c); } catch { /* memory still has it */ } };
const warn = (msg) => console.warn(`[alerts] ${m91.redact(msg)}`);
const track = (p) => { pending.add(p); p.finally(() => pending.delete(p)); return p; };

// A short plain description of what went wrong: never a stack trace, never the link.
const clean = (err) => m91.redact(String((err && err.message) || err || '')).replace(/\s+/g, ' ').trim().slice(0, 160) || 'unknown error';

// Disk-level failures only (full, read-only, unreadable). A trigger refusing a change, a constraint or a busy lock are
// normal and are not a broken database.
const SQLITE_DISK = new Set([8, 10, 11, 13, 14, 26]); // READONLY IOERR CORRUPT FULL CANTOPEN NOTADB
function isStorageError(err) {
  if (!err) return false;
  if (typeof err.errcode === 'number') return SQLITE_DISK.has(err.errcode & 0xff);
  return ['ENOSPC', 'EROFS', 'EIO'].includes(err.code);
}

async function raise(c, def) {
  if (busy.has(c.key)) return false;
  busy.add(c.key);
  try {
    if (def.event && c.open) await m91.close(c.key); // a new crash re-arms the alert
    const r = await m91.send({ title: def.title, description: def.body(c), severity: def.severity, customId: c.key });
    if (!r.ok) { warn(`could not raise "${c.key}": ${r.error}`); return false; } // stays unraised; retried on the next sighting and each tick
    c.open = true;
    c.openedAt = new Date().toISOString();
    persist(c);
    console.warn(`[alerts] raised "${c.key}" (${def.severity}), reached ${r.delivered} phone${r.delivered === 1 ? '' : 's'}${r.deduplicated ? ' (already open)' : ''}`);
    if (r.delivered === 0 && !r.deduplicated) warn(`M91 reached nobody for "${c.key}": check that everyone in the channel installed M91 and accepted the invite`);
    return true;
  } finally {
    busy.delete(c.key);
  }
}

async function closeIt(c) {
  if (busy.has(c.key)) return;
  busy.add(c.key);
  try {
    const r = await m91.close(c.key);
    if (!r.ok) { warn(`could not close "${c.key}": ${r.error}`); return; } // stays open; retried each tick
    c.open = false;
    c.openedAt = null;
    persist(c);
    console.warn(`[alerts] closed "${c.key}"`);
  } finally {
    busy.delete(c.key);
  }
}

const ready = (c, def) => !c.open && c.failures >= def.threshold && c.who.length >= (def.minWho || 0);

// The condition was seen. `who` tells apart one person's problem from several people's.
function bad(key, { who, detail } = {}) {
  try {
    const def = CONDITIONS[key];
    if (!def) return null;
    const c = get(key);
    c.failures += 1;
    c.firstBadAt = c.firstBadAt || new Date().toISOString();
    c.detail = clean(detail);
    if (who !== undefined && c.who.length < 10 && !c.who.includes(String(who))) c.who.push(String(who));
    persist(c);
    if ((ready(c, def) || (def.event && c.failures >= def.threshold)) && m91.configured()) return track(raise(c, def));
  } catch (err) { warn(`bad(${key}) failed: ${clean(err)}`); }
  return null;
}

// The thing worked. Costs nothing when nothing was wrong.
function ok(key) {
  try {
    const c = mem.get(key);
    if (!c || (!c.failures && !c.open)) return null;
    c.failures = 0;
    c.who = [];
    c.firstBadAt = null;
    c.detail = '';
    persist(c);
    if (c.open && m91.configured()) return track(closeIt(c));
  } catch (err) { warn(`ok(${key}) failed: ${clean(err)}`); }
  return null;
}

// A one-off event (a crash). Resolves true once M91 accepted it.
async function event(key, detail) {
  try {
    const def = CONDITIONS[key];
    const c = get(key);
    c.failures = def.threshold;
    c.firstBadAt = new Date().toISOString();
    c.detail = clean(detail);
    persist(c);
    if (!m91.configured()) return false;
    return await track(raise(c, def));
  } catch (err) {
    warn(`event(${key}) failed: ${clean(err)}`);
    return false;
  }
}

// A crash left a note (lib/crashNote.js). Raise it, and remove the note only once M91 accepted it.
async function crashNotice() {
  const note = crashNote.read();
  if (!note) return;
  if (Date.now() - Date.parse(note.at) > 24 * HOUR) return crashNote.clear(); // too old to wake anyone for
  if (await event('app-crashed', `${note.kind}: ${note.message}, at ${when(note.at)}`)) crashNote.clear();
}

// Run on every scheduler tick: retries what could not reach M91 earlier, and clears alerts that have run their course.
function housekeeping() {
  try {
    if (!m91.configured()) return;
    for (const [key, def] of Object.entries(CONDITIONS)) {
      const c = mem.get(key);
      if (!c) continue;
      if (c.open && def.autoCloseAfter && c.openedAt && Date.now() - Date.parse(c.openedAt) > def.autoCloseAfter) { c.failures = 0; persist(c); track(closeIt(c)); }
      else if (c.open && c.failures === 0) track(closeIt(c)); // recovered, but the close did not get through
      else if (!def.event && ready(c, def)) track(raise(c, def)); // enough sightings, but the alert did not get through
    }
    track(crashNotice());
  } catch (err) { warn(`housekeeping failed: ${clean(err)}`); }
}

// The scheduler calls this at the start of every run. The deeper health check reads it to tell a stopped scheduler apart.
const heartbeat = (name) => store.heartbeats.touch(name);

// For the external watchdog: can the app write its database, and is the scheduler still running? Cached for 30 seconds so
// that anyone fetching it repeatedly cannot turn it into load.
let cache = { at: 0, problems: [] };
function health() {
  if (Date.now() - cache.at < 30000) return cache.problems;
  const problems = [];
  try { store.heartbeats.touch('probe'); } catch { problems.push('database'); }
  try {
    const last = store.heartbeats.get('tick');
    if (last && Date.now() - Date.parse(last) > STALE_MS) problems.push('scheduler');
  } catch { if (!problems.includes('database')) problems.push('database'); }
  cache = { at: Date.now(), problems };
  return problems;
}

const idle = () => Promise.allSettled([...pending]);

module.exports = { CONDITIONS, bad, ok, event, housekeeping, heartbeat, health, crashNotice, isStorageError, clean, idle };
