const express = require('express');
const rateLimit = require('express-rate-limit');
const store = require('../lib/store');
const dates = require('../lib/dates');
const { requireAuth } = require('../middleware/auth');
const { createAnswerLinks, messageText } = require('../lib/viasocket');
const { sendAsk } = require('../lib/messenger');
const { buildOverview, loadItems, serializeItem } = require('../lib/overview');
const { emailManagerReport } = require('../lib/report');
const files = require('../lib/files');

const router = express.Router();
router.use(requireAuth);

const str = (v, max) => (typeof v === 'string' ? v.trim().slice(0, max) : '');

function isHttpUrl(v) {
  try {
    const u = new URL(v);
    return u.protocol === 'http:' || u.protocol === 'https:';
  } catch {
    return false;
  }
}

function findOwned(req, res) {
  const item = /^\d+$/.test(req.params.id) ? store.items.getOwned(req.params.id, req.userId) : null;
  if (!item) res.status(404).json({ error: 'Item not found.' });
  return item;
}

async function reply(res, item, status = 200) {
  const withAnswer = (await loadItems(item.owner)).find((i) => i.id === item.id);
  res.status(status).json({ item: serializeItem(withAnswer, dates.today()) });
}

// Sends the ask. askedAt / askedVia are saved ONLY when viaSocket answers 2xx.
async function askAndRecord(item, owner) {
  const result = await sendAsk(item, owner, false);
  return store.items.update(
    item.id,
    result.ok ? { askedAt: new Date().toISOString(), askedVia: result.channel, askError: '' } : { askError: result.error }
  );
}

router.get('/overview', async (req, res) => {
  res.json(await buildOverview(store.users.byId(req.userId), req.query));
});

router.post('/items', async (req, res) => {
  const user = store.users.byId(req.userId);
  const what = str(req.body.what, 300);
  const plannedDay = req.body.plannedDay;
  const deadlineTime = req.body.deadlineTime === undefined ? '17:00' : req.body.deadlineTime;
  const isForMentor = req.body.isForMentor === true;
  let forWhom = str(req.body.forWhom, 120);
  let contact = str(req.body.contact, 200);

  if (isForMentor) {
    forWhom = user.mentorName;
    contact = user.mentorContact;
    if (!forWhom || !contact) {
      return res.status(400).json({ error: 'Add your mentor’s name and contact in Settings first.' });
    }
  }
  if (!what || !forWhom || !contact) {
    return res.status(400).json({ error: 'Say what you will deliver, who it is for and how to reach them.' });
  }
  if (!dates.isDay(plannedDay)) return res.status(400).json({ error: 'Pick a valid day.' });
  if (plannedDay < dates.today()) {
    return res.status(400).json({ error: 'The planned day can’t be in the past.' });
  }

  if (!dates.isTime(deadlineTime)) return res.status(400).json({ error: 'Pick a deadline time, like 17:00.' });
  if (plannedDay === dates.today() && deadlineTime <= dates.localParts().hm) {
    return res.status(400).json({ error: 'That deadline time has already passed today. Pick a later time, or plan it for another day.' });
  }

  await reply(res, store.items.create({ owner: user.id, what, forWhom, contact, isForMentor, plannedDay, deadlineTime }), 201);
});

// No PATCH route exists for items on purpose: the planned day can't be edited
// (the database also refuses it with a trigger).

// Marks the item delivered with its proof, asks the receiver, and (in the evening) emails the manager.
async function finishDelivery(req, res, item, proof) {
  item = store.items.update(item.id, { status: 'delivered', deliveredAt: new Date().toISOString(), ...proof });
  item = await askAndRecord(item, store.users.byId(req.userId));
  await emailManagerReport(item); // evening submissions are emailed to the manager; never blocks the delivery
  await reply(res, item);
}

// Proof as a link (PR, live flow, doc).
router.post('/items/:id/deliver', async (req, res) => {
  const item = findOwned(req, res);
  if (!item) return;
  if (item.status !== 'planned') return res.status(409).json({ error: 'This item is already delivered or dropped.' });
  const proofUrl = str(req.body.proofUrl, 1000);
  if (!isHttpUrl(proofUrl)) {
    return res.status(400).json({ error: 'Add a proof link (PR, live flow or doc) starting with http:// or https://, or upload a file.' });
  }
  await finishDelivery(req, res, item, { proofUrl });
});

// Proof as an uploaded file: the raw file is the request body, its name is in ?name=. Stored once, linked as the proof.
const uploadLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 40,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => `u${req.userId}`,
  message: { error: 'Too many uploads. Please try again in a while.' },
});

router.post('/items/:id/deliver-file', uploadLimiter, express.raw({ type: '*/*', limit: files.MAX_BYTES + 1024 }), async (req, res) => {
  const item = findOwned(req, res);
  if (!item) return;
  // Check the state BEFORE storing anything, so a refused delivery never leaves an orphan file behind.
  if (item.status !== 'planned') return res.status(409).json({ error: 'This item is already delivered or dropped.' });
  const checked = files.check(str(req.query.name, 300), req.body);
  if (!checked.ok) return res.status(400).json({ error: checked.error });

  let stored;
  try {
    stored = await files.save(req.body, checked.name);
  } catch (err) {
    return res.status(502).json({ error: err.message });
  }
  try {
    await finishDelivery(req, res, item, {
      proofUrl: stored.url,
      proofFileName: checked.name,
      proofFileId: stored.id,
      proofFileSize: req.body.length,
      proofStorage: stored.storage,
    });
  } catch (err) {
    await files.remove(stored.storage, stored.id);
    throw err;
  }
});

router.post('/items/:id/ask', async (req, res) => {
  const item = findOwned(req, res);
  if (!item) return;
  if (item.status !== 'delivered') return res.status(409).json({ error: 'Only delivered items can be asked about.' });
  await reply(res, await askAndRecord(item, store.users.byId(req.userId)));
});

router.post('/items/:id/message', async (req, res) => {
  const item = findOwned(req, res);
  if (!item) return;
  if (item.status !== 'delivered') return res.status(409).json({ error: 'Only delivered items can be asked about.' });
  const links = await createAnswerLinks(item.id);
  res.json({ text: messageText(item, store.users.byId(req.userId), links) });
});

// Dropping is allowed only before delivery. A delivered item (and its answer) can never be removed.
router.post('/items/:id/drop', async (req, res) => {
  const item = findOwned(req, res);
  if (!item) return;
  if (item.status !== 'planned') return res.status(409).json({ error: 'Delivered items can’t be dropped.' });
  await reply(res, store.items.update(item.id, { status: 'dropped', droppedAt: new Date().toISOString() }));
});

module.exports = router;
