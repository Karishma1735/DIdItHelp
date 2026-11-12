// Data layer: SQLite via Node's built-in node:sqlite (no external database needed).
// All timestamps are stored as ISO strings. Ids are exposed as strings.
const fs = require('fs');
const path = require('path');
const { DatabaseSync } = require('node:sqlite');

// DATABASE_PATH wins; otherwise use DATA_DIR (the persistent folder hosts like Embarko provide).
const dataDir = process.env.DATA_DIR || path.join(__dirname, '..', 'data');
const file = process.env.DATABASE_PATH || path.join(dataDir, 'did-it-help.db');
if (file !== ':memory:') fs.mkdirSync(path.dirname(file), { recursive: true });
const db = new DatabaseSync(file);
db.exec('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;');

db.exec(`
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL, role TEXT NOT NULL DEFAULT '',
  email TEXT NOT NULL UNIQUE, password_hash TEXT NOT NULL,
  mentor_name TEXT NOT NULL DEFAULT '', mentor_contact TEXT NOT NULL DEFAULT '',
  reports_to INTEGER REFERENCES users(id),
  is_manager INTEGER NOT NULL DEFAULT 0,
  is_demo INTEGER NOT NULL DEFAULT 0,
  alert_contact TEXT NOT NULL DEFAULT '',
  vs_id TEXT,
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  owner_id INTEGER NOT NULL REFERENCES users(id),
  what TEXT NOT NULL, for_whom TEXT NOT NULL, contact TEXT NOT NULL,
  is_for_mentor INTEGER NOT NULL DEFAULT 0,
  planned_day TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'planned' CHECK (status IN ('planned','delivered','dropped')),
  proof_url TEXT NOT NULL DEFAULT '',
  delivered_at TEXT, dropped_at TEXT, asked_at TEXT,
  asked_via TEXT CHECK (asked_via IN ('slack','email')),
  ask_error TEXT NOT NULL DEFAULT '',
  reminder_sent_at TEXT, answered_at TEXT,
  deadline_time TEXT NOT NULL DEFAULT '17:00',
  deadline_reminder_sent_at TEXT,
  report_sent_at TEXT, report_error TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL, updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS items_owner ON items(owner_id);
-- The planned day can never be edited, enforced by the database itself.
CREATE TRIGGER IF NOT EXISTS items_planned_day_immutable
BEFORE UPDATE OF planned_day ON items
BEGIN SELECT RAISE(ABORT, 'planned_day is immutable'); END;
CREATE TABLE IF NOT EXISTS answers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  item_id INTEGER NOT NULL UNIQUE REFERENCES items(id),
  value TEXT NOT NULL CHECK (value IN ('lot','little','none')),
  comment TEXT NOT NULL DEFAULT '', answered_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS answer_tokens (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  item_id INTEGER NOT NULL REFERENCES items(id),
  token_hash TEXT NOT NULL UNIQUE, created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS invites (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  manager_id INTEGER NOT NULL REFERENCES users(id),
  token_hash TEXT NOT NULL UNIQUE, label TEXT NOT NULL DEFAULT '',
  make_manager INTEGER NOT NULL DEFAULT 0,
  contact TEXT NOT NULL DEFAULT '', sent_at TEXT, sent_via TEXT, send_error TEXT NOT NULL DEFAULT '',
  used_by INTEGER REFERENCES users(id), used_at TEXT, revoked_at TEXT,
  expires_at TEXT NOT NULL, created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS notices (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id),
  kind TEXT NOT NULL, day TEXT NOT NULL, sent_at TEXT NOT NULL,
  UNIQUE (user_id, kind, day)
);
CREATE TABLE IF NOT EXISTS viasocket_connections (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id),
  app TEXT NOT NULL,
  auth_id TEXT NOT NULL,
  slack_user_id TEXT, slack_user_label TEXT,
  created_at TEXT NOT NULL, updated_at TEXT NOT NULL,
  UNIQUE (user_id, app)
);
CREATE TABLE IF NOT EXISTS share_links (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  owner_id INTEGER NOT NULL REFERENCES users(id),
  token_hash TEXT NOT NULL UNIQUE, revoked_at TEXT, created_at TEXT NOT NULL
);
`);

// Additive migration for databases created before teams existed. Never drops or rewrites data.
const userCols = db.prepare('PRAGMA table_info(users)').all().map((c) => c.name);
if (!userCols.includes('reports_to')) db.exec('ALTER TABLE users ADD COLUMN reports_to INTEGER REFERENCES users(id)');
if (!userCols.includes('is_manager')) {
  db.exec('ALTER TABLE users ADD COLUMN is_manager INTEGER NOT NULL DEFAULT 0');
  db.exec('UPDATE users SET is_manager = 1 WHERE id = (SELECT MIN(id) FROM users)'); // the existing owner becomes a manager
}

