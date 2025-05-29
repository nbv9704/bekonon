const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { User, Card } = require('../models');
const { drawDuelCanvas } = require('../utils/canvas');
const path = require('path');

const duelStates = new Map();

const ASSETS_PATH = path.join(__dirname, '..', 'assets');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('duel')
    .setDescription('Challenge another player to a duel')
    .addUserOption(option =>
      option.setName('user')
        .setDescription('User to challenge')
        .setRequired(true)
    ),

  duelStates,

  async execute(interaction) {
    const challenger = interaction.user;
    const target = interaction.options.getUser('user');

    if (target.id === challenger.id) {
      return interaction.reply({ content: 'You cannot duel yourself!', ephemeral: true });
    }

    const duelState = {
      challenger: challenger.id,
      opponent: target.id,
      challengerCard: null,
      opponentCard: null,
      challengerReady: false,
      opponentReady: false,
      battleMessage: null,
      messageCollector: null, // Thêm để lưu messageCollector
    };

    const getDuelEmbed = () => {
      const getCardLine = (card) => {
        return card
          ? `✅ ${card.cardId} | ${card.rarity} | Lvl ${card.level} | ${card.character}`
          : '❌ None';
      };

      return new EmbedBuilder()
        .setTitle(`Duel: ${challenger.username} vs ${target.username}`)
        .setDescription(
          `👤 *${challenger.username}*\nStatus: ${duelState.challengerReady ? '✅ Ready' : '❌ Not Ready'}\nCard: ${getCardLine(duelState.challengerCard)}\n\n` +
          `👤 *${target.username}*\nStatus: ${duelState.opponentReady ? '✅ Ready' : '❌ Not Ready'}\nCard: ${getCardLine(duelState.opponentCard)}\n`
        )
        .setColor('#3498db');
    };

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('duel_cancel').setLabel('❌ Cancel').setStyle(ButtonStyle.Danger),
      new ButtonBuilder().setCustomId('duel_lock').setLabel('✅ Lock').setStyle(ButtonStyle.Success)
    );

    await interaction.reply({ content: 'Duel initiated!', ephemeral: true });
    const duelMessage = await interaction.channel.send({ embeds: [getDuelEmbed()], components: [row] });
    duelStates.set(duelMessage.id, duelState);

    console.log(`Duel started between ${challenger.tag} and ${target.tag}, duelMessageId: ${duelMessage.id}`);

    const messageCollector = interaction.channel.createMessageCollector({
      filter: m => [challenger.id, target.id].includes(m.author.id),
      time: 120000
    });
    duelState.messageCollector = messageCollector; // Lưu messageCollector vào duelState

    messageCollector.on('collect', async m => {
      console.log(`Collected message from ${m.author.tag}: ${m.content}`);

      const cardId = m.content.trim();
      const card = await Card.findOne({ cardId });
      const owner = await User.findOne({ userId: m.author.id });

      if (!card || !owner || !owner.cards.includes(cardId)) {
        await m.reply({ content: 'Invalid card or you do not own this card.', ephemeral: true });
        console.log(`Invalid card selection by ${m.author.tag}: ${cardId}`);
        return;
      }

      if (card.locked) {
        await m.reply({ content: 'This card is locked and cannot be used in duel.', ephemeral: true });
        console.log(`Locked card selection by ${m.author.tag}: ${cardId}`);
        return;
      }

      if (m.author.id === challenger.id) {
        duelState.challengerCard = card;
        duelState.challengerReady = false;
        console.log(`Challenger ${m.author.tag} selected card ${cardId}`);
      } else {
        duelState.opponentCard = card;
        duelState.opponentReady = false;
        console.log(`Opponent ${m.author.tag} selected card ${cardId}`);
      }

      await duelMessage.edit({ embeds: [getDuelEmbed()] });
      await m.delete().catch(() => {});
    });
  },

  async handleButton(interaction) {
    const messageId = interaction.message.id;
    const duelState = duelStates.get(messageId);
    if (!duelState) {
      await interaction.reply({ content: 'Duel state not found!', ephemeral: true });
      console.log(`No duelState found for messageId: ${messageId}`);
      return;
    }

    console.log(`Button pressed: ${interaction.customId} by ${interaction.user.tag}`);

    const { challenger, opponent } = duelState;

    if (interaction.customId === 'duel_cancel') {
      if (duelState.messageCollector) {
        duelState.messageCollector.stop();
      }
      duelStates.delete(messageId);
      await interaction.update({
        embeds: [new EmbedBuilder().setTitle('Duel cancelled.').setColor('#ff0000')],
        components: []
      });
      console.log(`Duel cancelled for messageId: ${messageId}`);
      return;
    }

    if (interaction.customId === 'duel_lock') {
      const isChallenger = interaction.user.id === challenger;
      const selectedCard = isChallenger ? duelState.challengerCard : duelState.opponentCard;

      if (!selectedCard) {
        await interaction.reply({ content: 'You need to select a card first!', ephemeral: true });
        console.log(`User ${interaction.user.tag} tried to lock without selecting card`);
        return;
      }

      if (isChallenger) duelState.challengerReady = true;
      else duelState.opponentReady = true;

      console.log(`User ${interaction.user.tag} locked card. challengerReady=${duelState.challengerReady}, opponentReady=${duelState.opponentReady}`);

      const updatedEmbed = new EmbedBuilder()
        .setTitle(`Duel: ${interaction.client.users.cache.get(challenger).username} vs ${interaction.client.users.cache.get(opponent).username}`)
        .setDescription(
          `👤 *${interaction.client.users.cache.get(challenger).username}*\nStatus: ${duelState.challengerReady ? '✅ Ready' : '❌ Not Ready'}\nCard: ${duelState.challengerCard ? `✅ ${duelState.challengerCard.cardId} | ${duelState.challengerCard.rarity} | Lvl ${duelState.challengerCard.level} | ${duelState.challengerCard.character}` : '❌ None'}\n\n` +
          `👤 *${interaction.client.users.cache.get(opponent).username}*\nStatus: ${duelState.opponentReady ? '✅ Ready' : '❌ Not Ready'}\nCard: ${duelState.opponentCard ? `✅ ${duelState.opponentCard.cardId} | ${duelState.opponentCard.rarity} | Lvl ${duelState.opponentCard.level} | ${duelState.opponentCard.character}` : '❌ None'}\n`
        )
        .setColor('#3498db');

      await interaction.update({ embeds: [updatedEmbed] });

      if (duelState.challengerReady && duelState.opponentReady) {
        // Dừng messageCollector từ duelState
        if (duelState.messageCollector) {
          duelState.messageCollector.stop();
          console.log(`MessageCollector stopped for duelMessageId: ${messageId}`);
        }

        // Xóa message embed chọn thẻ
        await interaction.deleteReply().catch(() => {});

        // Gửi message Both players ready...
        const readyMsg = await interaction.channel.send('Both players ready, starting duel...');

        console.log('Both players ready, starting duel!');

        // Xác định thứ tự đánh theo SPD
        let cardFirst, cardSecond;
        let userFirst, userSecond;

        if (duelState.challengerCard.stats.SPD > duelState.opponentCard.stats.SPD) {
          cardFirst = duelState.challengerCard;
          cardSecond = duelState.opponentCard;
          userFirst = interaction.client.users.cache.get(challenger);
          userSecond = interaction.client.users.cache.get(opponent);
        } else if (duelState.challengerCard.stats.SPD < duelState.opponentCard.stats.SPD) {
          cardFirst = duelState.opponentCard;
          cardSecond = duelState.challengerCard;
          userFirst = interaction.client.users.cache.get(opponent);
          userSecond = interaction.client.users.cache.get(challenger);
        } else {
          cardFirst = duelState.challengerCard;
          cardSecond = duelState.opponentCard;
          userFirst = interaction.client.users.cache.get(challenger);
          userSecond = interaction.client.users.cache.get(opponent);
        }

        let hpFirst = cardFirst.stats.HP;
        let hpSecond = cardSecond.stats.HP;

        let battleLog = [];

        const generateAndSend = async () => {
          const recentBattleLog = battleLog.slice(-5);
          const canvasBuffer = await drawDuelCanvas({
            leftImageURL: cardFirst === duelState.challengerCard ? cardFirst.imageUrl : cardSecond.imageUrl,
            rightImageURL: cardFirst === duelState.challengerCard ? cardSecond.imageUrl : cardFirst.imageUrl,
            leftHpPercent: (hpFirst / cardFirst.stats.HP) * 100,
            rightHpPercent: (hpSecond / cardSecond.stats.HP) * 100,
            leftName: userFirst.username,
            rightName: userSecond.username,
            leftAvatarURL: userFirst.displayAvatarURL({ extension: 'png' }),
            rightAvatarURL: userSecond.displayAvatarURL({ extension: 'png' }),
            assetsPath: ASSETS_PATH
          });

          const battleEmbed = new EmbedBuilder()
            .setTitle('⚔️ Duel Battle')
            .setDescription(recentBattleLog.length > 0 ? recentBattleLog.join('\n') : 'The battle begins!')
            .setColor('#1abc9c')
            .setImage('attachment://duel.png');

          if (!duelState.battleMessage) {
            duelState.battleMessage = await interaction.channel.send({
              embeds: [battleEmbed],
              files: [{ attachment: canvasBuffer, name: 'duel.png' }]
            });
            // Xóa message "Both players ready..."
            await readyMsg.delete().catch(() => {});
          } else {
            await duelState.battleMessage.edit({
              embeds: [battleEmbed],
              files: [{ attachment: canvasBuffer, name: 'duel.png' }]
            });
          }
        };

        await generateAndSend();

        while (hpFirst > 0 && hpSecond > 0) {
          let dmgToSecond = Math.max(cardFirst.stats.PATK - cardSecond.stats.PDEF / 2, 1);
          hpSecond -= dmgToSecond;
          battleLog.push(`${userFirst.username} attacks dealing **${dmgToSecond}** damage!`);
          await generateAndSend();
          if (hpSecond <= 0) break;

          let dmgToFirst = Math.max(cardSecond.stats.PATK - cardFirst.stats.PDEF / 2, 1);
          hpFirst -= dmgToFirst;
          battleLog.push(`${userSecond.username} attacks dealing **${dmgToFirst}** damage!`);
          await generateAndSend();
          if (hpFirst <= 0) break;
        }

        let resultText;
        if (hpFirst > 0) resultText = `Result: ${userFirst.username} wins! 🏆`;
        else if (hpSecond > 0) resultText = `Result: ${userSecond.username} wins! 🏆`;
        else resultText = `Result: It's a draw!`;

        const finalEmbed = new EmbedBuilder()
          .setTitle('🏁 Duel Finished')
          .setDescription(resultText) // Chỉ hiển thị kết quả
          .setColor('#f39c12');

        await duelState.battleMessage.edit({ embeds: [finalEmbed], files: [] });

        duelStates.delete(messageId);
      }
    }
  }
};