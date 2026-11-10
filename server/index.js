const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
require('dotenv').config();

require('express-async-errors');
const express = require('express');
const mongoose = require('mongoose');
const helmet = require('helmet');
const cors = require('cors');
const fs = require('fs');

for (const key of ['MONGODB_URI', 'JWT_SECRET']) {
  if (!process.env[key]) {
    console.error(`Missing required env var ${key}. See .env.example.`);
    process.exit(1);
  }
}
for (const key of ['APP_URL', 'VIASOCKET_ASK_WEBHOOK_URL', 'DIGEST_KEY']) {
  if (!process.env[key]) console.warn(`Warning: ${key} is not set.`);
}

const app = express();
app.set('trust proxy', 1); // Render/Railway sit behind a proxy; needed for correct rate limiting
app.use(helmet());
app.use(cors({ origin: process.env.APP_URL || false }));
app.use(express.json({ limit: '20kb' }));

app.get('/healthz', (req, res) => res.json({ ok: true }));
app.use('/api/auth', require('./routes/auth'));
app.use('/api/answer', require('./routes/answers'));
app.use('/api/share', require('./routes/share').owner);
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
  console.error(err);
  res.status(500).json({ error: 'Something went wrong on our side.' });
});

async function start() {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('MongoDB connected');
  require('./jobs/reminders').startReminderJob();
  const port = process.env.PORT || 5000;
  app.listen(port, () => console.log(`Did it help? listening on ${port}`));
}

start().catch((err) => {
  console.error('Failed to start', err);
  process.exit(1);
});
