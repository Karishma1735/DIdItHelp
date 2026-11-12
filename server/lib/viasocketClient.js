// The viaSocket SDK client for the product's own users. Server only: it holds the signing secret.
const { ViaSocket } = require('viasocket-apps');

let client = null;

function configured() {
  return !!(process.env.VIASOCKET_ORG_ID && process.env.VIASOCKET_PROJECT_ID && process.env.VIASOCKET_EMBED_SECRET);
}

function getClient() {
  if (!configured()) return null;
  if (!client) {
    client = new ViaSocket({
      orgId: process.env.VIASOCKET_ORG_ID,
      projectId: process.env.VIASOCKET_PROJECT_ID,
      secret: process.env.VIASOCKET_EMBED_SECRET,
    });
  }
  return client;
}

// viaSocket's id for the person: a random id stored with them (never the email, never a reusable number).
// 'catalog' is the fixed id used only for public catalog reads.
function scopeFor(userId) {
  const person = userId === 'catalog' ? null : require('./store').users.byId(userId);
  return getClient().user(person && person.vsId ? person.vsId : String(userId));
}

module.exports = { configured, getClient, scopeFor };
