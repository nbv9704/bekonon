const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, PermissionsBitField, MessageFlags } = require('discord.js');
const { User, Card, Character } = require('../models');
const { getCooldownRemaining, getRandomRarity, generateCardId } = require('../utils/helpers');
const CardCounter = require('../models/CardCounter');

// Hàm trả về mã màu dựa trên rarity
function getEmbedColorByRarity(rarity) {
  switch (rarity) {
    case '◈C': return '#ffffff';
    case '◈R': return '#0804fc';
    case '◈E': return '#880484';
    case '◈L': return '#ff0404';
    default: return '#cccccc';
  }
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('drop')
    .setDescription('Drop a random card'),

  async execute(interaction, collectionStates) {
    const { user, channel, client } = interaction;

    if (!interaction.member.permissionsIn(channel).has(PermissionsBitField.Flags.SendMessages)) {
      await interaction.reply({ content: 'You need **Send Messages** permission to use this command!', flags: MessageFlags.Ephemeral });
      return;
    }

    let player = await User.findOne({ userId: user.id });
    if (!player) {
      player = new User({ userId: user.id, cards: [], coins: 0, lastDaily: null, lastDrop: null, lastDropUser: null, lastGrab: null });
      await player.save();
    }

    const hasBanMembers = interaction.member.permissionsIn(channel).has(PermissionsBitField.Flags.BanMembers);
    const dropCooldown = 3600; // 60 minutes
    const cooldownRemaining = getCooldownRemaining(player.lastDrop, dropCooldown);

    // Format time for display (minutes if ≥ 60 seconds, seconds if < 60 seconds)
    const formatTime = (seconds) => {
      if (seconds <= 0) return '0 seconds';
      if (seconds < 60) return `${seconds} second${seconds !== 1 ? 's' : ''}`;
      const minutes = Math.floor(seconds / 60);
      return `${minutes} minute${minutes > 1 ? 's' : ''}`;
    };

    if (!hasBanMembers && cooldownRemaining > 0) {
      await interaction.reply({ content: `You need to wait \`${formatTime(cooldownRemaining)}\` to drop again!`, flags: MessageFlags.Ephemeral });
      return;
    }

    await interaction.deferReply();

    const selectedRarity = getRandomRarity();
    const characters = await Character.find({ rarity: selectedRarity });
    if (characters.length === 0) {
      await interaction.editReply({ content: `No characters available with rarity ${selectedRarity}!` });
      return;
    }

    const character = characters[Math.floor(Math.random() * characters.length)];
    const newCardId = await generateCardId();

    let counter = await CardCounter.findOne({ character: character.name, rarity: selectedRarity });
    if (!counter) {
      counter = new CardCounter({ character: character.name, rarity: selectedRarity, lastNumber: 1 });
    } else {
      counter.lastNumber += 1;
    }
    await counter.save();

    const card = new Card({
      cardId: newCardId,
      character: character.name,
      rarity: selectedRarity,
      origin: character.origin,
      element: character.element,
      imageUrl: character.imageUrl,
      number: counter.lastNumber,
      level: 1,
      stats: character.stats || {}
    });
    await card.save();

    const expireTimestamp = Date.now() + 60000;
    const expiryDate = new Date(expireTimestamp);
    const expiryFormatted = expiryDate.toLocaleString('en-US', {
      month: 'short', day: 'numeric', year: 'numeric',
      hour: 'numeric', minute: 'numeric', second: 'numeric', hour12: true
    });

    const embed = new EmbedBuilder()
      .setAuthor({ name: user.username, iconURL: user.displayAvatarURL({ dynamic: true }) })
      .setThumbnail(client.user.displayAvatarURL({ dynamic: true }))
      .setTitle('Huh?')
      .setDescription(
        `*A wild **${card.character}** appears!*\n\n` +
        `Series: **${card.origin}**\n` +
        `Element: **${card.element}**\n\n` +
        `Time Remaining: \`60 seconds\` **[${expiryFormatted}]**`
      )
      .setColor(getEmbedColorByRarity(card.rarity))
      .setImage(character.imageUrl);

    const message = await interaction.editReply({
      embeds: [embed],
      components: [
        new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setCustomId(`grab_${newCardId}_${user.id}_${expireTimestamp}`)
            .setLabel('Grab')
            .setStyle(ButtonStyle.Primary)
        )
      ]
    });

    player.lastDrop = Date.now();
    player.lastDropUser = { cardId: newCardId, expiry: expireTimestamp };
    await player.save();

    const intervalId = setInterval(async () => {
      const timeLeft = Math.max(0, Math.floor((expireTimestamp - Date.now()) / 1000));
      if (timeLeft <= 0) {
        clearInterval(intervalId);

        const expiredEmbed = EmbedBuilder.from(embed).setDescription(
          `*A wild **${card.character}** appears!*\n\n` +
          `Series: **${card.origin}**\n` +
          `Element: **${card.element}**\n\n` +
          `Time Remaining: \`0 seconds (Expired)\` **[${expiryFormatted}]**`
        );

        await message.edit({
          embeds: [expiredEmbed],
          components: [
            new ActionRowBuilder().addComponents(
              new ButtonBuilder()
                .setCustomId(`grab_${newCardId}_${user.id}_${expireTimestamp}`)
                .setStyle(ButtonStyle.Primary)
                .setDisabled(true)
                .setEmoji('❌')
            )
          ]
        });
        return;
      }

      const updatedEmbed = EmbedBuilder.from(embed).setDescription(
        `*A wild **${card.character}** appears!*\n\n` +
        `Series: **${card.origin}**\n` +
        `Element: **${card.element}**\n\n` +
        `Time Remaining: \`${timeLeft} seconds\` **[${expiryFormatted}]**`
      );

      await message.edit({ embeds: [updatedEmbed] });
    }, 1000);

    collectionStates.set(message.id, { intervalId, expireTimestamp });

    if (!hasBanMembers) {
      setTimeout(async () => {
        try {
          const dmChannel = await user.createDM();
          await dmChannel.send('⏰ You can drop again!');
        } catch (error) {
          console.error(`Failed to send DM to player ${user.id}:`, error);
          await interaction.followUp({
            content: `Unable to send DM to <@${user.id}>. Check your DM settings!`,
            flags: MessageFlags.Ephemeral
          });
        }
      }, dropCooldown * 1000);
    }
  },
};