if (!userCols.includes('is_demo')) db.exec('ALTER TABLE users ADD COLUMN is_demo INTEGER NOT NULL DEFAULT 0');
const inviteCols = db.prepare('PRAGMA table_info(invites)').all().map((c) => c.name);
if (!inviteCols.includes('contact')) {
  db.exec("ALTER TABLE invites ADD COLUMN contact TEXT NOT NULL DEFAULT ''");
  db.exec('ALTER TABLE invites ADD COLUMN sent_at TEXT');
  db.exec('ALTER TABLE invites ADD COLUMN sent_via TEXT');
  db.exec("ALTER TABLE invites ADD COLUMN send_error TEXT NOT NULL DEFAULT ''");
}
// viaSocket's id for a person: random for everyone new, so a rebuilt database can never hand a new person someone
// else's connections. People who already existed keep their old id (their database number) so nothing disconnects.
if (!userCols.includes('vs_id')) db.exec('ALTER TABLE users ADD COLUMN vs_id TEXT');
db.exec('UPDATE users SET vs_id = CAST(id AS TEXT) WHERE vs_id IS NULL');
if (!userCols.includes('alert_contact')) db.exec("ALTER TABLE users ADD COLUMN alert_contact TEXT NOT NULL DEFAULT ''");
const itemCols = db.prepare('PRAGMA table_info(items)').all().map((c) => c.name);
if (!itemCols.includes('deadline_time')) {
  db.exec("ALTER TABLE items ADD COLUMN deadline_time TEXT NOT NULL DEFAULT '17:00'");
  db.exec('ALTER TABLE items ADD COLUMN deadline_reminder_sent_at TEXT');
  db.exec('ALTER TABLE items ADD COLUMN report_sent_at TEXT');
  db.exec("ALTER TABLE items ADD COLUMN report_error TEXT NOT NULL DEFAULT ''");
}
// The deadline time, like the planned day, can never be edited.
db.exec(`
DROP TRIGGER IF EXISTS items_deadline_immutable;
CREATE TRIGGER items_deadline_immutable
BEFORE UPDATE OF deadline_time ON items
BEGIN SELECT RAISE(ABORT, 'deadline_time is immutable'); END;
`);
// Items are never deleted, except the removable sample employee's items (users.is_demo = 1).
db.exec(`
DROP TRIGGER IF EXISTS items_no_delete;
CREATE TRIGGER items_no_delete BEFORE DELETE ON items
WHEN COALESCE((SELECT is_demo FROM users WHERE id = OLD.owner_id), 0) = 0
BEGIN SELECT RAISE(ABORT, 'items cannot be deleted'); END;
`);

const now = () => new Date().toISOString();
const sid = (v) => String(v);

const userOut = (r) =>
  r && {
    id: sid(r.id), name: r.name, role: r.role, email: r.email, passwordHash: r.password_hash,
    mentorName: r.mentor_name, mentorContact: r.mentor_contact, createdAt: r.created_at,
    vsId: r.vs_id, alertContact: r.alert_contact, isManager: !!r.is_manager, isDemo: !!r.is_demo, reportsTo: r.reports_to == null ? null : sid(r.reports_to),
  };

const itemOut = (r) =>
  r && {
    id: sid(r.id), owner: sid(r.owner_id), what: r.what, forWhom: r.for_whom, contact: r.contact,
    isForMentor: !!r.is_for_mentor, plannedDay: r.planned_day, status: r.status, proofUrl: r.proof_url,
    deliveredAt: r.delivered_at, droppedAt: r.dropped_at, askedAt: r.asked_at, askedVia: r.asked_via,
    askError: r.ask_error, reminderSentAt: r.reminder_sent_at, answeredAt: r.answered_at,
    deadlineTime: r.deadline_time, deadlineReminderSentAt: r.deadline_reminder_sent_at,
    reportSentAt: r.report_sent_at, reportError: r.report_error,
    createdAt: r.created_at, updatedAt: r.updated_at,
  };

const USER_COLS = { name: 'name', role: 'role', mentorName: 'mentor_name', mentorContact: 'mentor_contact', alertContact: 'alert_contact' };
const ITEM_COLS = {
  status: 'status', proofUrl: 'proof_url', deliveredAt: 'delivered_at', droppedAt: 'dropped_at',
  askedAt: 'asked_at', askedVia: 'asked_via', askError: 'ask_error',
  reminderSentAt: 'reminder_sent_at', answeredAt: 'answered_at',
  deadlineReminderSentAt: 'deadline_reminder_sent_at', reportSentAt: 'report_sent_at', reportError: 'report_error',
};

