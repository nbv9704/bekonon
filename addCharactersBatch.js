const mongoose = require('mongoose');
const fs = require('fs');
require('dotenv').config();
const { Character, Card } = require('./models');

// Read character list from JSON file
let charactersToAdd;
try {
  charactersToAdd = JSON.parse(fs.readFileSync('characters.json', 'utf8'));
} catch (error) {
  console.error('Error reading characters.json file:', error.message);
  process.exit(1);
}

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(() => console.log('MongoDB connection successful!'))
  .catch(err => console.error('MongoDB connection error:', err));

async function addCharactersBatch() {
  const rarities = ['◈C', '◈R', '◈E', '◈L'];

  for (const char of charactersToAdd) {
    try {
      // Check if the character already exists
      const existingCharacter = await Character.findOne({ name: char.name });
      if (existingCharacter) {
        console.log(`Character ${char.name} already exists, skipping...`);
        continue;
      }

      // Add new character to the characters collection
      const newCharacter = new Character({
        name: char.name,
        origin: char.origin,
      });
      await newCharacter.save();
      console.log(`Added character: ${char.name} (${char.origin})`);

      // Create card templates for the character with rarities
      const rarityCount = Math.min(char.rarityCount, rarities.length); // Ensure it doesn't exceed available rarities
      const cardsToAdd = [];
      for (let i = 0; i < rarityCount; i++) {
        cardsToAdd.push({
          character: char.name,
          rarity: rarities[i],
          origin: char.origin,
          imageUrl: 'https://via.placeholder.com/150', // Default URL
        });
      }

      await Card.insertMany(cardsToAdd);
      console.log(`Created ${rarityCount} card templates for ${char.name}`);
    } catch (error) {
      console.error(`Error adding character ${char.name}:`, error);
    }
  }

  console.log('Finished adding characters!');
  mongoose.connection.close();
}

addCharactersBatch();