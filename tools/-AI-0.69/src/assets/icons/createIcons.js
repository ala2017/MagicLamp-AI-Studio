// 使用 Canvas 创建一个简单的图标
function createIcon(size) {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  
  // 绘制一个简单的书签形状
  ctx.fillStyle = '#4285f4';
  ctx.beginPath();
  ctx.moveTo(size * 0.2, size * 0.1);
  ctx.lineTo(size * 0.8, size * 0.1);
  ctx.lineTo(size * 0.8, size * 0.9);
  ctx.lineTo(size * 0.5, size * 0.7);
  ctx.lineTo(size * 0.2, size * 0.9);
  ctx.closePath();
  ctx.fill();
  
  return canvas.toDataURL();
}

// 创建三种尺寸的图标
const sizes = [16, 48, 128];
sizes.forEach(size => {
  const link = document.createElement('a');
  link.download = `icon${size}.png`;
  link.href = createIcon(size);
  link.click();
}); 