function update(table, cols, id, fields, touch) {
  const keys = Object.keys(fields).filter((k) => cols[k]);
  if (!keys.length) return;
  const sets = keys.map((k) => `${cols[k]} = ?`).concat(touch ? ['updated_at = ?'] : []);
  const vals = keys.map((k) => fields[k]).concat(touch ? [now()] : []);
  db.prepare(`UPDATE ${table} SET ${sets.join(', ')} WHERE id = ?`).run(...vals, Number(id));
}

const users = {
  count: () => db.prepare('SELECT COUNT(*) AS n FROM users').get().n,
  first: () => userOut(db.prepare('SELECT * FROM users ORDER BY id LIMIT 1').get()),
  byId: (id) => userOut(db.prepare('SELECT * FROM users WHERE id = ?').get(Number(id))),
  byEmail: (email) => userOut(db.prepare('SELECT * FROM users WHERE email = ?').get(email)),
  create: ({ name, role, email, passwordHash, isManager = false, reportsTo = null, isDemo = false }) => {
    const r = db.prepare('INSERT INTO users (name, role, email, password_hash, is_manager, is_demo, reports_to, vs_id, created_at) VALUES (?,?,?,?,?,?,?,?,?)')
      .run(name, role || '', email, passwordHash, isManager ? 1 : 0, isDemo ? 1 : 0, reportsTo == null ? null : Number(reportsTo), require('crypto').randomBytes(10).toString('hex'), now());
    return users.byId(r.lastInsertRowid);
  },
  update: (id, fields) => { update('users', USER_COLS, id, fields, false); return users.byId(id); },
  reportsOf: (managerId) =>
    db.prepare('SELECT * FROM users WHERE reports_to = ? ORDER BY name COLLATE NOCASE, id').all(Number(managerId)).map(userOut),
};

const items = {
  get: (id) => itemOut(db.prepare('SELECT * FROM items WHERE id = ?').get(Number(id))),
  getOwned: (id, ownerId) =>
    itemOut(db.prepare('SELECT * FROM items WHERE id = ? AND owner_id = ?').get(Number(id), Number(ownerId))),
  listByOwner: (ownerId) =>
    db.prepare('SELECT * FROM items WHERE owner_id = ? ORDER BY planned_day, created_at, id').all(Number(ownerId)).map(itemOut),
  create: ({ owner, what, forWhom, contact, isForMentor, plannedDay, deadlineTime = '17:00' }) => {
    const t = now();
    const r = db.prepare(
      'INSERT INTO items (owner_id, what, for_whom, contact, is_for_mentor, planned_day, deadline_time, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?,?)'
    ).run(Number(owner), what, forWhom, contact, isForMentor ? 1 : 0, plannedDay, deadlineTime, t, t);
    return items.get(r.lastInsertRowid);
  },
  update: (id, fields) => { update('items', ITEM_COLS, id, fields, true); return items.get(id); },
  dueForReminder: (cutoffIso) =>
    db.prepare(
      `SELECT i.* FROM items i JOIN users u ON u.id = i.owner_id
       WHERE i.status = 'delivered' AND i.asked_at IS NOT NULL AND i.asked_at <= ?
       AND i.answered_at IS NULL AND i.reminder_sent_at IS NULL AND u.is_demo = 0`
    ).all(cutoffIso).map(itemOut),
  // Atomic claim: only one caller can ever win, so an item gets at most one reminder.
  claimReminder: (id) =>
    db.prepare('UPDATE items SET reminder_sent_at = ? WHERE id = ? AND reminder_sent_at IS NULL AND answered_at IS NULL')
      .run(now(), Number(id)).changes === 1,
  // Items planned for `day` whose deadline time has passed, not delivered, and never reminded. Sample data is skipped.
  dueForDeadline: (day, hm) =>
    db.prepare(
      `SELECT i.* FROM items i JOIN users u ON u.id = i.owner_id
       WHERE i.status = 'planned' AND i.planned_day = ? AND i.deadline_time <= ?
       AND i.deadline_reminder_sent_at IS NULL AND u.is_demo = 0`
    ).all(day, hm).map(itemOut),
  // Atomic claim: only one caller can ever win, so a deadline reminder is sent at most once per item.
  claimDeadlineReminder: (id) =>
    db.prepare("UPDATE items SET deadline_reminder_sent_at = ? WHERE id = ? AND deadline_reminder_sent_at IS NULL AND status = 'planned'")
      .run(now(), Number(id)).changes === 1,
  releaseDeadlineReminder: (id) => db.prepare('UPDATE items SET deadline_reminder_sent_at = NULL WHERE id = ?').run(Number(id)),
  releaseReminder: (id) => db.prepare('UPDATE items SET reminder_sent_at = NULL WHERE id = ?').run(Number(id)),
};

