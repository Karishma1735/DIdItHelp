// A crash leaves a note in a file, not in the database: the database may be what broke. The next start reads the note
// and raises the alert (lib/alerts.js). Needs nothing but the file system.
const fs = require('fs');
const path = require('path');
const m91 = require('./m91');

const file = () => path.join(process.env.DATA_DIR || path.join(__dirname, '..', 'data'), 'crash.json');
const short = (err) => m91.redact(String((err && err.message) || err || '')).replace(/\s+/g, ' ').trim().slice(0, 160) || 'unknown error';

function record(kind, err) {
  try {
    fs.mkdirSync(path.dirname(file()), { recursive: true });
    fs.writeFileSync(file(), JSON.stringify({ at: new Date().toISOString(), kind, message: short(err) }));
  } catch { /* nothing more can be done while crashing */ }
}

function read() {
  try { return JSON.parse(fs.readFileSync(file(), 'utf8')); } catch { return null; }
}

function clear() {
  try { fs.unlinkSync(file()); } catch { /* already gone */ }
}

module.exports = { record, read, clear };
