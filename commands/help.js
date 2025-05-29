const { SlashCommandBuilder, EmbedBuilder, PermissionsBitField } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('help')
    .setDescription('Display the list of commands and their functions'),
  async execute(interaction, collectionStates) {
    // Defer reply ngay lập tức để tránh lỗi hết hạn 3 giây
    await interaction.deferReply({ ephemeral: true });

    const { user, channel } = interaction;

    // Check for Send Messages permission
    if (!interaction.member.permissionsIn(channel).has(PermissionsBitField.Flags.SendMessages)) {
      await interaction.editReply({ content: 'You need **Send Messages** permission to use this command!' });
      return;
    }

    const hasBanMembers = interaction.member.permissionsIn(channel).has(PermissionsBitField.Flags.BanMembers);
    let helpDescription = 'Below is the list of commands and their functions:\n\n';
    if (hasBanMembers) {
      helpDescription +=
        '`/addcharacter` · Add a new character\n' +
        '`/collection` · View your card collection\n' +
        '`/cooldowns` · View command cooldown times\n' +
        '`/daily` · Claim daily coins\n' +
        '`/dismantle` · Dismantle a card to gain shards\n' +
        '`/drop` · Drop a random card\n' +
        '`/help` · Display the list of commands and their functions\n' +
        '`/inventory` · View your inventory\n' +
        '`/trade` · Start a trade with another player\n' +
        '`/upgrade` · Upgrade a card\'s condition\n' +
        '`/view` · View detailed information of a card';
    } else {
      helpDescription +=
        '`/collection` · View your card collection\n' +
        '`/cooldowns` · View command cooldown times\n' +
        '`/daily` · Claim daily coins\n' +
        '`/dismantle` · Dismantle a card to gain shards\n' +
        '`/drop` · Drop a random card\n' +
        '`/help` · Display the list of commands and their functions\n' +
        '`/inventory` · View your inventory\n' +
        '`/trade` · Start a trade with another player\n' +
        '`/upgrade` · Upgrade a card\'s condition\n' +
        '`/view` · View detailed information of a card';
    }

    const embed = new EmbedBuilder()
      .setTitle('Command List')
      .setDescription(helpDescription)
      .setColor('#00CED1');

    try {
      // Thử gửi DM
      await user.send({ embeds: [embed] });
      // Nếu gửi DM thành công, trả lời người dùng
      await interaction.editReply({ content: 'The command list has been sent to your DMs!' });
    } catch (error) {
      console.error(`Failed to send DM to user ${user.id}:`, error);
      // Nếu không gửi được DM, thông báo cho người dùng
      await interaction.editReply({ content: 'I couldn\'t send the command list to your DMs. Please check if your DMs are open or try again later.' });
    }
  },
};