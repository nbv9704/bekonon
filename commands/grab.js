const { ActionRowBuilder, ButtonBuilder, ButtonStyle, PermissionsBitField, MessageFlags } = require('discord.js');
const { User, Card } = require('../models');
const { getCooldownRemaining } = require('../utils/helpers');

module.exports = {
  async execute(interaction, collectionStates) {
    const [_, cardId, dropperUserId, expireTimestamp] = interaction.customId.split('_');
    const { user, channel, message } = interaction;
    const currentTime = Date.now();

    if (!interaction.member.permissionsIn(channel).has(PermissionsBitField.Flags.SendMessages)) {
      await interaction.reply({ content: 'You need **Send Messages** permission to use this command!', flags: MessageFlags.Ephemeral });
      return;
    }

    if (currentTime > parseInt(expireTimestamp)) {
      await interaction.reply({ content: 'This card has expired (1 minute)!', flags: MessageFlags.Ephemeral });
      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId(`grab_${cardId}_${dropperUserId}_${expireTimestamp}`)
          .setStyle(ButtonStyle.Primary)
          .setDisabled(true)
          .setEmoji('❌')
      );
      await message.edit({ components: [row] });
      return;
    }

    let player = await User.findOne({ userId: user.id });
    if (!player) {
      player = new User({ userId: user.id, cards: [], coins: 0, lastDaily: null, lastDrop: null, lastDropUser: null, lastGrab: null });
      await player.save();
    }

    const hasBanMembers = interaction.member.permissionsIn(channel).has(PermissionsBitField.Flags.BanMembers);
    const grabCooldown = 900; // 15 minutes
    const cooldownRemaining = getCooldownRemaining(player.lastGrab, grabCooldown);

    // Format time for display (minutes if ≥ 60 seconds, seconds if < 60 seconds)
    const formatTime = (seconds) => {
      if (seconds <= 0) return '0 seconds';
      if (seconds < 60) return `${seconds} second${seconds !== 1 ? 's' : ''}`;
      const minutes = Math.floor(seconds / 60);
      return `${minutes} minute${minutes > 1 ? 's' : ''}`;
    };

    if (!hasBanMembers && cooldownRemaining > 0) {
      await interaction.reply({ content: `You need to wait \`${formatTime(cooldownRemaining)}\` to grab again!`, flags: MessageFlags.Ephemeral });
      return;
    }

    // Lấy thẻ theo cardId hiện có
    const card = await Card.findOne({ cardId });
    if (!card) {
      await interaction.reply({ content: 'Card not found!', flags: MessageFlags.Ephemeral });
      return;
    }

    // Kiểm tra dropper lastDropUser
    const dropper = await User.findOne({ userId: dropperUserId });
    if (!dropper || !dropper.lastDropUser || dropper.lastDropUser.expiry < currentTime || dropper.lastDropUser.cardId !== cardId) {
      await interaction.reply({ content: 'An error occurred with this card!', flags: MessageFlags.Ephemeral });
      return;
    }

    const timeSinceDrop = (currentTime - dropper.lastDrop) / 1000;
    if (timeSinceDrop < 30 && user.id !== dropperUserId) {
      await interaction.reply({ content: `Only the dropper (<@${dropperUserId}>) can grab in the first 30 seconds! Time remaining: \`${Math.ceil(30 - timeSinceDrop)} seconds\``, flags: MessageFlags.Ephemeral });
      return;
    }

    // Nếu user đã có thẻ này rồi, thông báo lỗi
    if (player.cards.includes(cardId)) {
      await interaction.reply({ content: 'You already have this card!', flags: MessageFlags.Ephemeral });
      return;
    }

    // Thêm cardId vào mảng cards của user (không tạo thẻ mới)
    player.cards.push(cardId);
    player.lastGrab = Date.now();
    await player.save();

    // Xóa lastDropUser của dropper để không grab lại
    dropper.lastDropUser = null;
    await dropper.save();

    // Tạo nội dung thông báo theo rarity
    let messageContent;
    switch (card.rarity) {
      case '◈C':
        messageContent = `<@${user.id}> has grabbed **${card.character}** \`${cardId}\`! Too bad, just a lousy **Common**.`;
        break;
      case '◈R':
        messageContent = `<@${user.id}> has grabbed **${card.character}** \`${cardId}\`! Not bad, a decent **Rare**.`;
        break;
      case '◈E':
        messageContent = `<@${user.id}> has grabbed **${card.character}** \`${cardId}\`! Pretty impressive, an **Epic**!`;
        break;
      case '◈L':
        messageContent = `<@${user.id}> has grabbed **${card.character}** \`${cardId}\`! Wow, a **Legendary**!`;
        break;
      default:
        messageContent = `<@${user.id}> has grabbed **${card.character}** \`${cardId}\`!`;
    }

    await interaction.reply({ content: messageContent });

    // Disable button grab sau khi grab thành công
    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`grab_${cardId}_${dropperUserId}_${expireTimestamp}`)
        .setStyle(ButtonStyle.Primary)
        .setDisabled(true)
        .setEmoji('✅')
    );
    await message.edit({ components: [row] });

    // Clear interval nếu có
    const state = collectionStates.get(message.id);
    if (state && state.intervalId) {
      clearInterval(state.intervalId);
      collectionStates.delete(message.id);
    }

    // Gửi DM báo cooldown hết nếu không có quyền BanMembers
    if (!hasBanMembers) {
      setTimeout(async () => {
        try {
          const dmChannel = await user.createDM();
          await dmChannel.send('⏰ You can grab again!');
        } catch (error) {
          console.error(`Failed to send DM to player ${user.id} when grab cooldown resets:`, error);
        }
      }, grabCooldown * 1000);
    }
  },
};