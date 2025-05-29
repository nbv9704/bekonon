const { SlashCommandBuilder, EmbedBuilder, PermissionsBitField } = require('discord.js');
const { User } = require('../models');
const { getCooldownRemaining } = require('../utils/helpers');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('cooldowns')
    .setDescription('View command cooldown times'),
  async execute(interaction, collectionStates) {
    const { user, channel } = interaction;

    // Check for Send Messages permission
    if (!interaction.member.permissionsIn(channel).has(PermissionsBitField.Flags.SendMessages)) {
      await interaction.reply({ content: 'You need **Send Messages** permission to use this command!', ephemeral: true });
      return;
    }

    // Get player data
    let player = await User.findOne({ userId: user.id });
    if (!player) {
      player = new User({ userId: user.id, cards: [], coins: 0, lastDaily: null, lastDrop: null, lastDropUser: null, lastGrab: null });
      await player.save();
    }

    // Define cooldowns in seconds
    const dropCooldown = 3600; // 60 minutes
    const grabCooldown = 900;  // 15 minutes

    // Get remaining cooldown times in seconds
    const dropRemaining = getCooldownRemaining(player.lastDrop, dropCooldown); // Seconds
    const grabRemaining = getCooldownRemaining(player.lastGrab, grabCooldown); // Seconds

    // Convert seconds to minutes or seconds for display
    const formatTime = (seconds) => {
      if (seconds <= 0) return '\`Ready!\`';
      if (seconds < 60) return `\`${seconds} second${seconds !== 1 ? 's' : ''}\``;
      const minutes = Math.floor(seconds / 60);
      return `\`${minutes} minute${minutes > 1 ? 's' : ''}\``;
    };

    const embed = new EmbedBuilder()
      .setTitle(`${user.username}'s Cooldown Times`)
      .addFields(
        { name: '⏳ Drop', value: formatTime(dropRemaining), inline: true },
        { name: '⏳ Grab', value: formatTime(grabRemaining), inline: true }
      )
      .setColor('#FFA500');

    await interaction.reply({ embeds: [embed] });
  },
};