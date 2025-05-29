const { createCanvas, loadImage } = require('canvas');
const path = require('path');

async function drawDuelCanvas({
  leftImageURL,
  rightImageURL,
  leftHpPercent,
  rightHpPercent,
  leftName,
  rightName,
  leftAvatarURL,
  rightAvatarURL,
  assetsPath
}) {
  const width = 800;
  const height = 400;
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext('2d');

  // Background màu tối
  ctx.fillStyle = '#222';
  ctx.fillRect(0, 0, width, height);

  // Vẽ tên 2 player trên đầu
  ctx.fillStyle = '#00ffff';
  ctx.font = '24px Arial';
  ctx.fillText(leftName, 50, 40);
  ctx.fillText(rightName, width - 200, 40);

  // Load ảnh thẻ
  const leftCardImg = await loadImage(leftImageURL);
  const rightCardImg = await loadImage(rightImageURL);

  // Kích thước ảnh thẻ gốc
  const cardOriginalWidth = 280;
  const cardOriginalHeight = 440;
  const cardDisplayHeight = 200; // chiều cao hiển thị
  const cardDisplayWidth = (cardOriginalWidth / cardOriginalHeight) * cardDisplayHeight; // ~127.27

  // Vẽ ảnh thẻ
  ctx.drawImage(leftCardImg, 50, 80, cardDisplayWidth, cardDisplayHeight);
  ctx.drawImage(rightCardImg, width - 50 - cardDisplayWidth, 80, cardDisplayWidth, cardDisplayHeight);

  // Round phần trăm hp xuống bội số 10 trong khoảng 0-100
  const roundHpLeft = Math.max(0, Math.min(100, Math.floor(leftHpPercent / 10) * 10));
  const roundHpRight = Math.max(0, Math.min(100, Math.floor(rightHpPercent / 10) * 10));

  // Đường dẫn đúng folder healthbar
  const leftHpBarPath = path.join(assetsPath, 'healthbar', `${roundHpLeft}.png`);
  const rightHpBarPath = path.join(assetsPath, 'healthbar', `${roundHpRight}.png`);

  const leftHpBarImg = await loadImage(leftHpBarPath);
  const rightHpBarImg = await loadImage(rightHpBarPath);

  // Vẽ thanh máu với tỉ lệ đúng
  const targetWidth = cardDisplayWidth;
  const leftScale = targetWidth / leftHpBarImg.width;
  const rightScale = targetWidth / rightHpBarImg.width;
  const leftHeight = leftHpBarImg.height * leftScale;
  const rightHeight = rightHpBarImg.height * rightScale;

  ctx.drawImage(leftHpBarImg, 50, 60, targetWidth, leftHeight);
  ctx.drawImage(rightHpBarImg, width - 50 - targetWidth, 60, targetWidth, rightHeight);

  // Load avatar
  const leftAvatar = await loadImage(leftAvatarURL);
  const rightAvatar = await loadImage(rightAvatarURL);

  ctx.save();
  ctx.beginPath();
  ctx.arc(30, 40, 20, 0, Math.PI * 2);
  ctx.closePath();
  ctx.clip();
  ctx.drawImage(leftAvatar, 10, 20, 40, 40);
  ctx.restore();

  ctx.save();
  ctx.beginPath();
  ctx.arc(width - 30, 40, 20, 0, Math.PI * 2);
  ctx.closePath();
  ctx.clip();
  ctx.drawImage(rightAvatar, width - 50, 20, 40, 40);
  ctx.restore();

  return canvas.toBuffer();
}

module.exports = { drawDuelCanvas };
