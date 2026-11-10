const mongoose = require('mongoose');

// status is only the lifecycle: planned -> delivered, or planned -> dropped.
// What the UI shows (Due / Late / Waiting / Helped a lot ...) is derived in lib/scoring.js.
const itemSchema = new mongoose.Schema(
  {
    owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    what: { type: String, required: true, trim: true, maxlength: 300 },
    forWhom: { type: String, required: true, trim: true, maxlength: 120 },
    contact: { type: String, required: true, trim: true, maxlength: 200 },
    isForMentor: { type: Boolean, default: false },
    plannedDay: { type: String, required: true, immutable: true }, // YYYY-MM-DD, never editable
    status: { type: String, enum: ['planned', 'delivered', 'dropped'], default: 'planned' },
    proofUrl: { type: String, default: '' },
    deliveredAt: { type: Date, default: null },
    droppedAt: { type: Date, default: null },
    askedAt: { type: Date, default: null },
    askedVia: { type: String, enum: ['slack', 'email', null], default: null },
    askError: { type: String, default: '' },
    reminderSentAt: { type: Date, default: null },
    answeredAt: { type: Date, default: null },
  },
  { timestamps: true } // createdAt, updatedAt
);

module.exports = mongoose.model('Item', itemSchema);
