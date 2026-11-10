const express = require('express');
const bcrypt = require('bcryptjs');
const store = require('../lib/store');
const { requireAuth, signToken } = require('../middleware/auth');
const { authLimiter } = require('../middleware/rateLimits');

const router = express.Router();
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const str = (v, max = 200) => (typeof v === 'string' ? v.trim().slice(0, max) : '');

const publicUser = (u) => ({
  id: u.id, name: u.name, role: u.role, email: u.email, mentorName: u.mentorName, mentorContact: u.mentorContact,
});

// v1 is a single-owner workspace: only the first account can be registered.
router.post('/register', authLimiter, async (req, res) => {
  const name = str(req.body.name, 100);
  const email = str(req.body.email).toLowerCase();
  const password = typeof req.body.password === 'string' ? req.body.password : '';
  if (!name || !EMAIL_RE.test(email) || password.length < 8) {
    return res.status(400).json({ error: 'Enter your name, a valid email and a password of at least 8 characters.' });
  }
  if (store.users.count() > 0) {
    return res.status(403).json({ error: 'This workspace already has an owner. Please sign in.' });
  }
  const user = store.users.create({
    name, email, role: str(req.body.role, 100), passwordHash: await bcrypt.hash(password, 12),
  });
  res.status(201).json({ token: signToken(user), user: publicUser(user) });
});

router.post('/login', authLimiter, async (req, res) => {
  const email = str(req.body.email).toLowerCase();
  const password = typeof req.body.password === 'string' ? req.body.password : '';
  const user = store.users.byEmail(email);
  const ok = user && (await bcrypt.compare(password, user.passwordHash));
  if (!ok) return res.status(401).json({ error: 'That email and password do not match.' });
  res.json({ token: signToken(user), user: publicUser(user) });
});

// Lets the login page know whether to offer "create the owner account".
router.get('/status', (req, res) => res.json({ hasOwner: store.users.count() > 0 }));

router.get('/me', requireAuth, (req, res) => {
  const user = store.users.byId(req.userId);
  if (!user) return res.status(401).json({ error: 'Please sign in.' });
  res.json({ user: publicUser(user) });
});

router.patch('/me', requireAuth, (req, res) => {
  if (!store.users.byId(req.userId)) return res.status(401).json({ error: 'Please sign in.' });
  const fields = {};
  if (req.body.name !== undefined) {
    fields.name = str(req.body.name, 100);
    if (!fields.name) return res.status(400).json({ error: 'Name can’t be empty.' });
  }
  if (req.body.role !== undefined) fields.role = str(req.body.role, 100);
  if (req.body.mentorName !== undefined) fields.mentorName = str(req.body.mentorName, 100);
  if (req.body.mentorContact !== undefined) fields.mentorContact = str(req.body.mentorContact);
  res.json({ user: publicUser(store.users.update(req.userId, fields)) });
});

module.exports = router;
