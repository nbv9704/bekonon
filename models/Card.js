const mongoose = require('mongoose');

const cardSchema = new mongoose.Schema({
  cardId: { type: String, required: true, unique: true },
  character: { type: String, required: true },
  rarity: { type: String, enum: ['◈C', '◈R', '◈E', '◈L'], required: true },
  origin: { type: String, required: true },
  element: { type: String, required: true },
  imageUrl: { type: String, required: true },
  number: { type: Number, required: true },
  level: { type: Number, default: 1 },
  locked: { type: Boolean, default: false }, // ✅ NEW
  stats: {
    HP: { type: Number, default: 0 },
    PATK: { type: Number, default: 0 },
    PDEF: { type: Number, default: 0 },
    MATK: { type: Number, default: 0 },
    MDEF: { type: Number, default: 0 },
    SPD: { type: Number, default: 0 },
  },
  statsPercent: {
    HP: { type: Number, default: 0 },
    PATK: { type: Number, default: 0 },
    PDEF: { type: Number, default: 0 },
    MATK: { type: Number, default: 0 },
    MDEF: { type: Number, default: 0 },
    SPD: { type: Number, default: 0 },
  }
});

module.exports = mongoose.model('Card', cardSchema);
