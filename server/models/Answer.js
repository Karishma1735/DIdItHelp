const mongoose = require('mongoose');

const answerSchema = new mongoose.Schema({
  item: { type: mongoose.Schema.Types.ObjectId, ref: 'Item', required: true, unique: true },
  value: { type: String, enum: ['lot', 'little', 'none'], required: true },
  comment: { type: String, default: '', maxlength: 1000 },
  answeredAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model('Answer', answerSchema);
