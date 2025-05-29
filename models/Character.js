const mongoose = require('mongoose');

const characterSchema = new mongoose.Schema({
  name: { type: String, required: true },
  origin: { type: String, required: true },
  element: { type: String, required: true },
  rarity: { type: String, enum: ['◈C', '◈R', '◈E', '◈L'], required: true },
  imageUrl: { type: String, required: true },
  stats: {
    HP: { type: Number, default: 100 },
    PATK: { type: Number, default: 10 },
    PDEF: { type: Number, default: 10 },
    MATK: { type: Number, default: 10 },
    MDEF: { type: Number, default: 10 },
    SPD: { type: Number, default: 10 },
  }
});

// Thêm compound unique index trên name, origin, và element
characterSchema.index({ name: 1, origin: 1, element: 1 }, { unique: true });

module.exports = mongoose.model('Character', characterSchema);
