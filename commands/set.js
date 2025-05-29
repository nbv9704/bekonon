const { SlashCommandBuilder, PermissionsBitField } = require('discord.js');
const { User } = require('../models');

const itemMapping = {
  coin: { itemName: 'Coin', itemID: 'coin', type: 'currency' },
  cshard: { itemName: '◈C Shard', itemID: 'cshard', shardKey: '◈C Shard' },
  rshard: { itemName: '◈R Shard', itemID: 'rshard', shardKey: '◈R Shard' },
  eshard: { itemName: '◈E Shard', itemID: 'eshard', shardKey: '◈E Shard' },
  lshard: { itemName: '◈L Shard', itemID: 'lshard', shardKey: '◈L Shard' }
};

module.exports = {
  data: new SlashCommandBuilder()
    .setName('set')
    .setDescription('Give test coins or shards to a user (for dev testing)')
    .addUserOption(option =>
      option.setName('user')
        .setDescription('Target user')
        .setRequired(true))
    .addStringOption(option =>
      option.setName('item')
        .setDescription('Type of item to add')
        .setRequired(true)
        .addChoices(
          { name: 'Coin', value: 'coin' },
          { name: 'Shard ◈C', value: 'cshard' },
          { name: 'Shard ◈R', value: 'rshard' },
          { name: 'Shard ◈E', value: 'eshard' },
          { name: 'Shard ◈L', value: 'lshard' }
        ))
    .addIntegerOption(option =>
      option.setName('amount')
        .setDescription('Amount to give')
        .setRequired(true)),

  async execute(interaction) {
    const { options, member, channel } = interaction;

    if (!member.permissionsIn(channel).has(PermissionsBitField.Flags.BanMembers)) {
      return interaction.reply({ content: 'You need **Ban Members** permission to use this command!', ephemeral: true });
    }

    const targetUser = options.getUser('user');
    const itemKey = options.getString('item');
    const amount = options.getInteger('amount');

    if (amount <= 0) {
      return interaction.reply({ content: 'Amount must be greater than 0!', ephemeral: true });
    }

    const item = itemMapping[itemKey];
    if (!item) {
      return interaction.reply({ content: `Invalid item key: \`${itemKey}\``, ephemeral: true });
    }

    let userData = await User.findOne({ userId: targetUser.id });
    if (!userData) {
      userData = new User({ userId: targetUser.id, coins: 0, shards: new Map(), cards: [] });
    }

    if (item.type === 'currency') {
      userData.coins += amount;
    } else if (item.shardKey) {
      const current = userData.shards.get(item.shardKey) || 0;
      userData.shards.set(item.shardKey, current + amount);
    } else {
      return interaction.reply({ content: `Item type for \`${itemKey}\` not recognized.`, ephemeral: true });
    }

    await userData.save();
    return interaction.reply({
      content: `✅ Added \`${amount}\` ${item.type === 'currency' ? '🪙 Coins' : `${item.itemName}`} to <@${targetUser.id}>.`
    });
  },
};
