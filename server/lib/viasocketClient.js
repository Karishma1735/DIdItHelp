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

// The product's own id for the person, as a string (never the email). One per person, forever.
const scopeFor = (userId) => getClient().user(String(userId));

module.exports = { configured, getClient, scopeFor };
