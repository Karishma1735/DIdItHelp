// A short-lived pass that lets viaSocket's AI call our read-only tools FOR ONE MANAGER.
// It is signed with a key derived from JWT_SECRET, so it can never be used as a login token, and a login token
// can never be used as a pass. The tools read the manager from the pass, never from anything the AI sends.
const crypto = require('crypto');
const jwt = require('jsonwebtoken');

const key = () => crypto.createHmac('sha256', process.env.JWT_SECRET).update('ai-tools-pass').digest('hex');

const signPass = (managerId) => jwt.sign({ sub: String(managerId), scope: 'ai-tools' }, key(), { expiresIn: '5m' });

function verifyPass(token) {
  try {
    const p = jwt.verify(token, key());
    return p.scope === 'ai-tools' ? String(p.sub) : null;
  } catch {
    return null;
  }
}

module.exports = { signPass, verifyPass };
