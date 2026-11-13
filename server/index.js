const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
require('dotenv').config();

// A crash must leave a note before the process dies, so the next start can wake someone (see lib/crashNote.js).
// Registered first, with nothing else loaded: it works even when the database is what failed.
const crashed = (kind) => (err) => {
  require('./lib/crashNote').record(kind, err);
  console.error(err);
  process.exit(1);
};
process.on('uncaughtException', crashed('uncaughtException'));
process.on('unhandledRejection', crashed('unhandledRejection'));

require('express-async-errors');
const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const fs = require('fs');

// Hosted defaults: APP_URL from the app name, and a login-signing secret kept in the data folder
// so the app can boot before any env vars are set. Set JWT_SECRET explicitly to override.
if (!process.env.APP_URL && process.env.APP_NAME) process.env.APP_URL = `https://${process.env.APP_NAME}.embarko.app`;
if (!process.env.JWT_SECRET) {
  const dataDir = process.env.DATA_DIR || path.join(__dirname, 'data');
  const secretFile = path.join(dataDir, 'jwt-secret');
  fs.mkdirSync(dataDir, { recursive: true });
  if (!fs.existsSync(secretFile)) fs.writeFileSync(secretFile, require('crypto').randomBytes(48).toString('hex'), { mode: 0o600 });
  process.env.JWT_SECRET = fs.readFileSync(secretFile, 'utf8').trim();
}
for (const key of ['APP_URL', 'VIASOCKET_ASK_WEBHOOK_URL', 'DIGEST_KEY', 'M91_SEND_LINK']) {
  if (!process.env[key]) console.warn(`Warning: ${key} is not set.`);
}

const app = express();
app.set('trust proxy', 1); // Render/Railway sit behind a proxy; needed for correct rate limiting
// The page may load viaSocket's embedded screens and connect script, and show app icons.
app.use(
  helmet({
    contentSecurityPolicy: {
      useDefaults: true,
      directives: {
        'script-src': ["'self'", 'https://*.viasocket.com'],
        'frame-src': ["'self'", 'https://*.viasocket.com'],
        'connect-src': ["'self'", 'https://*.viasocket.com'],
        'img-src': ["'self'", 'data:', 'https:'],
      },
    },
  })
);
app.use(cors({ origin: process.env.APP_URL || false }));
app.use(express.json({ limit: '20kb' }));

const alerts = require('./lib/alerts');

app.get('/healthz', (req, res) => res.json({ ok: true })); // is the process alive? Hosts may use this to decide on restarts
// For the outside watchdog (an M91 alert flow in viaSocket): can the app write its database, and is its scheduler still
// running? A separate path so a database problem can never make a host restart the app. Says only ok or what is wrong.
app.get('/healthz/deep', (req, res) => {
  const problems = alerts.health();
  res.set('Cache-Control', 'no-store').status(problems.length ? 503 : 200).json({ ok: !problems.length, problems });
});
app.use('/tasks', require('./routes/tasks'));
app.use('/files', require('./routes/localFiles')); // proof files stored on this server (see lib/files.js)
app.use('/api/auth', require('./routes/auth'));
app.use('/api/answer', require('./routes/answers'));
app.use('/api/share', require('./routes/share').owner);
app.use('/api/team', require('./routes/team'));
app.use('/api/integrations', require('./routes/integrations'));
app.use('/api/viasocket', require('./routes/viasocket'));
app.use('/api/blocks', require('./routes/blocks'));
app.use('/api/planner', require('./routes/planner'));
app.use('/api/ai-tools', require('./routes/aiTools')); // called by viaSocket's AI with a per-manager pass
app.use('/api/ai', require('./routes/ai'));
app.use('/api/manager', require('./routes/share').manager);
app.use('/api', require('./routes/daily')); // /api/today, /api/digest, /api/jobs/reminders (key protected)
app.use('/api', require('./routes/items'));
app.use('/api', (req, res) => res.status(404).json({ error: 'Not found.' }));

// In production Express serves the built React app.
const dist = path.join(__dirname, '..', 'client', 'dist');
if (fs.existsSync(dist)) {
  app.use(express.static(dist));
  app.get('*', (req, res) => res.sendFile(path.join(dist, 'index.html')));
}

app.use((err, req, res, next) => {
  if (err && err.type === 'entity.too.large') return res.status(413).json({ error: 'That file is too large. The limit is 20 MB.' });
  console.error(err);
  if (alerts.isStorageError(err)) alerts.bad('database-unwritable', { detail: err });
  res.status(500).json({ error: 'Something went wrong on our side.' });
});

require('./lib/store'); // opens the SQLite database and creates the tables
const port = process.env.PORT || 5000;
app.listen(port, '0.0.0.0', () => {
  console.log(`Did it help? listening on ${port}`);
  alerts.housekeeping(); // raises the alert for a crash that happened before this start, and retries anything M91 missed
});
