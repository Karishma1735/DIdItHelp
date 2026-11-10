const jwt = require('jsonwebtoken');

function userIdFromRequest(req) {
  const header = req.headers.authorization || '';
  if (!header.startsWith('Bearer ')) return null;
  try {
    return jwt.verify(header.slice(7), process.env.JWT_SECRET).sub;
  } catch {
    return null;
  }
}

function requireAuth(req, res, next) {
  const id = userIdFromRequest(req);
  if (!id) return res.status(401).json({ error: 'Please sign in.' });
  req.userId = id;
  next();
}

const signToken = (user) =>
  jwt.sign({ sub: user.id }, process.env.JWT_SECRET, { expiresIn: '30d' });

module.exports = { requireAuth, userIdFromRequest, signToken };
