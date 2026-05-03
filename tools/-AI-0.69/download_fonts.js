// 下载 Inter 字体文件的脚本
// 请在命令行中使用 Node.js 运行此脚本：node download_fonts.js

const fs = require('fs');
const https = require('https');
const path = require('path');

// 字体文件 URL
const fontFiles = [
    {
        name: 'Inter-Regular.woff2',
        url: 'https://fonts.gstatic.com/s/inter/v13/UcCO3FwrK3iLTeHuS_fvQtMwCp50KnMw2boKoduKmMEVuLyfAZ9hjp-Ek-_EeA.woff2'
    },
    {
        name: 'Inter-Medium.woff2',
        url: 'https://fonts.gstatic.com/s/inter/v13/UcCO3FwrK3iLTeHuS_fvQtMwCp50KnMw2boKoduKmMEVuI6fAZ9hjp-Ek-_EeA.woff2'
    },
    {
        name: 'Inter-SemiBold.woff2',
        url: 'https://fonts.gstatic.com/s/inter/v13/UcCO3FwrK3iLTeHuS_fvQtMwCp50KnMw2boKoduKmMEVuGKYAZ9hjp-Ek-_EeA.woff2'
    },
    {
        name: 'Inter-Bold.woff2',
        url: 'https://fonts.gstatic.com/s/inter/v13/UcCO3FwrK3iLTeHuS_fvQtMwCp50KnMw2boKoduKmMEVuFuYAZ9hjp-Ek-_EeA.woff2'
    }
];

// 确保字体目录存在
const fontDir = path.join(__dirname, 'src', 'assets', 'fonts');
if (!fs.existsSync(fontDir)) {
    fs.mkdirSync(fontDir, { recursive: true });
    console.log(`创建目录: ${fontDir}`);
}

// 下载字体文件
fontFiles.forEach(font => {
    const filePath = path.join(fontDir, font.name);
    
    // 检查文件是否已存在
    if (fs.existsSync(filePath)) {
        console.log(`文件已存在: ${font.name}`);
        return;
    }
    
    console.log(`开始下载: ${font.name}`);
    
    const file = fs.createWriteStream(filePath);
    https.get(font.url, response => {
        response.pipe(file);
        file.on('finish', () => {
            file.close();
            console.log(`下载完成: ${font.name}`);
        });
    }).on('error', err => {
        fs.unlink(filePath, () => {}); // 删除不完整的文件
        console.error(`下载失败: ${font.name}`, err.message);
    });
});

console.log('字体下载脚本启动，请等待下载完成...'); 