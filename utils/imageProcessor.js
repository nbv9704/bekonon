const { createCanvas, loadImage } = require('canvas');
const { ImgurClient } = require('imgur');
const fs = require('fs').promises;
const path = require('path');
require('dotenv').config();

const imgurClient = new ImgurClient({ clientId: process.env.IMGUR_CLIENT_ID });

function getFramePath(rarity) {
  const frameMap = {
    '◈C': 'frame-common.png',
    '◈R': 'frame-rare.png',
    '◈E': 'frame-epic.png',
    '◈L': 'frame-legendary.png'
  };
  return path.join(__dirname, '../assets/frames', frameMap[rarity] || 'frame-common.png');
}

async function generateCardImageWithPreparedFrame(imageUrl, rarity) {
  try {
    const framePath = getFramePath(rarity);
    const frame = await loadImage(framePath);

    const canvas = createCanvas(frame.width, frame.height);
    const ctx = canvas.getContext('2d');

    // Vẽ sẵn khung lên nền trắng hoặc trong suốt
    ctx.drawImage(frame, 0, 0);

    const imageX = 0;
    const imageY = 0;
    const imageWidth = frame.width;
    const imageHeight = frame.height;

    const defaultImageUrl = 'https://via.placeholder.com/150';
    const defaultImagePath = path.join(__dirname, '../assets/default-character.png');

    let characterImage;
    if (imageUrl !== defaultImageUrl) {
      console.log(`Loading character image from: ${imageUrl}`);
      characterImage = await loadImage(imageUrl);
    } else {
      console.log(`Using default image from: ${defaultImagePath}`);
      characterImage = await loadImage(defaultImagePath);
    }

    // Vẽ ảnh nhân vật đè lên dưới frame (frame đã có từ trước)
    ctx.drawImage(characterImage, imageX, imageY, imageWidth, imageHeight);

    const buffer = canvas.toBuffer('image/png');

    try {
      const base64Image = buffer.toString('base64');
      const response = await imgurClient.upload({
        image: base64Image,
        type: 'base64',
        name: `card-${Date.now()}.png`,
        title: 'Card Image',
        description: 'Generated card image for Discord bot'
      });

      if (!response.success || !response.data || !response.data.link) {
        throw new Error('Failed to upload image to Imgur: Invalid response');
      }

      return { type: 'url', value: response.data.link };
    } catch (imgurError) {
      console.error('Imgur upload failed:', imgurError.message);
      console.warn('Falling back to local file storage.');

      const tempDir = path.join(__dirname, '../temp');
      await fs.mkdir(tempDir, { recursive: true });

      const outputPath = path.join(tempDir, `card-${Date.now()}.png`);
      await fs.writeFile(outputPath, buffer);

      return { type: 'file', value: outputPath };
    }
  } catch (error) {
    console.error('Error generating image with prepared frame:', error);
    throw error;
  }
}

module.exports = { generateCardImageWithPreparedFrame };
