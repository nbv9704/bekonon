const Card = require('../models/Card');

async function generateCardId() {
  const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  const maxAttempts = 10;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const length = Math.floor(Math.random() * 7) + 1;
    let result = '';
    for (let i = 0; i < length; i++) {
      result += characters.charAt(Math.floor(Math.random() * characters.length));
    }

    const existingCard = await Card.findOne({ cardId: result });
    if (!existingCard) {
      return result;
    }
  }

  throw new Error('Unable to generate a unique card ID after maximum attempts');
}

function getCurrentDateGMT7() {
  const now = new Date();
  const offset = 7 * 60;
  const utc = now.getTime() + (now.getTimezoneOffset() * 60000);
  const gmt7 = new Date(utc + (offset * 60000));
  return gmt7.toISOString().split('T')[0];
}

function getCooldownRemaining(lastUsed, cooldownSeconds) {
  if (!lastUsed) return 0;
  const now = Date.now();
  const elapsed = (now - lastUsed) / 1000;
  const remaining = cooldownSeconds - elapsed;
  return remaining > 0 ? Math.ceil(remaining) : 0;
}

function getRandomRarity() {
  const rarities = [
    { rarity: '◈L', weight: 0.01 },
    { rarity: '◈E', weight: 3.49 },
    { rarity: '◈R', weight: 26.5 },
    { rarity: '◈C', weight: 70.0 },
  ];

  const totalWeight = rarities.reduce((sum, r) => sum + r.weight, 0);
  let random = Math.random() * totalWeight;

  for (const rarity of rarities) {
    if (random < rarity.weight) return rarity.rarity;
    random -= rarity.weight;
  }
  return rarities[rarities.length - 1].rarity;
}

function getRarityColor(rarity) {
  switch (rarity) {
    case '◈C': return '#2C2F33';
    case '◈R': return '#2C2F33';
    case '◈E': return '#2C2F33';
    case '◈L': return '#2C2F33';
    default: return '#0099ff';
  }
}

function sortCards(cards, sortMode, cardOrder) {
  const sortedCards = [...cards];
  if (sortMode === 'date') {
    sortedCards.sort((a, b) => cardOrder.indexOf(b.cardId) - cardOrder.indexOf(a.cardId));
  } else if (sortMode === 'name') {
    sortedCards.sort((a, b) => a.character.localeCompare(b.character));
  } else if (sortMode === 'rarity') {
    const rarityOrder = { '◈L': 4, '◈E': 3, '◈R': 2, '◈C': 1 };
    sortedCards.sort((a, b) => (rarityOrder[b.rarity] || 0) - (rarityOrder[a.rarity] || 0));
  } else if (sortMode === 'number') {
    sortedCards.sort((a, b) => a.number - b.number);
  } else if (sortMode === 'level') {
    sortedCards.sort((a, b) => b.level - a.level);
  }
  return sortedCards;
}

// Hàm lấy thưởng coin dựa theo rarity khi dismantle
function getDismantleCoinReward(rarity) {
  switch (rarity) {
    case '◈C': return Math.floor(Math.random() * (15 - 5 + 1)) + 5;   // 5 - 15 coin
    case '◈R': return Math.floor(Math.random() * (40 - 20 + 1)) + 20; // 20 - 40 coin
    case '◈E': return Math.floor(Math.random() * (70 - 50 + 1)) + 50; // 50 - 70 coin
    case '◈L': return Math.floor(Math.random() * (120 - 100 + 1)) + 100; // 100 - 120 coin
    default: return 0;
  }
}

// Biểu tượng icon cho từng element
const elementIcons = {
  PYRO: '🔥',
  GLACIO: '❄️',
  TERRA: '⛰️',
  FLORA: '☘️',
  ELECTRO: '⚡',
  AERO: '☁️',
  LUMEN: '☀️',
  UMBRA: '🌙',
};

function getElementIcon(element) {
  if (!element) return '';
  return elementIcons[element.toUpperCase()] || '';
}

module.exports = {
  generateCardId,
  getCurrentDateGMT7,
  getCooldownRemaining,
  getRandomRarity,
  getRarityColor,
  sortCards,
  getDismantleCoinReward,
  elementIcons,
  getElementIcon,
};
