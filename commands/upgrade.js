const { SlashCommandBuilder, EmbedBuilder, PermissionsBitField, ButtonBuilder, ButtonStyle, ActionRowBuilder } = require('discord.js');
const { User, Card } = require('../models');

const maxLevelByRarity = {
  '◈C': 20,
  '◈R': 40,
  '◈E': 60,
  '◈L': 80,
};

function getLevelCost(level) {
  if (level <= 20) return 100;
  if (level <= 40) return 125;
  if (level <= 60) return 150;
  return 200;
}

function calculateTotalCost(currentLevel, increment, maxLevel) {
  let totalCost = 0;
  for (let i = 1; i <= increment; i++) {
    const newLevel = currentLevel + i;
    if (newLevel > maxLevel) break;
    totalCost += getLevelCost(newLevel);
  }
  return totalCost;
}

function getStatIncrease(level) {
  if (level <= 20) return [0.1, 0.2, 0.3];
  if (level <= 40) return [0.4, 0.5, 0.6];
  if (level <= 60) return [0.7, 0.8, 0.9];
  return [1.0, 1.1, 1.2, 1.3];
}

function getLevelEmoji(num) {
  const map = ['0️⃣', '1️⃣', '2️⃣', '3️⃣', '4️⃣', '5️⃣', '6️⃣', '7️⃣', '8️⃣', '9️⃣'];
  return [...String(num)].map(d => map[parseInt(d)]).join('');
}

function applyStatIncrease(card, times) {
  const stats = card.stats || {};
  const statKeys = ['HP', 'PATK', 'PDEF', 'MATK', 'MDEF', 'SPD'];
  const changeLog = {};
  const percentTrack = card.statsPercent || {};

  for (let i = 0; i < times; i++) {
    const levelForThis = card.level + i;
    const range = getStatIncrease(levelForThis);
    const stat = statKeys[Math.floor(Math.random() * statKeys.length)];
    const increasePercent = range[Math.floor(Math.random() * range.length)];

    if (!stats[stat]) stats[stat] = 0;
    if (!percentTrack[stat]) percentTrack[stat] = 0;

    const increaseValue = parseFloat(((stats[stat] * increasePercent) / 100).toFixed(2));
    stats[stat] = parseFloat((stats[stat] + increaseValue).toFixed(2));
    percentTrack[stat] = parseFloat((percentTrack[stat] + increasePercent).toFixed(2));

    if (!changeLog[stat]) changeLog[stat] = { total: 0, details: [] };
    changeLog[stat].total += increasePercent;
    changeLog[stat].details.push({ value: increasePercent, level: i + 1 });
  }

  card.stats = stats;
  card.statsPercent = percentTrack;
  return changeLog;
}

