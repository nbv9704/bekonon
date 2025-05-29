const { SlashCommandBuilder, EmbedBuilder, PermissionsBitField } = require('discord.js');
const { User } = require('../models');

const itemMapping = {
  coin:     { itemName: 'Coin',      itemID: 'coin' },
  '◈C Shard': { itemName: '◈C Shard', itemID: 'cshard' },
  '◈R Shard': { itemName: '◈R Shard', itemID: 'rshard' },
  '◈E Shard': { itemName: '◈E Shard', itemID: 'eshard' },
  '◈L Shard': { itemName: '◈L Shard', itemID: 'lshard' },
};

module.exports = {
  data: new SlashCommandBuilder()
    .setName('inventory')
    .setDescription('View your shards and coins'),
  
  async execute(interaction) {
    const { user, channel } = interaction;

    if (!interaction.member.permissionsIn(channel).has(PermissionsBitField.Flags.SendMessages)) {
      await interaction.reply({ content: 'You need **Send Messages** permission to use this command!', ephemeral: true });
      return;
    }

    const player = await User.findOne({ userId: user.id });
    if (!player) {
      await interaction.reply({ content: 'You have no inventory yet!', ephemeral: true });
      return;
    }

    const shards = player.shards || new Map();

    let shardList = '';
    for (const [shardKey, count] of shards.entries()) {
      const item = itemMapping[shardKey];
      if (item) {
        shardList += `🔹 **${count}** ${item.itemName} · \`${item.itemID}\`\n`;
      } else {
        shardList += `🔹 **${count}** ${shardKey} · \`unknown\`\n`;
      }
    }

    const embed = new EmbedBuilder()
      .setTitle(`${user.username}'s Inventory`)
      .setDescription(
        `🪙 **${player.coins || 0}** Coin · \`coin\`\n\n` +
        `Shards:\n${shardList || 'None'}`
      )
      .setColor('#00ff00');

    await interaction.reply({ embeds: [embed] });
  },
};
