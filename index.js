const { Client, GatewayIntentBits, ActivityType } = require('discord.js');
const mongoose = require('mongoose');
const express = require('express');
const { setTimeout } = require('timers/promises');
require('dotenv').config();
const registerCommands = require('./register');

// Khởi tạo HTTP server
const app = express();
const PORT = process.env.PORT || 8080;

// Route đơn giản để Render kiểm tra
app.get('/', (req, res) => {
  res.status(200).send('Bot is running!');
});

// Mở cổng HTTP
app.listen(PORT, () => {
  console.log(`HTTP server running on port ${PORT}`);
});

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildMessageReactions,
    GatewayIntentBits.MessageContent,
  ],
});

const collectionStates = new Map();
const tradeStates = new Map();

// Kết nối MongoDB
const mongoURI = process.env.MONGODB_URI || 'mongodb://localhost:27017/bekonon';
mongoose.connect(mongoURI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
  .then(async () => {
    console.log('Connected to MongoDB');
    try {
      const { Card } = require('./models');
      console.log('Counting documents in Card collection...');
      const cardCount = await Promise.race([
        Card.countDocuments(),
        setTimeout(30000).then(() => { throw new Error('Timeout: Failed to count documents in Card collection after 30 seconds'); }),
      ]);
      console.log(`Found ${cardCount} cards in database`);
      if (cardCount === 0) {
        const initialCards = [
          { 
            character: "Bimajo", 
            rarity: "◈C", 
            imageUrl: "https://i.imgur.com/0qY1z8u.png",
            number: 1,
            element: "Fire",
            origin: "Fantasy",
            cardId: "bimajo-001"
          },
          { 
            character: "Jane Elves", 
            rarity: "◈R", 
            imageUrl: "https://i.imgur.com/3kX7z9v.png",
            number: 2,
            element: "Earth",
            origin: "Elven",
            cardId: "janeelves-002"
          },
          { 
            character: "Ru-chan", 
            rarity: "◈E", 
            imageUrl: "https://i.imgur.com/7nZ3x4p.png",
            number: 3,
            element: "Water",
            origin: "Anime",
            cardId: "ruchan-003"
          },
        ];
        console.log('Inserting initial cards...');
        await Promise.race([
          Card.insertMany(initialCards),
          setTimeout(30000).then(() => { throw new Error('Timeout: Failed to insert initial cards after 30 seconds'); }),
        ]);
        console.log('Added initial cards:', initialCards);
      }
    } catch (error) {
      console.error('Error initializing MongoDB data:', error.stack);
    }
    console.log('Continuing bot startup after MongoDB initialization...');
  })
  .catch(err => console.error('MongoDB connection error:', err.stack));

// Thêm log để kiểm tra Discord token và đăng nhập
console.log('Attempting to login to Discord with token...');
client.login(process.env.DISCORD_TOKEN)
  .then(() => console.log('Discord login successful'))
  .catch(err => console.error('Failed to login to Discord:', err.stack));

client.once('ready', async () => {
  console.log(`Logged in as ${client.user.tag}`);
  client.user.setPresence({
    activities: [{ 
      name: 'ur basement', 
      type: ActivityType.Streaming, 
      url: 'https://youtu.be/dQw4w9WgXcQ?si=dHCW5hGhxwrlLGX9' 
    }],
    status: 'idle',
  });

  try {
    await registerCommands(client);
    console.log('Commands registered successfully');
  } catch (error) {
    console.error('Error registering commands:', error.stack);
  }
});

client.on('interactionCreate', async interaction => {
  if (!interaction.isCommand() && !interaction.isButton()) return;

  try {
    if (interaction.isCommand()) {
      const command = require(`./commands/${interaction.commandName}`);
      await command.execute(interaction, interaction.commandName === 'trade' ? tradeStates : collectionStates);
    } else if (interaction.isButton()) {
      const messageId = interaction.message.id;

      if (interaction.customId.startsWith('grab_')) {
        await grab.execute(interaction, collectionStates);
        return;
      }

      if (interaction.customId.startsWith('trade_')) {
        const state = tradeStates.get(messageId);
        if (!state) {
          await interaction.reply({ content: 'Trade session not found!', ephemeral: true });
        }
        return;
      }

      if (duel && duel.duelStates && duel.duelStates.has(messageId)) {
        await duel.handleButton(interaction);
        return;
      }

      const state = collectionStates.get(messageId);
      if (state) {
        const commandName = state.commandName || 'collection';
        const commandHandler = require(`./commands/${commandName}`);
        if (commandHandler.handleButton) {
          await commandHandler.handleButton(interaction, collectionStates);
        }
        return;
      }

      await interaction.reply({ content: 'Unknown button action!', ephemeral: true });
    }
  } catch (error) {
    console.error(`Error handling interaction ${interaction.customId || interaction.commandName} by ${interaction.user.tag} in guild ${interaction.guild?.name || 'DM'}:`, error.stack);
    if (!interaction.replied && !interaction.deferred) {
      await interaction.reply({ content: 'An error occurred while processing the request!', ephemeral: true });
    } else {
      await interaction.followUp({ content: 'An error occurred while processing the request!', ephemeral: true });
    }
  }
});