function formatStatChangeLog(changeLog) {
  let result = '';
  for (const [stat, info] of Object.entries(changeLog)) {
    const total = info.total.toFixed(1);
    if (info.details.length === 1) {
      const only = info.details[0];
      result += `\`${stat}\` increased by **${only.value.toFixed(1)}%** ${getLevelEmoji(only.level)}\n`;
    } else {
      const detailStr = info.details.map(d => `${d.value.toFixed(1)} ${getLevelEmoji(d.level)}`).join(' | ');
      result += `\`${stat}\` increased by **${total}%** · ${detailStr}\n`;
    }
  }
  return result;
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('upgrade')
    .setDescription('Upgrade a card\'s level')
    .addStringOption(option =>
      option.setName('cardid')
        .setDescription('ID of the card to upgrade')
        .setRequired(true)
    ),

  async execute(interaction, collectionStates) {
    await interaction.deferReply();

    const { channel, user } = interaction;
    const cardId = interaction.options.getString('cardid');

    if (!interaction.member.permissionsIn(channel).has(PermissionsBitField.Flags.SendMessages)) {
      await interaction.editReply({ content: 'You need **Send Messages** permission to use this command!', ephemeral: true });
      return;
    }

    const card = await Card.findOne({ cardId });
    if (!card) {
      await interaction.editReply({ content: `Card with ID \`${cardId}\` not found!`, ephemeral: true });
      return;
    }

    const player = await User.findOne({ userId: user.id, cards: cardId });
    if (!player) {
      await interaction.editReply({ content: `You do not own the card with ID \`${cardId}\`!`, ephemeral: true });
      return;
    }

    const rarity = card.rarity;
    const maxLevel = maxLevelByRarity[rarity] || 50;

    if (card.level >= maxLevel) {
      await interaction.editReply({ content: `Card \`${cardId}\` has already reached the maximum level!`, ephemeral: true });
      return;
    }

    const currentLevel = card.level || 1;
    const cost1 = calculateTotalCost(currentLevel, 1, maxLevel);
    const cost5 = calculateTotalCost(currentLevel, 5, maxLevel);

    const confirmEmbed = new EmbedBuilder()
      .setTitle('Card Upgrade')
      .setDescription(
        `${interaction.user}, upgrading the level of \`${cardId}\` from \`${currentLevel}\`.\n\n` +
        `Costs:\n- **${cost1}** coins to upgrade 1 level\n- **${cost5}** coins to upgrade 5 levels (or up to max level)\n\n` +
        'Use the 🔨 button to upgrade 1 level or ⚒️ button to upgrade 5 levels.'
      )
      .setColor('#2C2F33');

    const row = new ActionRowBuilder()
      .addComponents(
        new ButtonBuilder().setCustomId('cancel_upgrade').setLabel('❌').setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId('confirm_upgrade_1').setLabel('🔨').setStyle(ButtonStyle.Primary),
        new ButtonBuilder().setCustomId('confirm_upgrade_5').setLabel('⚒️').setStyle(ButtonStyle.Primary)
      );

    const message = await interaction.editReply({
      embeds: [confirmEmbed],
      components: [row],
      fetchReply: true
    });

    collectionStates.set(message.id, {
      commandName: 'upgrade',
      cardId,
      userId: user.id,
      player,
      card
    });
  },

  async handleButton(interaction, collectionStates) {
    const state = collectionStates.get(interaction.message.id);
    if (!state) {
      console.log(`Upgrade state not found for messageId: ${interaction.message.id}`);
      await interaction.reply({ content: 'Upgrade state not found!', ephemeral: true });
      return;
    }

    const { cardId, userId } = state;
    let { player, card } = state;

    if (interaction.user.id !== userId) {
      console.log(`User ${interaction.user.tag} tried to access upgrade request of userId ${userId}`);
      await interaction.reply({ content: 'This is not your upgrade request!', ephemeral: true });
      return;
    }

    console.log(`Button pressed in upgrade: ${interaction.customId} by ${interaction.user.tag}`);

    const rarity = card.rarity;
    const maxLevel = maxLevelByRarity[rarity] || 50;
    let currentLevel = card.level || 1;

    if (interaction.customId === 'cancel_upgrade') {
      const cancelEmbed = new EmbedBuilder()
        .setTitle('Card Upgrade Cancelled!')
        .setDescription('You have cancelled the upgrade process.')
        .setColor('#FFC107');

      await interaction.update({ content: '', embeds: [cancelEmbed], components: [] });
      collectionStates.delete(interaction.message.id);
      return;
    }

    // Xử lý "continue_upgrade" trước để tránh nhầm với "confirm_upgrade"
    if (interaction.customId === 'continue_upgrade') {
      // Cập nhật lại card và player từ database để lấy level mới nhất
      card = await Card.findOne({ cardId });
      player = await User.findOne({ userId: userId, cards: cardId });
      if (!card || !player) {
        console.log(`Error: Card or player not found for cardId ${cardId}, userId ${userId} during continue_upgrade`);
        await interaction.update({
          content: 'Error: Card or user data not found!',
          embeds: [],
          components: []
        });
        collectionStates.delete(interaction.message.id);
        return;
      }
      currentLevel = card.level || 1;
      const cost1 = calculateTotalCost(currentLevel, 1, maxLevel);
      const cost5 = calculateTotalCost(currentLevel, 5, maxLevel);
      const confirmEmbed = new EmbedBuilder()
        .setTitle('Card Upgrade')
        .setDescription(
          `${interaction.user}, upgrading the level of \`${cardId}\` from \`${currentLevel}\`.\n\n` +
          `Costs:\n- **${cost1}** coins to upgrade 1 level\n- **${cost5}** coins to upgrade 5 levels (or up to max level)\n\n` +
          'Use the 🔨 button to upgrade 1 level or ⚒️ button to upgrade 5 levels.'
        )
        .setColor('#2C2F33');
      const row = new ActionRowBuilder()
        .addComponents(
          new ButtonBuilder().setCustomId('cancel_upgrade').setLabel('❌').setStyle(ButtonStyle.Secondary),
          new ButtonBuilder().setCustomId('confirm_upgrade_1').setLabel('🔨').setStyle(ButtonStyle.Primary),
          new ButtonBuilder().setCustomId('confirm_upgrade_5').setLabel('⚒️').setStyle(ButtonStyle.Primary)
        );
      await interaction.update({
        content: '',
        embeds: [confirmEmbed],
        components: [row]
      });
      // Cập nhật lại state với dữ liệu mới
      collectionStates.set(interaction.message.id, { commandName: 'upgrade', cardId, userId, player, card });
      console.log(`Successfully reloaded upgrade interface for cardId ${cardId}, level ${currentLevel}`);
      return; // Kết thúc xử lý tại đây nếu là "continue_upgrade"
    }

    if (interaction.customId.startsWith('confirm_upgrade')) {
      let levelsToUpgrade = interaction.customId === 'confirm_upgrade_1' ? 1 : 5;

      let actualUpgrade = levelsToUpgrade;
      if (currentLevel + actualUpgrade > maxLevel) {
        actualUpgrade = maxLevel - currentLevel;
      }

      if (actualUpgrade <= 0) {
        await interaction.update({
          content: `Card \`${cardId}\` has already reached the maximum level!`,
          embeds: [],
          components: []
        });
        collectionStates.delete(interaction.message.id);
        return;
      }

      const totalCost = calculateTotalCost(currentLevel, actualUpgrade, maxLevel);
      if (player.coins < totalCost) {
        await interaction.update({
          content: `You do not have enough coins! Required: ${totalCost}, You have: ${player.coins}`,
          embeds: [],
          components: []
        });
        collectionStates.delete(interaction.message.id);
        return;
      }

      player.coins -= totalCost;
      const statChanges = applyStatIncrease(card, actualUpgrade);
      card.level = currentLevel + actualUpgrade;
      await card.save();
      await player.save();

      const statsDesc = formatStatChangeLog(statChanges);

      const successEmbed = new EmbedBuilder()
        .setTitle('Card Upgrade Succeeded!')
        .setDescription(`Your card \`${cardId}\` is now level \`${card.level}\`.\n\n${statsDesc}`)
        .setColor('#5CB85C');

      const row = new ActionRowBuilder();
      if (card.level < maxLevel) {
        row.addComponents(
          new ButtonBuilder().setCustomId('continue_upgrade').setLabel('🔨 Continue Upgrading').setStyle(ButtonStyle.Primary)
        );
      }

      await interaction.update({
        content: `You now have **${player.coins}** 🪙.`,
        embeds: [successEmbed],
        components: row.components.length ? [row] : []
      });

      if (card.level < maxLevel) {
        setTimeout(() => {
          interaction.message.edit({ components: [] }).catch(() => {});
          collectionStates.delete(interaction.message.id);
        }, 30_000);

        collectionStates.set(interaction.message.id, { commandName: 'upgrade', cardId, userId, player, card });
      } else {
        collectionStates.delete(interaction.message.id);
      }

      return;
    }

    console.log(`Unknown button action in upgrade: ${interaction.customId}`);
    await interaction.reply({ content: 'Unknown button action!', ephemeral: true });
  }
};