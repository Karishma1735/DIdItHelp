const crypto = require('crypto');

// 32 random bytes = 256 bits, unguessable. Because the token is already high-entropy,
// a plain SHA-256 is enough to store it safely.
function generateToken() {
  return crypto.randomBytes(32).toString('base64url');
}

function hashToken(token) {
  return crypto.createHash('sha256').update(String(token)).digest('hex');
}

function safeEqual(a, b) {
  const x = Buffer.from(String(a));
  const y = Buffer.from(String(b));
  return x.length === y.length && crypto.timingSafeEqual(x, y);
}

module.exports = { generateToken, hashToken, safeEqual };
