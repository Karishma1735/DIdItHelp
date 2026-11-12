// Serves proof files stored locally (when the app is not on Embarko's file store). The link holds a random 128-bit id.
const express = require('express');
const fs = require('fs');
const path = require('path');
const files = require('../lib/files');

const router = express.Router();

router.get('/:id/:name', (req, res) => {
  const { id, name } = req.params;
  const ext = files.extOf(name);
  if (!/^[a-f0-9]{32}$/.test(id) || !files.TYPES[ext] || name !== path.basename(name)) return res.sendStatus(404);
  const file = path.join(files.uploadsDir(), id, name);
  if (!file.startsWith(files.uploadsDir() + path.sep) || !fs.existsSync(file)) return res.sendStatus(404);
  res.setHeader('Content-Type', files.TYPES[ext]);
  res.setHeader('Content-Disposition', `${files.INLINE.has(ext) ? 'inline' : 'attachment'}; filename="${name.replace(/"/g, '')}"`);
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Content-Security-Policy', "default-src 'none'; img-src 'self'; media-src 'self'; style-src 'unsafe-inline'; sandbox");
  res.setHeader('Cache-Control', 'private, max-age=3600');
  res.sendFile(file);
});

module.exports = router;
