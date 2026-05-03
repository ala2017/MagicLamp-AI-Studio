// 使用 Canvas 创建一个骰子图标
function createIcon(size) {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  
  // 清除画布
  ctx.clearRect(0, 0, size, size);
  
  // 设置抗锯齿
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  
  // 绘制骰子主体 - 红色方块
  ctx.fillStyle = '#E11D48';  // 红色
  ctx.shadowColor = '#FB7185';
  ctx.shadowBlur = size * 0.1;
  ctx.shadowOffsetX = 0;
  ctx.shadowOffsetY = 0;
  
  // 绘制圆角矩形 - 更大尺寸
  const padding = size * 0.01;  // 最小内边距，让骰子几乎占满整个空间
  const cornerRadius = size * 0.12;  // 保持圆角比例
  
  // 先绘制白色描边
  ctx.strokeStyle = '#FFFFFF';
  ctx.lineWidth = size * 0.10;  // 将描边宽度增加到10%
  
  ctx.beginPath();
  ctx.moveTo(padding + cornerRadius, padding);
  ctx.lineTo(size - padding - cornerRadius, padding);
  ctx.arcTo(size - padding, padding, size - padding, padding + cornerRadius, cornerRadius);
  ctx.lineTo(size - padding, size - padding - cornerRadius);
  ctx.arcTo(size - padding, size - padding, size - padding - cornerRadius, size - padding, cornerRadius);
  ctx.lineTo(padding + cornerRadius, size - padding);
  ctx.arcTo(padding, size - padding, padding, size - padding - cornerRadius, cornerRadius);
  ctx.lineTo(padding, padding + cornerRadius);
  ctx.arcTo(padding, padding, padding + cornerRadius, padding, cornerRadius);
  ctx.closePath();
  ctx.stroke();  // 绘制白色描边
  ctx.fill();    // 填充红色
  
  // 绘制骰子点数 - 白色圆点
  ctx.fillStyle = '#FFFFFF';
  ctx.shadowBlur = 0;  // 移除阴影效果
  
  // 绘制三个点
  const dotSize = size * 0.12;
  const dotSpacing = size * 0.2;
  const centerY = size * 0.5;
  
  // 左点
  ctx.beginPath();
  ctx.arc(size * 0.3, centerY, dotSize, 0, Math.PI * 2);
  ctx.fill();
  
  // 中点
  ctx.beginPath();
  ctx.arc(size * 0.5, centerY, dotSize, 0, Math.PI * 2);
  ctx.fill();
  
  // 右点
  ctx.beginPath();
  ctx.arc(size * 0.7, centerY, dotSize, 0, Math.PI * 2);
  ctx.fill();
  
  return canvas.toDataURL('image/png');
}

// 创建并下载图标
function downloadIcons() {
  const sizes = [16, 32, 48, 128];
  
  sizes.forEach(size => {
    const iconData = createIcon(size);
    const link = document.createElement('a');
    link.download = `random_icon${size}.png`;
    link.href = iconData;
    link.click();
  });
}

// 执行下载
downloadIcons(); 