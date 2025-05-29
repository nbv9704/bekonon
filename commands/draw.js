const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { drawDuelCanvas } = require('../utils/canvas');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('draw')
    .setDescription('Test ảnh duel embed generate với nền tùy chọn')

    // Các tham số cũ
    .addStringOption(opt => opt.setName('leftname').setDescription('Tên player trái').setRequired(true))
    .addStringOption(opt => opt.setName('rightname').setDescription('Tên player phải').setRequired(true))
    .addStringOption(opt => opt.setName('leftimage').setDescription('URL ảnh thẻ trái').setRequired(true))
    .addStringOption(opt => opt.setName('rightimage').setDescription('URL ảnh thẻ phải').setRequired(true))
    .addStringOption(opt => opt.setName('leftavatar').setDescription('URL avatar trái').setRequired(true))
    .addStringOption(opt => opt.setName('rightavatar').setDescription('URL avatar phải').setRequired(true))
    .addNumberOption(opt => opt.setName('lefthp').setDescription('HP % trái (0-100)').setRequired(true))
    .addNumberOption(opt => opt.setName('righthp').setDescription('HP % phải (0-100)').setRequired(true))

    // Thêm option background URL
    .addStringOption(opt => opt.setName('backgroundurl').setDescription('URL ảnh nền (không bắt buộc)').setRequired(false)),

  async execute(interaction) {
    await interaction.deferReply();

    try {
      const leftName = interaction.options.getString('leftname');
      const rightName = interaction.options.getString('rightname');
      const leftImageURL = interaction.options.getString('leftimage');
      const rightImageURL = interaction.options.getString('rightimage');
      const leftAvatarURL = interaction.options.getString('leftavatar');
      const rightAvatarURL = interaction.options.getString('rightavatar');
      const leftHpPercent = interaction.options.getNumber('lefthp');
      const rightHpPercent = interaction.options.getNumber('righthp');
      const backgroundURL = interaction.options.getString('backgroundurl') || null;

      const assetsPath = './assets';

      const buffer = await drawDuelCanvas({
        leftImageURL,
        rightImageURL,
        leftHpPercent,
        rightHpPercent,
        leftName,
        rightName,
        leftAvatarURL,
        rightAvatarURL,
        assetsPath,
        backgroundURL
      });

      const attachment = {
        attachment: buffer,
        name: 'duel.png'
      };

      const embed = new EmbedBuilder()
        .setTitle('Test Duel Canvas')
        .setColor('#00ffff')
        .setImage('attachment://duel.png');

      await interaction.editReply({ embeds: [embed], files: [attachment] });

    } catch (error) {
      console.error(error);
      await interaction.editReply('Có lỗi khi tạo ảnh.');
    }
  }
};
