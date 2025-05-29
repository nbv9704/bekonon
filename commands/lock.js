const { SlashCommandBuilder, PermissionsBitField, EmbedBuilder } = require('discord.js');
const { Card, User } = require('../models');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('lock')
    .setDescription('Toggle lock/unlock status of a card')
    .addStringOption(option =>
      option.setName('cardid')
        .setDescription('ID of the card to lock/unlock')
        .setRequired(true)
    ),

  async execute(interaction) {
    const { channel, user } = interaction;
    const cardId = interaction.options.getString('cardid');

    if (!interaction.member.permissionsIn(channel).has(PermissionsBitField.Flags.SendMessages)) {
      await interaction.reply({ content: 'You need **Send Messages** permission to use this command!', ephemeral: true });
      return;
    }

    const card = await Card.findOne({ cardId });
    if (!card) {
      await interaction.reply({ content: `❌ Card with ID \`${cardId}\` not found!`, ephemeral: true });
      return;
    }

    const owner = await User.findOne({ userId: user.id, cards: cardId });
    if (!owner) {
      await interaction.reply({ content: `❌ You do not own the card with ID \`${cardId}\`!`, ephemeral: true });
      return;
    }

    // Khởi tạo nếu chưa có
    if (typeof card.locked !== 'boolean') {
      card.locked = false;
    }

    // Toggle trạng thái
    card.locked = !card.locked;
    await card.save();

    const statusText = card.locked ? '🔒 Locked' : '🔓 Unlocked';

    const embed = new EmbedBuilder()
      .setTitle('Card Lock Toggled')
      .setDescription(`Card \`${card.cardId}\` is now **${statusText}**.`)
      .setColor(card.locked ? '#FF5733' : '#2ECC71');

    await interaction.reply({ embeds: [embed], ephemeral: true });
  }
};
