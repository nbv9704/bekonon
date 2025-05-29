const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, PermissionsBitField } = require('discord.js');
const { User, Card } = require('../models');
const { SORT_MODES, SORT_MODE_LABELS, ITEMS_PER_PAGE } = require('../utils/constants');
const { sortCards, getElementIcon } = require('../utils/helpers');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('collection')
    .setDescription('View your or another user\'s card collection')
    .addUserOption(option =>
      option.setName('user')
        .setDescription('The user whose collection to view (optional, defaults to you)')
        .setRequired(false)
    ),
  async execute(interaction, collectionStates) {
    const { user, channel } = interaction;
    const targetUser = interaction.options.getUser('user') || user;

    if (!interaction.member.permissionsIn(channel).has(PermissionsBitField.Flags.SendMessages)) {
      await interaction.reply({ content: 'You need **Send Messages** permission to use this command!', ephemeral: true });
      return;
    }

    let player = await User.findOne({ userId: targetUser.id });
    if (!player) {
      player = new User({ userId: targetUser.id, cards: [], coins: 0, lastDaily: null, lastDrop: null, lastDropUser: null, lastGrab: null });
      await player.save();
    }

    const cards = await Card.find({ cardId: { $in: player.cards } });
    if (cards.length === 0) {
      const embed = new EmbedBuilder()
        .setTitle(`${targetUser.username}'s Collection`)
        .setDescription('No cards yet!')
        .setColor('#00ff00');
      await interaction.reply({ embeds: [embed] });
      return;
    }

    const totalPages = Math.ceil(cards.length / ITEMS_PER_PAGE);
    const initialState = {
      commandName: 'collection',
      currentPage: 1,
      totalPages,
      sortMode: SORT_MODES.DATE,
      cards,
      cardOrder: [...player.cards],
      targetUserId: targetUser.id,
    };

    const sortedCards = sortCards(cards, initialState.sortMode, initialState.cardOrder);
    const start = (initialState.currentPage - 1) * ITEMS_PER_PAGE;
    const end = start + ITEMS_PER_PAGE;
    const paginatedCards = sortedCards.slice(start, end);

    const embed = new EmbedBuilder()
      .setTitle(`${targetUser.username}'s Collection`)
      .setDescription(
        `**Sort By:** ${SORT_MODE_LABELS[initialState.sortMode]}\n` +
        `**Page:** ${initialState.currentPage}/${initialState.totalPages}\n` +
        `**Total Cards:** ${cards.length}\n\n` +
        paginatedCards.map(c => {
          const elementIcon = getElementIcon(c.element);
          const elementDisplay = `${elementIcon || 'Unknown'}`;
          const lockEmoji = c.locked ? '🔒 ' : '';
          return `\`#${c.number}\` · \`${c.cardId}\` · \`${elementDisplay}\` · \`Level: ${c.level}\` · \`${c.rarity}\` · ${c.origin} · **${c.character} ${c.locked ? '🔒 ' : ''}**`;
        }).join('\n')
      )
      .setColor('#00ff00');

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('rewind_5').setEmoji('\u23EA').setStyle(ButtonStyle.Secondary).setDisabled(initialState.currentPage <= 5),
      new ButtonBuilder().setCustomId('prev').setEmoji('\u25C0').setStyle(ButtonStyle.Secondary).setDisabled(initialState.currentPage === 1),
      new ButtonBuilder().setCustomId('sort').setEmoji('\uD83D\uDD01').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId('next').setEmoji('\u25B6').setStyle(ButtonStyle.Secondary).setDisabled(initialState.currentPage === initialState.totalPages),
      new ButtonBuilder().setCustomId('fast_forward_5').setEmoji('\u23E9').setStyle(ButtonStyle.Secondary).setDisabled(initialState.currentPage > initialState.totalPages - 5)
    );

    const message = await interaction.reply({ embeds: [embed], components: [row], fetchReply: true });
    collectionStates.set(message.id, initialState);
  },

  async handleButton(interaction, collectionStates) {
    const messageId = interaction.message.id;
    const state = collectionStates.get(messageId);
    if (!state) {
      await interaction.reply({ content: 'Collection state not found!', ephemeral: true });
      return;
    }

    // Kiểm tra xem state có phải từ collection không
    if (state.commandName !== 'collection') {
      await interaction.reply({ content: 'This button is not for collection navigation!', ephemeral: true });
      return;
    }

    let { currentPage, totalPages, sortMode, cards, cardOrder, targetUserId } = state;
    if (!cards || !Array.isArray(cards)) {
      await interaction.reply({ content: 'Invalid card data in collection state!', ephemeral: true });
      return;
    }

    const [action] = interaction.customId.split('_');

    if (action === 'rewind') currentPage = Math.max(1, currentPage - 5);
    else if (action === 'prev') currentPage = Math.max(1, currentPage - 1);
    else if (action === 'next') currentPage = Math.min(totalPages, currentPage + 1);
    else if (action === 'fast') currentPage = Math.min(totalPages, currentPage + 5);
    else if (action === 'sort') {
      sortMode = sortMode === SORT_MODES.DATE ? SORT_MODES.NAME : sortMode === SORT_MODES.NAME ? SORT_MODES.RARITY : sortMode === SORT_MODES.RARITY ? SORT_MODES.NUMBER : SORT_MODES.DATE;
    }

    state.currentPage = currentPage;
    state.sortMode = sortMode;
    collectionStates.set(messageId, state);

    const sortedCards = sortCards(cards, sortMode, cardOrder);
    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    const end = start + ITEMS_PER_PAGE;
    const paginatedCards = sortedCards.slice(start, end);

    const targetUser = await interaction.client.users.fetch(targetUserId);

    const embed = new EmbedBuilder()
      .setTitle(`${targetUser.username}'s Collection`)
      .setDescription(
        `**Sort By:** ${SORT_MODE_LABELS[sortMode]}\n` +
        `**Page:** ${currentPage}/${totalPages}\n` +
        `**Total Cards:** ${cards.length}\n\n` +
        paginatedCards.map(c => {
          const elementIcon = getElementIcon(c.element);
          const elementDisplay = `${elementIcon} ${c.element || 'Unknown'}`;
          const lockEmoji = c.locked ? '🔒 ' : '';
          return `\`#${c.number}\` · \`${c.cardId}\` · \`${elementDisplay}\` · \`Level: ${c.level}\` · \`${c.rarity}\` · ${c.origin} · **${lockEmoji}${c.character}**`;
        }).join('\n')
      )
      .setColor('#00ff00');

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('rewind_5').setEmoji('\u23EA').setStyle(ButtonStyle.Secondary).setDisabled(currentPage <= 5),
      new ButtonBuilder().setCustomId('prev').setEmoji('\u25C0').setStyle(ButtonStyle.Secondary).setDisabled(currentPage === 1),
      new ButtonBuilder().setCustomId('sort').setEmoji('\uD83D\uDD01').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId('next').setEmoji('\u25B6').setStyle(ButtonStyle.Secondary).setDisabled(currentPage === totalPages),
      new ButtonBuilder().setCustomId('fast_forward_5').setEmoji('\u23E9').setStyle(ButtonStyle.Secondary).setDisabled(currentPage > totalPages - 5)
    );

    await interaction.update({ embeds: [embed], components: [row] });
  },
};