const answerOut = (r) => r && { itemId: sid(r.item_id), value: r.value, comment: r.comment, answeredAt: r.answered_at };

const answers = {
  get: (itemId) => answerOut(db.prepare('SELECT * FROM answers WHERE item_id = ?').get(Number(itemId))),
  listByOwner: (ownerId) =>
    db.prepare('SELECT a.* FROM answers a JOIN items i ON i.id = a.item_id WHERE i.owner_id = ?')
      .all(Number(ownerId)).map(answerOut),
  // comment === undefined keeps the existing comment.
  upsert: (itemId, value, comment) => {
    const existing = answers.get(itemId);
    if (existing) {
      db.prepare('UPDATE answers SET value = ?, comment = ? WHERE item_id = ?')
        .run(value, comment === undefined ? existing.comment : comment, Number(itemId));
    } else {
      db.prepare('INSERT INTO answers (item_id, value, comment, answered_at) VALUES (?,?,?,?)')
        .run(Number(itemId), value, comment || '', now());
    }
    return answers.get(itemId);
  },
};

const tokens = {
  create: (itemId, tokenHash) =>
    db.prepare('INSERT INTO answer_tokens (item_id, token_hash, created_at) VALUES (?,?,?)').run(Number(itemId), tokenHash, now()),
  itemIdByHash: (tokenHash) => {
    const r = db.prepare('SELECT item_id FROM answer_tokens WHERE token_hash = ?').get(tokenHash);
    return r ? sid(r.item_id) : null;
  },
};

const share = {
  active: (ownerId) =>
    db.prepare('SELECT * FROM share_links WHERE owner_id = ? AND revoked_at IS NULL').get(Number(ownerId)) || null,
  revokeAll: (ownerId) =>
    db.prepare('UPDATE share_links SET revoked_at = ? WHERE owner_id = ? AND revoked_at IS NULL').run(now(), Number(ownerId)),
  create: (ownerId, tokenHash) => {
    db.prepare('INSERT INTO share_links (owner_id, token_hash, created_at) VALUES (?,?,?)').run(Number(ownerId), tokenHash, now());
    return share.active(ownerId);
  },
  ownerByHash: (tokenHash) => {
    const r = db.prepare('SELECT owner_id FROM share_links WHERE token_hash = ? AND revoked_at IS NULL').get(tokenHash);
    return r ? sid(r.owner_id) : null;
  },
};

const DAY = 24 * 60 * 60 * 1000;
const inviteOut = (r) =>
  r && {
    id: sid(r.id), managerId: sid(r.manager_id), label: r.label, makeManager: !!r.make_manager,
    contact: r.contact, sentAt: r.sent_at, sentVia: r.sent_via, sendError: r.send_error,
    usedBy: r.used_by == null ? null : sid(r.used_by), usedAt: r.used_at, revokedAt: r.revoked_at,
    expiresAt: r.expires_at, createdAt: r.created_at,
  };

const invites = {
  get: (id, managerId) =>
    inviteOut(db.prepare('SELECT * FROM invites WHERE id = ? AND manager_id = ?').get(Number(id), Number(managerId))),
  setSent: (id, { sentAt = null, sentVia = null, sendError = '' }) =>
    db.prepare('UPDATE invites SET sent_at = ?, sent_via = ?, send_error = ? WHERE id = ?').run(sentAt, sentVia, sendError, Number(id)),
  create: (managerId, tokenHash, { label = '', makeManager = false, contact = '' } = {}) => {
    const r = db.prepare('INSERT INTO invites (manager_id, token_hash, label, make_manager, contact, expires_at, created_at) VALUES (?,?,?,?,?,?,?)')
      .run(Number(managerId), tokenHash, label, makeManager ? 1 : 0, contact, new Date(Date.now() + 7 * DAY).toISOString(), now());
    return inviteOut(db.prepare('SELECT * FROM invites WHERE id = ?').get(r.lastInsertRowid));
  },
  // Only a link that is unused, not revoked and not expired can be used to join.
  findActive: (tokenHash) =>
    inviteOut(db.prepare('SELECT * FROM invites WHERE token_hash = ? AND used_at IS NULL AND revoked_at IS NULL AND expires_at > ?').get(tokenHash, now())),
  listByManager: (managerId) =>
    db.prepare('SELECT * FROM invites WHERE manager_id = ? AND revoked_at IS NULL AND (used_at IS NOT NULL OR expires_at > ?) ORDER BY id DESC')
      .all(Number(managerId), now()).map(inviteOut),
  // Atomic: returns false if someone else already used it.
  markUsed: (id, userId) =>
    db.prepare('UPDATE invites SET used_by = ?, used_at = ? WHERE id = ? AND used_at IS NULL AND revoked_at IS NULL')
      .run(Number(userId), now(), Number(id)).changes === 1,
  revoke: (id, managerId) =>
    db.prepare('UPDATE invites SET revoked_at = ? WHERE id = ? AND manager_id = ? AND used_at IS NULL AND revoked_at IS NULL')
      .run(now(), Number(id), Number(managerId)).changes === 1,
};

