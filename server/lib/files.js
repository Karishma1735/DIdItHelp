// Proof uploads. A file is stored in Embarko's file store when the app runs there (STORAGE_URL / STORAGE_TOKEN),
// otherwise in a local folder (DATA_DIR/uploads) that the app serves itself, so it also works on a developer's machine.
// Either way the result is one public, unguessable link, which is saved as the item's proof link.
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const MAX_BYTES = 20 * 1024 * 1024; // Embarko's own per-file limit is higher; keep ours below it

// Only types Embarko's file store accepts, and only safe ones (no html, js or svg).
const TYPES = {
  png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', gif: 'image/gif', webp: 'image/webp',
  pdf: 'application/pdf', txt: 'text/plain; charset=utf-8', md: 'text/plain; charset=utf-8', csv: 'text/csv; charset=utf-8',
  zip: 'application/zip', mp4: 'video/mp4', webm: 'video/webm',
};
const INLINE = new Set(['png', 'jpg', 'jpeg', 'gif', 'webp', 'pdf', 'mp4', 'webm']); // shown in the browser; the rest download

const uploadsDir = () => path.join(process.env.DATA_DIR || path.join(__dirname, '..', 'data'), 'uploads');
const extOf = (name) => (path.extname(name).slice(1) || '').toLowerCase();

// A safe file name: no folders, no odd characters, 1-120 chars, keeps its extension.
function cleanName(raw) {
  const base = path.basename(String(raw || '').replace(/\\/g, '/'));
  const ext = extOf(base);
  const stem = base.slice(0, base.length - (ext ? ext.length + 1 : 0)).normalize('NFKD').replace(/[^\w.-]+/g, '-').replace(/^[-.]+|[-.]+$/g, '').slice(0, 100);
  return { name: `${stem || 'proof'}.${ext}`, ext };
}

const starts = (b, bytes, at = 0) => bytes.every((v, i) => b[at + i] === v);
// The file must really be what its extension says (a renamed .exe or .html is refused).
const SNIFF = {
  png: (b) => starts(b, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  jpg: (b) => starts(b, [0xff, 0xd8, 0xff]),
  gif: (b) => starts(b, [0x47, 0x49, 0x46, 0x38]),
  webp: (b) => starts(b, [0x52, 0x49, 0x46, 0x46]) && starts(b, [0x57, 0x45, 0x42, 0x50], 8),
  pdf: (b) => starts(b, [0x25, 0x50, 0x44, 0x46, 0x2d]),
  zip: (b) => starts(b, [0x50, 0x4b]),
  mp4: (b) => starts(b, [0x66, 0x74, 0x79, 0x70], 4),
  webm: (b) => starts(b, [0x1a, 0x45, 0xdf, 0xa3]),
  text: (b) => !b.subarray(0, 4096).includes(0),
};
SNIFF.jpeg = SNIFF.jpg;
SNIFF.txt = SNIFF.md = SNIFF.csv = SNIFF.text;

// Returns { ok: true, name, ext } or { ok: false, error } for a person-friendly message.
function check(rawName, buffer) {
  if (!Buffer.isBuffer(buffer) || !buffer.length) return { ok: false, error: 'Choose a file to upload.' };
  if (buffer.length > MAX_BYTES) return { ok: false, error: `That file is too large. The limit is ${MAX_BYTES / 1024 / 1024} MB.` };
  const { name, ext } = cleanName(rawName);
  if (!TYPES[ext]) {
    return { ok: false, error: `That file type isn’t allowed. Use: ${Object.keys(TYPES).join(', ')}. For Word or Excel files, put them in a zip, or paste a link instead.` };
  }
  if (!SNIFF[ext](buffer)) return { ok: false, error: `That doesn’t look like a real .${ext} file.` };
  return { ok: true, name, ext };
}

const embarko = () => !!(process.env.STORAGE_URL && process.env.STORAGE_TOKEN && process.env.APP_NAME);

const STORE_ERRORS = {
  storage_quota_reached: 'The app’s file storage is full. Delete some files, or paste a link instead.',
  file_too_large: 'That file is too large for this app’s file storage.',
  file_type_not_allowed: 'That file type isn’t allowed.',
  invalid_filename: 'That file name isn’t allowed. Rename it and try again.',
};

// Stores the file and returns { url, id, storage }. Throws an Error with a plain message on failure.
async function save(buffer, name) {
  if (embarko()) {
    const res = await fetch(`${process.env.STORAGE_URL}/apps/${process.env.APP_NAME}/files/${encodeURIComponent(name)}`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${process.env.STORAGE_TOKEN}`, 'Content-Length': String(buffer.length), 'Content-Type': 'application/octet-stream' },
      body: buffer,
      signal: AbortSignal.timeout(60000),
    });
    let body = {};
    try { body = await res.json(); } catch { /* not JSON */ }
    if (!res.ok || !body.url) throw new Error(STORE_ERRORS[body.error] || 'The file could not be stored. Please try again in a minute.');
    return { url: body.url, id: String(body.id), storage: 'embarko' };
  }
  const id = crypto.randomBytes(16).toString('hex'); // 128 bits: unguessable
  const dir = path.join(uploadsDir(), id);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, name), buffer);
  return { url: `${(process.env.APP_URL || '').replace(/\/+$/, '')}/files/${id}/${encodeURIComponent(name)}`, id, storage: 'local' };
}

// Removes a stored file (used when a delivery fails after the upload). Never throws.
async function remove(storage, id, name) {
  try {
    if (storage === 'embarko' && embarko()) {
      await fetch(`${process.env.STORAGE_URL}/apps/${process.env.APP_NAME}/files/${encodeURIComponent(id)}`, {
        method: 'DELETE', headers: { Authorization: `Bearer ${process.env.STORAGE_TOKEN}` }, signal: AbortSignal.timeout(15000),
      });
    } else if (storage === 'local' && /^[a-f0-9]{32}$/.test(id)) {
      fs.rmSync(path.join(uploadsDir(), id), { recursive: true, force: true });
    }
  } catch { /* nothing more to do */ }
}

module.exports = { MAX_BYTES, TYPES, INLINE, uploadsDir, extOf, cleanName, check, save, remove };
