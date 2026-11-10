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
  created_at TEXT NOT NULL, updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS items_owner ON items(owner_id);
-- The planned day can never be edited, enforced by the database itself.
CREATE TRIGGER IF NOT EXISTS items_planned_day_immutable
BEFORE UPDATE OF planned_day ON items
BEGIN SELECT RAISE(ABORT, 'planned_day is immutable'); END;
-- Items are never deleted.
CREATE TRIGGER IF NOT EXISTS items_no_delete BEFORE DELETE ON items
BEGIN SELECT RAISE(ABORT, 'items cannot be deleted'); END;
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
CREATE TABLE IF NOT EXISTS share_links (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  owner_id INTEGER NOT NULL REFERENCES users(id),
  token_hash TEXT NOT NULL UNIQUE, revoked_at TEXT, created_at TEXT NOT NULL
);
`);

const now = () => new Date().toISOString();
const sid = (v) => String(v);

const userOut = (r) =>
  r && {
    id: sid(r.id), name: r.name, role: r.role, email: r.email, passwordHash: r.password_hash,
    mentorName: r.mentor_name, mentorContact: r.mentor_contact, createdAt: r.created_at,
  };

const itemOut = (r) =>
  r && {
    id: sid(r.id), owner: sid(r.owner_id), what: r.what, forWhom: r.for_whom, contact: r.contact,
    isForMentor: !!r.is_for_mentor, plannedDay: r.planned_day, status: r.status, proofUrl: r.proof_url,
    deliveredAt: r.delivered_at, droppedAt: r.dropped_at, askedAt: r.asked_at, askedVia: r.asked_via,
    askError: r.ask_error, reminderSentAt: r.reminder_sent_at, answeredAt: r.answered_at,
    createdAt: r.created_at, updatedAt: r.updated_at,
  };

const USER_COLS = { name: 'name', role: 'role', mentorName: 'mentor_name', mentorContact: 'mentor_contact' };
const ITEM_COLS = {
  status: 'status', proofUrl: 'proof_url', deliveredAt: 'delivered_at', droppedAt: 'dropped_at',
  askedAt: 'asked_at', askedVia: 'asked_via', askError: 'ask_error',
  reminderSentAt: 'reminder_sent_at', answeredAt: 'answered_at',
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
  create: ({ name, role, email, passwordHash }) => {
    const r = db.prepare('INSERT INTO users (name, role, email, password_hash, created_at) VALUES (?,?,?,?,?)')
      .run(name, role || '', email, passwordHash, now());
    return users.byId(r.lastInsertRowid);
  },
  update: (id, fields) => { update('users', USER_COLS, id, fields, false); return users.byId(id); },
};

const items = {
  get: (id) => itemOut(db.prepare('SELECT * FROM items WHERE id = ?').get(Number(id))),
  getOwned: (id, ownerId) =>
    itemOut(db.prepare('SELECT * FROM items WHERE id = ? AND owner_id = ?').get(Number(id), Number(ownerId))),
  listByOwner: (ownerId) =>
    db.prepare('SELECT * FROM items WHERE owner_id = ? ORDER BY planned_day, created_at, id').all(Number(ownerId)).map(itemOut),
  create: ({ owner, what, forWhom, contact, isForMentor, plannedDay }) => {
    const t = now();
    const r = db.prepare(
      'INSERT INTO items (owner_id, what, for_whom, contact, is_for_mentor, planned_day, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?)'
    ).run(Number(owner), what, forWhom, contact, isForMentor ? 1 : 0, plannedDay, t, t);
    return items.get(r.lastInsertRowid);
  },
  update: (id, fields) => { update('items', ITEM_COLS, id, fields, true); return items.get(id); },
  dueForReminder: (cutoffIso) =>
    db.prepare(
      `SELECT * FROM items WHERE status = 'delivered' AND asked_at IS NOT NULL AND asked_at <= ?
       AND answered_at IS NULL AND reminder_sent_at IS NULL`
    ).all(cutoffIso).map(itemOut),
  // Atomic claim: only one caller can ever win, so an item gets at most one reminder.
  claimReminder: (id) =>
    db.prepare('UPDATE items SET reminder_sent_at = ? WHERE id = ? AND reminder_sent_at IS NULL AND answered_at IS NULL')
      .run(now(), Number(id)).changes === 1,
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

module.exports = { db, users, items, answers, tokens, share };
