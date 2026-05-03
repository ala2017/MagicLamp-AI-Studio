/**
 * home-scripts.js
 * 包含 home.html 页面的脚本
 */

// UI 交互效果
(function() {
    // 鼠标移动光效
    document.addEventListener('mousemove', (e) => {
        const cards = document.querySelectorAll('.bookmark-card');
        cards.forEach(card => {
            const rect = card.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;
            
            card.style.setProperty('--mouse-x', `${x}px`);
            card.style.setProperty('--mouse-y', `${y}px`);
        });
    });

    // 随机书签按钮动画
    const randomBtn = document.getElementById('randomBookmark');
    if (randomBtn) {
        randomBtn.addEventListener('mouseover', () => {
            randomBtn.style.animation = 'none';
            randomBtn.offsetHeight; // 触发重绘
            randomBtn.style.animation = 'diceRoll 2s ease-in-out infinite';
        });
    }
})(); 