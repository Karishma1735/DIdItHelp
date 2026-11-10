const express = require('express');
const store = require('../lib/store');
const dates = require('../lib/dates');
const { requireAuth } = require('../middleware/auth');
const { sendAsk, createAnswerLinks, messageText } = require('../lib/viasocket');
const { buildOverview, loadItems, serializeItem } = require('../lib/overview');

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
  res.json(await buildOverview(store.users.byId(req.userId), req.query.week));
});

router.post('/items', async (req, res) => {
  const user = store.users.byId(req.userId);
  const what = str(req.body.what, 300);
  const plannedDay = req.body.plannedDay;
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

  await reply(res, store.items.create({ owner: user.id, what, forWhom, contact, isForMentor, plannedDay }), 201);
});

// No PATCH route exists for items on purpose: the planned day can't be edited
// (the database also refuses it with a trigger).

router.post('/items/:id/deliver', async (req, res) => {
  let item = findOwned(req, res);
  if (!item) return;
  if (item.status !== 'planned') return res.status(409).json({ error: 'This item is already delivered or dropped.' });
  const proofUrl = str(req.body.proofUrl, 1000);
  if (!isHttpUrl(proofUrl)) {
    return res.status(400).json({ error: 'Add a proof link (PR, live flow or doc) starting with http:// or https://.' });
  }
  item = store.items.update(item.id, { status: 'delivered', proofUrl, deliveredAt: new Date().toISOString() });
  item = await askAndRecord(item, store.users.byId(req.userId));
  await reply(res, item);
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
