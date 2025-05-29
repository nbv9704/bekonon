const { SlashCommandBuilder, EmbedBuilder, PermissionsBitField } = require('discord.js');
const { Character } = require('../models');

const ELEMENTS = {
  PYRO: 'Pyro',
  GLACIO: 'Glacio',
  TERRA: 'Terra',
  FLORA: 'Flora',
  ELECTRO: 'Electro',
  AERO: 'Aero',
  LUMEN: 'Lumen',
  UMBRA: 'Umbra',
};

module.exports = {
  data: new SlashCommandBuilder()
    .setName('addcharacter')
    .setDescription('Add a new character to the default character list')
    .addStringOption(option =>
      option.setName('name')
        .setDescription('Character name')
        .setRequired(true))
    .addStringOption(option =>
      option.setName('origin')
        .setDescription('Origin of the character (e.g., Honkai: Star Rail)')
        .setRequired(true))
    .addStringOption(option =>
      option.setName('element')
        .setDescription('Element of the character')
        .setRequired(true)
        .addChoices(
          { name: 'Pyro', value: ELEMENTS.PYRO },
          { name: 'Glacio', value: ELEMENTS.GLACIO },
          { name: 'Terra', value: ELEMENTS.TERRA },
          { name: 'Flora', value: ELEMENTS.FLORA },
          { name: 'Electro', value: ELEMENTS.ELECTRO },
          { name: 'Aero', value: ELEMENTS.AERO },
          { name: 'Lumen', value: ELEMENTS.LUMEN },
          { name: 'Umbra', value: ELEMENTS.UMBRA },
        ))
    .addStringOption(option =>
      option.setName('rarity')
        .setDescription('Default rarity of the character card')
        .setRequired(true)
        .addChoices(
          { name: 'Common ◈C', value: '◈C' },
          { name: 'Rare ◈R', value: '◈R' },
          { name: 'Epic ◈E', value: '◈E' },
          { name: 'Legendary ◈L', value: '◈L' },
        ))
    .addStringOption(option =>
      option.setName('imageurl')
        .setDescription('Default image URL for the character card')
        .setRequired(false))
    .addIntegerOption(option =>
      option.setName('hp')
        .setDescription('HP of the character')
        .setRequired(false))
    .addIntegerOption(option =>
      option.setName('patk')
        .setDescription('Physical attack (PATK) of the character')
        .setRequired(false))
    .addIntegerOption(option =>
      option.setName('pdef')
        .setDescription('Physical defense (PDEF) of the character')
        .setRequired(false))
    .addIntegerOption(option =>
      option.setName('matk')
        .setDescription('Magic attack (MATK) of the character')
        .setRequired(false))
    .addIntegerOption(option =>
      option.setName('mdef')
        .setDescription('Magic defense (MDEF) of the character')
        .setRequired(false))
    .addIntegerOption(option =>
      option.setName('spd')
        .setDescription('Speed (SPD) of the character')
        .setRequired(false)),
  async execute(interaction) {
    try {
      const { options, channel } = interaction;

      // Check for BanMembers permission
      if (!interaction.member.permissionsIn(channel).has(PermissionsBitField.Flags.BanMembers)) {
        await interaction.reply({ content: 'You need **Ban Members** permission to use this command!', ephemeral: true });
        return;
      }

      // Get options
      const characterName = options.getString('name');
      const origin = options.getString('origin');
      const element = options.getString('element');
      const rarity = options.getString('rarity');
      const imageUrl = options.getString('imageurl') || 'https://via.placeholder.com/150';

      // Validate empty inputs
      if (!characterName.trim() || !origin.trim() || !element.trim()) {
        await interaction.reply({ content: 'Name, origin, and element cannot be empty!', ephemeral: true });
        return;
      }

      // Validate image URL
      const isValidUrl = (url) => {
        try {
          new URL(url);
          return true;
        } catch {
          return false;
        }
      };
      if (!isValidUrl(imageUrl)) {
        await interaction.reply({ content: 'Invalid image URL provided!', ephemeral: true });
        return;
      }

      // Get stats with default values
      const stats = {
        HP: options.getInteger('hp') ?? 100,
        PATK: options.getInteger('patk') ?? 10,
        PDEF: options.getInteger('pdef') ?? 10,
        MATK: options.getInteger('matk') ?? 10,
        MDEF: options.getInteger('mdef') ?? 10,
        SPD: options.getInteger('spd') ?? 10,
      };

      // Validate stats (no negative values)
      for (const stat in stats) {
        if (stats[stat] < 0) {
          await interaction.reply({ content: `Stat ${stat} cannot be negative!`, ephemeral: true });
          return;
        }
      }

      // Create new character
      const newCharacter = new Character({
        name: characterName,
        origin,
        element,
        rarity,
        imageUrl,
        stats,
      });

      // Save character and handle duplicate error
      try {
        await newCharacter.save();
      } catch (error) {
        if (error.code === 11000) {
          await interaction.reply({
            content: `Character "${characterName}" with origin "${origin}" and element "${element}" already exists!`,
            ephemeral: true,
          });
          return;
        }
        throw error; // Rethrow other errors
      }

      // Create embed
      const embed = new EmbedBuilder()
        .setTitle('Character Added!')
        .setDescription(`Character **${characterName}** (Origin: ${origin}, Element: ${element}) has been added with rarity: ${rarity}`)
        .setColor('#00ff00')
        .setImage(imageUrl);

      await interaction.reply({ embeds: [embed] });
    } catch (error) {
      console.error('Error in /addcharacter:', error);
      if (!interaction.replied) {
        await interaction.reply({ content: 'An error occurred while adding the character. Please try again!', ephemeral: true });
      }
    }
  },
};  