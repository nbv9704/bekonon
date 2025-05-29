const { SlashCommandBuilder, EmbedBuilder, PermissionsBitField } = require('discord.js');
const { User } = require('../models');
const { getCurrentDateGMT7 } = require('../utils/helpers');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('daily')
    .setDescription('Claim daily coins'),
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

    const hasBanMembers = interaction.member.permissionsIn(channel).has(PermissionsBitField.Flags.BanMembers);
    const currentDate = getCurrentDateGMT7();
    const lastDailyDate = player.lastDaily;

    // Get reset time (0:00 GMT+7 tomorrow) in local timezone
    const getDailyResetTimeLocal = () => {
      const now = new Date();
      const offset = 7 * 60; // GMT+7 offset in minutes
      const utc = now.getTime() + (now.getTimezoneOffset() * 60000);
      const gmt7 = new Date(utc + (offset * 60000));
      const tomorrow = new Date(gmt7);
      tomorrow.setDate(gmt7.getDate() + 1);
      tomorrow.setHours(0, 0, 0, 0); // Set to 0:00 GMT+7
      return tomorrow.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true }); // Format as local time (e.g., "5:00 PM")
    };

    if (!hasBanMembers && lastDailyDate === currentDate) {
      await interaction.reply({ content: `You have already claimed your daily reward! Try again tomorrow at \`${getDailyResetTimeLocal()}\``, ephemeral: true });
      return;
    }

    const dailyReward = Math.floor(Math.random() * (500 - 10 + 1)) + 10;
    player.coins += dailyReward;
    player.lastDaily = currentDate;
    await player.save();

    const embed = new EmbedBuilder()
      .setTitle('Daily Reward Claimed!')
      .setDescription(`You have received **${dailyReward}** 🪙!`)
      .setColor('#FFD700');

    await interaction.reply({ embeds: [embed] });
  },
};