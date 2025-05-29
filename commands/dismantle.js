const { SlashCommandBuilder, EmbedBuilder, PermissionsBitField, ButtonBuilder, ButtonStyle, ActionRowBuilder } = require('discord.js');
const { User, Card } = require('../models');
const { getDismantleCoinReward } = require('../utils/helpers');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('dismantle')
    .setDescription('Dismantle one or more cards to receive rewards')
    .addStringOption(option =>
      option.setName('cardids')
        .setDescription('IDs of the cards to dismantle (space-separated, optional, uses last grabbed card if omitted)')
        .setRequired(false)
    ),

  async execute(interaction, collectionStates) {
    await interaction.deferReply();
    const { user, channel } = interaction;

    if (!interaction.member.permissionsIn(channel).has(PermissionsBitField.Flags.SendMessages)) {
      await interaction.editReply({ content: 'You need **Send Messages** permission to use this command!', ephemeral: true });
      return;
    }

    const cardIdsInput = interaction.options.getString('cardids');
    let player = await User.findOne({ userId: user.id });

    if (!player) {
      player = new User({ userId: user.id, cards: [], coins: 0, shards: {}, lastDaily: null, lastDrop: null, lastDropUser: null, lastGrab: null });
      await player.save();
    }

    let cardIds = [];
    if (cardIdsInput) {
      cardIds = cardIdsInput.trim().split(/\s+/);
    } else if (player.lastGrab) {
      cardIds = [player.lastGrab];
    } else {
      await interaction.editReply({ content: 'No cards to dismantle! Use /grab or specify card IDs.', ephemeral: true });
      return;
    }

    if (cardIds.length === 0) {
      await interaction.editReply({ content: 'Please provide at least one card ID!', ephemeral: true });
      return;
    }

    const cardsToDismantle = [];
    const coinRewards = [];
    const shardRewards = {};

    for (const cardId of cardIds) {
      const card = await Card.findOne({ cardId });
      if (!card) {
        await interaction.editReply({ content: `Card with ID \`${cardId}\` not found!`, ephemeral: true });
        return;
      }

      if (!player.cards.includes(cardId)) {
        await interaction.editReply({ content: `You do not own the card with ID \`${cardId}\`!`, ephemeral: true });
        return;
      }
      if (card.locked) {
      await interaction.editReply({ content: `Card \`${cardId}\` is locked and cannot be dismantled.`, ephemeral: true });
      return;
    }

      const reward = getDismantleCoinReward(card.rarity);
      coinRewards.push({ cardId, reward });

      const shardKey = `${card.rarity} Shard`;
      shardRewards[shardKey] = (shardRewards[shardKey] || 0) + 1;

      cardsToDismantle.push({ cardId, card });
    }

    const totalCoinReward = coinRewards.reduce((sum, { reward }) => sum + reward, 0);
    const shardDisplay = Object.entries(shardRewards)
      .map(([shard, count]) => `🔹 **${count}** ${shard}`)
      .join('\n');

    const confirmEmbed = new EmbedBuilder()
      .setTitle('Dismantle Cards')
      .setDescription(
        `${interaction.user}, you will dismantle the following cards:\n` +
        `\`${cardIds.join('`, `')}\`\n\n` +
        `You will receive:\n` +
        `🪙 **${totalCoinReward}**\n` +
        `${shardDisplay}`
      )
      .setColor('#2C2F33');

    const cancelButton = new ButtonBuilder()
      .setCustomId('cancel_dismantle')
      .setLabel('❌')
      .setStyle(ButtonStyle.Secondary);

    const dismantleButton = new ButtonBuilder()
      .setCustomId('confirm_dismantle')
      .setEmoji('🗑️')
      .setStyle(ButtonStyle.Primary);

    const row = new ActionRowBuilder().addComponents(cancelButton, dismantleButton);

    const message = await interaction.editReply({
      embeds: [confirmEmbed],
      components: [row],
      fetchReply: true
    });

    collectionStates.set(message.id, {
      commandName: 'dismantle',
      cardIds,
      userId: user.id,
      player,
      cards: cardsToDismantle,
      totalCoinReward,
      shardRewards,
    });
  },

  async handleButton(interaction, collectionStates) {
    const state = collectionStates.get(interaction.message.id);
    if (!state) {
      await interaction.reply({ content: 'List state not found!', ephemeral: true });
      return;
    }

    const { cardIds, userId, player, cards, totalCoinReward, shardRewards } = state;
    if (interaction.user.id !== userId) {
      await interaction.reply({ content: 'This is not your dismantle request!', ephemeral: true });
      return;
    }

    if (interaction.customId === 'cancel_dismantle') {
      const cancelEmbed = new EmbedBuilder()
        .setTitle('Card Dismantle Cancelled!')
        .setDescription('You have cancelled the dismantle process.')
        .setColor('#FFC107');
      await interaction.update({
        content: '',
        embeds: [cancelEmbed],
        components: []
      });
      collectionStates.delete(interaction.message.id);
      return;
    }

    if (interaction.customId === 'confirm_dismantle') {
      player.coins += totalCoinReward;
      if (!player.shards) player.shards = new Map();

      for (const [shardKey, count] of Object.entries(shardRewards)) {
        player.shards.set(shardKey, (player.shards.get(shardKey) || 0) + count);
      }

      player.markModified('shards');

      for (const { cardId, card } of cards) {
        player.cards = player.cards.filter(id => id !== cardId);
        await card.deleteOne();
      }

      await player.save();

      const shardDisplay = Object.entries(shardRewards)
        .map(([shard, count]) => `🔹 **${count}** ${shard}`)
        .join('\n');

      const resultEmbed = new EmbedBuilder()
        .setTitle('Cards Dismantled!')
        .setDescription(
          `You have dismantled the following cards:\n` +
          `\`${cardIds.join('`, `')}\`\n\n` +
          `You received:\n` +
          `🪙 **${totalCoinReward}**\n` +
          `${shardDisplay}`
        )
        .setColor('#5CB85C');

      await interaction.update({
        embeds: [resultEmbed],
        components: []
      });

      collectionStates.delete(interaction.message.id);
    }
  }
};
