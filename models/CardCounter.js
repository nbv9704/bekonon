const mongoose = require('mongoose');

const cardCounterSchema = new mongoose.Schema({
  character: { type: String, required: true },
  rarity: { type: String, required: true },
  lastNumber: { type: Number, default: 0 }
});

cardCounterSchema.index({ character: 1, rarity: 1 }, { unique: true });

module.exports = mongoose.model('CardCounter', cardCounterSchema);
