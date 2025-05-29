const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  userId: String,
  cards: [{ type: String, ref: 'Card' }],
  coins: { type: Number, default: 0 },
  shards: { type: Map, of: Number, default: {} }, // Key là rarity như ◈C, ◈R, ...
  lastDaily: { type: String, default: null },
  lastDrop: { type: Number, default: null },
  lastDropUser: {
    cardId: { type: String, default: null },
    expiry: { type: Number, default: null }
  },
  lastGrab: { type: Number, default: null },
});

module.exports = mongoose.model('User', userSchema);