// Removes a sample employee and everything they own. Refuses to touch real users.
function removeDemoUser(userId) {
  const u = users.byId(userId);
  if (!u || !u.isDemo) throw new Error('not a sample user');
  const ids = db.prepare('SELECT id FROM items WHERE owner_id = ?').all(Number(userId)).map((r) => r.id);
  for (const id of ids) {
    db.prepare('DELETE FROM answers WHERE item_id = ?').run(id);
    db.prepare('DELETE FROM answer_tokens WHERE item_id = ?').run(id);
    db.prepare('DELETE FROM items WHERE id = ?').run(id);
  }
  db.prepare('DELETE FROM share_links WHERE owner_id = ?').run(Number(userId));
  db.prepare('DELETE FROM users WHERE id = ?').run(Number(userId));
}

function tx(fn) {
  db.exec('BEGIN IMMEDIATE');
  try {
    const out = fn();
    db.exec('COMMIT');
    return out;
  } catch (err) {
    db.exec('ROLLBACK');
    throw err;
  }
}

// A person's viaSocket connection per app. auth_id is a credential: server side only, never sent to a browser.
const connOut = (r) =>
  r && {
    userId: sid(r.user_id), app: r.app, authId: r.auth_id,
    slackUserId: r.slack_user_id, slackUserLabel: r.slack_user_label,
  };
const vsConn = {
  get: (userId, app) => connOut(db.prepare('SELECT * FROM viasocket_connections WHERE user_id = ? AND app = ?').get(Number(userId), app)),
  // A different auth_id means a new connection, so the saved Slack choice is cleared.
  upsert: (userId, app, authId) => {
    const t = now();
    const cur = vsConn.get(userId, app);
    if (!cur) {
      db.prepare('INSERT INTO viasocket_connections (user_id, app, auth_id, created_at, updated_at) VALUES (?,?,?,?,?)').run(Number(userId), app, authId, t, t);
    } else if (cur.authId !== authId) {
      db.prepare('UPDATE viasocket_connections SET auth_id = ?, slack_user_id = NULL, slack_user_label = NULL, updated_at = ? WHERE user_id = ? AND app = ?').run(authId, t, Number(userId), app);
    }
    return vsConn.get(userId, app);
  },
  setSlackMe: (userId, value, label) =>
    db.prepare('UPDATE viasocket_connections SET slack_user_id = ?, slack_user_label = ?, updated_at = ? WHERE user_id = ? AND app = ?')
      .run(value, label, now(), Number(userId), 'slack'),
};

// "Already sent today" records, so a message is never sent twice for the same person, kind and day.
const notices = {
  claim: (userId, kind, day) =>
    db.prepare('INSERT OR IGNORE INTO notices (user_id, kind, day, sent_at) VALUES (?,?,?,?)').run(Number(userId), kind, day, now()).changes === 1,
  release: (userId, kind, day) => db.prepare('DELETE FROM notices WHERE user_id = ? AND kind = ? AND day = ?').run(Number(userId), kind, day),
};

// People (not sample data) with nothing planned for `day`, for the morning prompt.
users.withoutPlanFor = (day) =>
  db.prepare(
    `SELECT * FROM users u WHERE u.is_demo = 0
     AND NOT EXISTS (SELECT 1 FROM items i WHERE i.owner_id = u.id AND i.planned_day = ?)
     ORDER BY u.id`
  ).all(day).map(userOut);

module.exports = { db, users, items, answers, tokens, share, invites, tx, removeDemoUser, vsConn, notices };
