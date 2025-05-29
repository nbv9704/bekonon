const { SlashCommandBuilder, EmbedBuilder, PermissionsBitField } = require('discord.js');
const { User, Card, Character } = require('../models');
const { getElementIcon } = require('../utils/helpers');

function getRarityColor(rarity) {
  switch (rarity) {
    case '◈C': return '#ffffff';
    case '◈R': return '#0804fc';
    case '◈E': return '#880484';
    case '◈L': return '#ff0404';
    default: return '#00ff00';
  }
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('view')
    .setDescription('View detailed information about a card')
    .addStringOption(option =>
      option.setName('cardid')
        .setDescription('The card ID to view')
        .setRequired(true)
    ),

  async execute(interaction) {
    const { user, channel } = interaction;
    const cardId = interaction.options.getString('cardid');

    if (!interaction.member.permissionsIn(channel).has(PermissionsBitField.Flags.SendMessages)) {
      await interaction.reply({ content: 'You need **Send Messages** permission to use this command!', ephemeral: true });
      return;
    }

    const card = await Card.findOne({ cardId });
    if (!card) {
      await interaction.reply({ content: `Card with ID \`${cardId}\` not found!`, ephemeral: true });
      return;
    }

    const owner = await User.findOne({ cards: cardId });
    if (!owner) {
      await interaction.reply({ content: `Owner of the card with ID \`${cardId}\` not found!`, ephemeral: true });
      return;
    }

    const embedColor = getRarityColor(card.rarity);
    const elementIcon = getElementIcon(card.element);
    const elementDisplay = `${card.element || 'Unknown'} ${elementIcon}`;

    const stats = card.stats || {};
    const statsPercent = card.statsPercent || {};
    const formatStat = (key, label, emoji) => {
      const value = stats[key] ?? 0;
      const percent = statsPercent[key] ?? 0;
      return `${emoji} ${label}: \`${value}${percent > 0 ? ` (+${percent.toFixed(1)}%)` : ''}\``;
    };

    const statsText = [
      formatStat('HP', 'HP', '❤️'),
      formatStat('PATK', 'PATK', '🗡️'),
      formatStat('PDEF', 'PDEF', '🛡️'),
      formatStat('MATK', 'MATK', '✨'),
      formatStat('MDEF', 'MDEF', '🔰'),
      formatStat('SPD', 'SPD', '💨')
    ].join('\n');

    const embed = new EmbedBuilder()
      .setTitle(`${card.locked ? '🔒 ' : ''}${card.character}`)
      .setDescription(
        `**ID:** \`${card.cardId}\`\n` +
        `**Element:** \`${elementDisplay}\`\n` +
        `**Level:** \`${card.level}\`\n` +
        `**Rarity:** \`${card.rarity}\`\n` +
        `**Origin:** ${card.origin}\n` +
        `**Print Number:** \`#${card.number}\`\n\n` +
        `**Stats:**\n${statsText}`
      )
      .setColor(embedColor)
      .setImage(card.imageUrl);

    await interaction.reply({ embeds: [embed] });
  },
};
