const { SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } = require('discord.js');
const { User, Card } = require('../models');

const itemMapping = {
  coin: { itemName: 'Coin', itemID: 'coin', type: 'currency' },
  cshard: { itemName: '◈C Shard', itemID: 'cshard', shardKey: '◈C Shard' },
  rshard: { itemName: '◈R Shard', itemID: 'rshard', shardKey: '◈R Shard' },
  eshard: { itemName: '◈E Shard', itemID: 'eshard', shardKey: '◈E Shard' },
  lshard: { itemName: '◈L Shard', itemID: 'lshard', shardKey: '◈L Shard' }
};

module.exports = {
  data: new SlashCommandBuilder()
    .setName('trade')
    .setDescription('Trade cards, coins, or shards with another player')
    .addUserOption(option =>
      option.setName('user')
        .setDescription('The player to trade with')
        .setRequired(true)
    ),
  async execute(interaction, tradeStates) {
    const target = interaction.options.getUser('user');
    if (target.id === interaction.user.id) {
      return interaction.reply({ content: 'You cannot trade with yourself!', ephemeral: true });
    }

    let player1 = await User.findOne({ userId: interaction.user.id }) || new User({ userId: interaction.user.id });
    let player2 = await User.findOne({ userId: target.id }) || new User({ userId: target.id });
    if (!player1.id) await player1.save();
    if (!player2.id) await player2.save();

    const initialPlayer1 = { ...player1.toObject(), shards: new Map(player1.shards) };
    const initialPlayer2 = { ...player2.toObject(), shards: new Map(player2.shards) };

    const tradeState = {
      player1Id: interaction.user.id,
      player2Id: target.id,
      p1Items: { cards: [], coins: 0, shards: new Map() },
      p2Items: { cards: [], coins: 0, shards: new Map() },
      p1Locked: false,
      p2Locked: false,
      canceled: false,
      completed: false,
      startTime: Date.now(), // Thêm thời gian bắt đầu để tính timeout 3 phút
    };

    const getTradeEmbed = () => {
      const formatItems = (items) => {
        const list = [];
        if (items.cards.length) list.push(`${items.cards.length} Cards (${items.cards.join(', ')})`);
        if (items.coins > 0) list.push(`${items.coins} Coin${items.coins > 1 ? 's' : ''}`);
        for (const [shard, qty] of items.shards.entries()) {
          list.push(`${qty} ${shard}${qty > 1 ? 's' : ''}`);
        }
        return list.length ? list.join('\n') : 'No items added';
      };

      return new EmbedBuilder()
        .setTitle(`Trade between ${interaction.user.username} and ${target.username}`)
        .setDescription(`Enter \`"<amount> <itemID>" (e.g., "100 coin", "2 eshard")\` or a \`cardId (case-sensitive)\`. Separate with commas.`)
        .addFields(
          {
            name: interaction.user.username,
            value: `\`\`\`diff\n${tradeState.p1Locked ? '+ Status: Ready\n' : '- Status: Not Ready\n'}\n${formatItems(tradeState.p1Items)}\n\`\`\``,
            inline: true
          },
          {
            name: target.username,
            value: `\`\`\`diff\n${tradeState.p2Locked ? '+ Status: Ready\n' : '- Status: Not Ready\n'}\n${formatItems(tradeState.p2Items)}\n\`\`\``,
            inline: true
          }
        )
        .setColor('#00ff00')
        .setTimestamp();
    };

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId(`trade_cancel_${interaction.user.id}_${target.id}`).setLabel('Cancel').setStyle(ButtonStyle.Danger),
      new ButtonBuilder().setCustomId(`trade_lock_${interaction.user.id}_${target.id}`).setLabel('Lock').setStyle(ButtonStyle.Success)
    );

    await interaction.reply({ content: 'Trade started!', ephemeral: true });
    const tradeMessage = await interaction.channel.send({ embeds: [getTradeEmbed()], components: [row] });

    tradeStates.set(tradeMessage.id, tradeState);

    const filter = i => [interaction.user.id, target.id].includes(i.user.id);
    const collector = interaction.channel.createMessageComponentCollector({ filter });

    const messageCollector = interaction.channel.createMessageCollector({
      filter: m => [interaction.user.id, target.id].includes(m.author.id)
    });

    // Kiểm tra timeout sau 3 phút
    const timeoutCheck = setTimeout(async () => {
      if (!tradeState.completed && !tradeState.canceled && !tradeState.p1Locked && !tradeState.p2Locked) {
        await restoreState();
        const timeoutEmbed = new EmbedBuilder().setTitle('Trade timed out and was canceled').setColor('#ff0000');
        await tradeMessage.edit({ embeds: [timeoutEmbed], components: [] });
        messageCollector.stop();
        collector.stop();
        tradeStates.delete(tradeMessage.id);
      }
    }, 3 * 60 * 1000); // 3 phút

    collector.on('collect', async i => {
      await i.deferUpdate();

      const userId = i.user.id;
      if (![tradeState.player1Id, tradeState.player2Id].includes(userId)) {
        return;
      }

      if (tradeState.completed) return; // Ngăn xử lý nếu giao dịch đã hoàn tất

      if (i.customId.includes('cancel')) {
        tradeState.canceled = true;
        clearTimeout(timeoutCheck); // Xóa timeout khi hủy
        await restoreState();
        const canceledEmbed = new EmbedBuilder().setTitle('Trade canceled').setColor('#ff0000');
        await tradeMessage.edit({ embeds: [canceledEmbed], components: [] });
        messageCollector.stop();
        collector.stop();
        tradeStates.delete(tradeMessage.id);
      } else if (i.customId.includes('lock')) {
        if (userId === tradeState.player1Id) tradeState.p1Locked = true;
        else if (userId === tradeState.player2Id) tradeState.p2Locked = true;

        if (tradeState.p1Locked && tradeState.p2Locked) {
          tradeState.completed = true; // Đánh dấu giao dịch hoàn tất
          clearTimeout(timeoutCheck); // Xóa timeout khi hoàn tất
          await executeTrade(tradeState, player1, player2);
          const successEmbed = new EmbedBuilder().setTitle('Trade successful!').setColor('#00ff00');
          await tradeMessage.edit({ embeds: [successEmbed], components: [] });
          messageCollector.stop();
          collector.stop();
          tradeStates.delete(tradeMessage.id);
        } else {
          await tradeMessage.edit({ embeds: [getTradeEmbed()], components: [row] });
        }
      }
    });

    messageCollector.on('collect', async m => {
      if (tradeState.completed || tradeState.canceled) return; // Ngăn xử lý nếu giao dịch đã hoàn tất hoặc bị hủy

      const entries = m.content.split(',').map(e => e.trim()).filter(e => e);
      const items = m.author.id === interaction.user.id ? tradeState.p1Items : tradeState.p2Items;
      const user = m.author.id === interaction.user.id ? player1 : player2;

      for (const entry of entries) {
        const itemMatch = entry.match(/^(\d+)\s+([a-z0-9]+)$/i);
        if (itemMatch) {
          const amount = parseInt(itemMatch[1]);
          const id = itemMatch[2].toLowerCase();
          const item = itemMapping[id];

          if (!item || amount <= 0) {
            await m.channel.send(`Invalid item or amount: ${entry}`);
            continue;
          }

          if (item.type === 'currency') {
            if (user.coins < amount) {
              await m.channel.send(`Not enough coins! You have ${user.coins}, need ${amount}`);
              continue;
            }
            items.coins += amount;
            user.coins -= amount;
          } else if (item.shardKey) {
            const current = user.shards.get(item.shardKey) || 0;
            if (current < amount) {
              await m.channel.send(`Not enough ${item.itemName}! You have ${current}, need ${amount}`);
              continue;
            }
            items.shards.set(item.shardKey, (items.shards.get(item.shardKey) || 0) + amount);
            user.shards.set(item.shardKey, current - amount);
          }
        } else {
          const card = await Card.findOne({ cardId: entry });
          if (card && user.cards.includes(entry)) {
            if (card.locked) {
              await m.channel.send(`Card \`${entry}\` is locked and cannot be traded.`);
              continue;
            }
            items.cards.push(entry);
            user.cards = user.cards.filter(c => c !== entry);
          } else {
            await m.channel.send(`Invalid or unavailable card: ${entry}`);
          }
        }
      }

      await user.save();
      await tradeMessage.edit({ embeds: [getTradeEmbed()], components: [row] });
      await m.delete();
    });

    collector.on('end', async () => {
      if (!tradeState.canceled && !tradeState.completed) {
        await restoreState();
        const timeoutEmbed = new EmbedBuilder().setTitle('Trade timed out and was canceled').setColor('#ff0000');
        await tradeMessage.edit({ embeds: [timeoutEmbed], components: [] });
        messageCollector.stop();
        tradeStates.delete(tradeMessage.id);
      }
    });

    async function restoreState() {
      player1.set({
        coins: initialPlayer1.coins,
        shards: new Map(initialPlayer1.shards),
        cards: [...initialPlayer1.cards],
      });
      player2.set({
        coins: initialPlayer2.coins,
        shards: new Map(initialPlayer2.shards),
        cards: [...initialPlayer2.cards],
      });
      await Promise.all([player1.save(), player2.save()]);
      tradeState.canceled = true;
    }
  }
};

async function executeTrade(tradeState, player1, player2) {
  player1.coins += tradeState.p2Items.coins;
  player2.coins += tradeState.p1Items.coins;

  for (const [shard, qty] of tradeState.p2Items.shards) {
    player1.shards.set(shard, (player1.shards.get(shard) || 0) + qty);
  }
  for (const [shard, qty] of tradeState.p1Items.shards) {
    player2.shards.set(shard, (player2.shards.get(shard) || 0) + qty);
  }

  player1.cards.push(...tradeState.p2Items.cards);
  player2.cards.push(...tradeState.p1Items.cards);

  await Promise.all([player1.save(), player2.save()]);
}