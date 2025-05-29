const { Client, GatewayIntentBits, ActivityType } = require('discord.js');
const mongoose = require('mongoose');
require('dotenv').config();
const registerCommands = require('./register');

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
const duel = require('./commands/duel');
const grab = require('./commands/grab');

// Kết nối MongoDB
const mongoURI = process.env.MONGODB_URI || 'mongodb://localhost:27017/bekonon';
mongoose.connect(mongoURI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
  .then(async () => {
    console.log('Connected to MongoDB');
    const { Card } = require('./models');
    const cardCount = await Card.countDocuments();
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
      await Card.insertMany(initialCards);
      console.log('Added initial cards:', initialCards);
    }
  })
  .catch(err => console.error('MongoDB connection error:', err.stack));

client.once('ready', async () => {
  console.log(`Logged in as ${client.user.tag}`);
  client.user.setPresence({
    activities: [{ 
      name: 'playing with code', 
      type: ActivityType.Streaming, 
      url: 'https://www.facebook.com/groups/sportsbook3vn' 
    }],
    status: 'idle',
  });

  await registerCommands(client);
});

client.on('interactionCreate', async interaction => {
  if (!interaction.isCommand() && !interaction.isButton()) return;

  try {
    if (interaction.isCommand()) {
      const command = require(`./commands/${interaction.commandName}`);
      console.log(`Executing command: ${interaction.commandName} by ${interaction.user.tag} in guild ${interaction.guild?.name || 'DM'}`);
      await command.execute(interaction, interaction.commandName === 'trade' ? tradeStates : collectionStates);
    } else if (interaction.isButton()) {
      const messageId = interaction.message.id;
      console.log(`Button interaction: ${interaction.customId} on messageId ${messageId} by ${interaction.user.tag} in guild ${interaction.guild?.name || 'DM'}`);

      if (interaction.customId.startsWith('grab_')) {
        console.log(`Processing grab button for messageId ${messageId}`);
        await grab.execute(interaction, collectionStates);
        return;
      }

      if (interaction.customId.startsWith('trade_')) {
        console.log(`Checking trade state for messageId ${messageId}`);
        const state = tradeStates.get(messageId);
        if (!state) {
          console.log(`Trade state not found for messageId ${messageId}`);
          await interaction.reply({ content: 'Trade session not found!', ephemeral: true });
        }
        return;
      }

      if (duel.duelStates && duel.duelStates.has(messageId)) {
        console.log(`Processing duel button for messageId ${messageId}`);
        await duel.handleButton(interaction);
        return;
      }

      const state = collectionStates.get(messageId);
      if (state) {
        console.log(`Found state in collectionStates for messageId ${messageId}:`, state);
        const commandName = state.commandName || 'collection';
        const commandHandler = require(`./commands/${commandName}`);
        if (commandHandler.handleButton) {
          console.log(`Calling handleButton for command ${commandName}`);
          await commandHandler.handleButton(interaction, collectionStates);
        }
        return;
      }

      console.log(`No state found for button ${interaction.customId} on messageId ${messageId}`);
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

client.login(process.env.DISCORD_TOKEN);