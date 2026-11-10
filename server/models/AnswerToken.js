const mongoose = require('mongoose');

// Only the SHA-256 hash is stored; the raw token exists only inside the link we send.
const answerTokenSchema = new mongoose.Schema(
  {
    item: { type: mongoose.Schema.Types.ObjectId, ref: 'Item', required: true, index: true },
    tokenHash: { type: String, required: true, unique: true },
  },
  { timestamps: true }
);

module.exports = mongoose.model('AnswerToken', answerTokenSchema);
