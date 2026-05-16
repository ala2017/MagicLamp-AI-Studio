// 导航栏组件
// 参考实现: ../_archive/index.js

class NavigationBar extends HTMLElement {
    constructor() {
        super();
        this.attachShadow({ mode: 'open' });
    }

    connectedCallback() {
        this.render();
        this.setupEventListeners();
    }

    render() {
        this.shadowRoot.innerHTML = `
            <style>
                :host {
                    display: block;
                    width: 100%;
                }

                .header {
                    position: fixed;
                    top: 0;
                    left: 0;
                    right: 0;
                    height: 64px;
                    background: rgba(30, 41, 59, 0.8);
                    backdrop-filter: blur(20px);
                    border-bottom: 1px solid rgba(255, 255, 255, 0.08);
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    padding: 0 24px;
                    z-index: 100;
                }

                .brand {
                    display: flex;
                    align-items: center;
                    gap: 12px;
                }

                .brand h1 {
                    margin: 0;
                    font-size: 20px;
                    font-weight: 600;
                    background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%);
                    -webkit-background-clip: text;
                    -webkit-text-fill-color: transparent;
                    letter-spacing: -0.02em;
                }

                .version {
                    padding: 4px 8px;
                    background: rgba(255, 255, 255, 0.03);
                    border-radius: 6px;
                    font-size: 12px;
                    color: rgba(255, 255, 255, 0.7);
                    border: 1px solid rgba(255, 255, 255, 0.08);
                }

                .stats {
                    display: flex;
                    gap: 24px;
                    margin-left: 48px;
                }

                .stat-item {
                    display: flex;
                    align-items: center;
                    gap: 8px;
                    padding: 4px 12px;
                    background: rgba(255, 255, 255, 0.05);
                    border-radius: 8px;
                    border: 1px solid rgba(255, 255, 255, 0.1);
                }

                .stat-item .icon {
                    width: 16px;
                    height: 16px;
                    opacity: 0.9;
                    filter: brightness(0) invert(1);
                }

                .stat-count {
                    font-weight: 600;
                    font-size: 16px;
                    background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%);
                    -webkit-background-clip: text;
                    -webkit-text-fill-color: transparent;
                }

                .stat-label {
                    font-size: 14px;
                    color: rgba(255, 255, 255, 0.7);
                }

                .actions {
                    display: flex;
                    align-items: center;
                    gap: 12px;
                }

                .btn {
                    display: flex;
                    align-items: center;
                    gap: 8px;
                    padding: 8px 16px;
                    border-radius: 8px;
                    border: 1px solid rgba(255, 255, 255, 0.1);
                    background: rgba(255, 255, 255, 0.05);
                    color: white;
                    font-size: 14px;
                    font-weight: 500;
                    cursor: pointer;
                    transition: all 0.3s ease;
                }

                .btn:hover {
                    border-color: rgba(255, 255, 255, 0.2);
                    background: rgba(255, 255, 255, 0.1);
                    transform: translateY(-1px);
                }

                .btn .icon {
                    width: 16px;
                    height: 16px;
                    opacity: 0.9;
                    filter: brightness(0) invert(1);
                }

                .btn-random {
                    padding: 8px;
                }

                .btn-random .icon {
                    filter: none;
                    width: 24px;
                    height: 24px;
                }

                .btn-random:hover .icon {
                    animation: diceRoll 0.5s ease;
                }

                @keyframes diceRoll {
                    0% { transform: rotate(0deg); }
                    100% { transform: rotate(360deg); }
                }

                .btn-primary { 
                    background: linear-gradient(135deg, rgba(99, 102, 241, 0.2), rgba(139, 92, 246, 0.2));
                    border-color: rgba(99, 102, 241, 0.3);
                }

                .btn-success { 
                    background: linear-gradient(135deg, rgba(34, 197, 94, 0.2), rgba(16, 185, 129, 0.2));
                    border-color: rgba(34, 197, 94, 0.3);
                }

                .btn-warning { 
                    background: linear-gradient(135deg, rgba(245, 158, 11, 0.2), rgba(234, 88, 12, 0.2));
                    border-color: rgba(245, 158, 11, 0.3);
                }

                .btn-info { 
                    background: linear-gradient(135deg, rgba(6, 182, 212, 0.2), rgba(59, 130, 246, 0.2));
                    border-color: rgba(6, 182, 212, 0.3);
                }

                .btn-primary.active, .btn-success.active, .btn-warning.active, .btn-info.active {
                    background: rgba(255, 255, 255, 0.15);
                    border-color: rgba(255, 255, 255, 0.3);
                    box-shadow: 0 0 0 2px rgba(255, 255, 255, 0.1);
                }

                .utils {
                    display: flex;
                    align-items: center;
                    gap: 8px;
                    margin-left: 24px;
                    padding-left: 24px;
                    border-left: 1px solid rgba(255, 255, 255, 0.1);
                }

                .btn-icon {
                    width: 36px;
                    height: 36px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    border-radius: 8px;
                    border: 1px solid rgba(255, 255, 255, 0.1);
                    background: rgba(255, 255, 255, 0.05);
                    color: rgba(255, 255, 255, 0.8);
                    cursor: pointer;
                    transition: all 0.3s ease;
                }

                .btn-icon:hover {
                    border-color: rgba(255, 255, 255, 0.2);
                    background: rgba(255, 255, 255, 0.1);
                    transform: translateY(-1px);
                }

                .btn-icon .icon {
                    width: 16px;
                    height: 16px;
                    opacity: 0.9;
                    filter: brightness(0) invert(1);
                }

                /* 适配浅色主题 */
                :host([data-theme="light"]) .header {
                    background: rgba(255, 255, 255, 0.8);
                    border-bottom: 1px solid rgba(0, 0, 0, 0.1);
                }

                :host([data-theme="light"]) .brand h1 {
                    background: linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%);
                    -webkit-background-clip: text;
                    -webkit-text-fill-color: transparent;
                }

                :host([data-theme="light"]) .version {
                    background: rgba(0, 0, 0, 0.03);
                    border: 1px solid rgba(0, 0, 0, 0.08);
                    color: rgba(0, 0, 0, 0.7);
                }

                :host([data-theme="light"]) .stat-item {
                    background: rgba(0, 0, 0, 0.05);
                    border: 1px solid rgba(0, 0, 0, 0.1);
                }

                :host([data-theme="light"]) .stat-count {
                    background: linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%);
                    -webkit-background-clip: text;
                    -webkit-text-fill-color: transparent;
                }

                :host([data-theme="light"]) .stat-label {
                    color: rgba(0, 0, 0, 0.7);
                }

                :host([data-theme="light"]) .btn {
                    border: 1px solid rgba(0, 0, 0, 0.1);
                    background: rgba(0, 0, 0, 0.05);
                    color: rgba(0, 0, 0, 0.8);
                }

                :host([data-theme="light"]) .btn:hover {
                    border-color: rgba(0, 0, 0, 0.2);
                    background: rgba(0, 0, 0, 0.1);
                }

                :host([data-theme="light"]) .btn .icon {
                    filter: brightness(0);
                }

                :host([data-theme="light"]) .btn-random .icon {
                    filter: none;
                }

                :host([data-theme="light"]) .utils {
                    border-left: 1px solid rgba(0, 0, 0, 0.1);
                }

                :host([data-theme="light"]) .btn-icon {
                    border: 1px solid rgba(0, 0, 0, 0.1);
                    background: rgba(0, 0, 0, 0.05);
                    color: rgba(0, 0, 0, 0.8);
                }

                :host([data-theme="light"]) .btn-icon:hover {
                    border-color: rgba(0, 0, 0, 0.2);
                    background: rgba(0, 0, 0, 0.1);
                }

                :host([data-theme="light"]) .btn-icon .icon {
                    filter: brightness(0);
                }
            </style>
            
            <header class="header">
                <div class="brand">
                    <h1>神灯AI书签管理器</h1>
                    <span class="version">v0.72</span>
                </div>

                <div class="stats">
                    <div class="stat-item">
                        <img src="/src/assets/icons/bookmark.svg" alt="书签" class="icon">
                        <span class="stat-count" id="totalBookmarks">0</span>
                        <span class="stat-label">书签总数</span>
                    </div>
                    <div class="stat-item">
                        <img src="/src/assets/icons/folder.svg" alt="文件夹" class="icon">
                        <span class="stat-count" id="totalFolders">0</span>
                        <span class="stat-label">目录总数</span>
                    </div>
                </div>

                <div class="actions">
                    <button class="btn btn-random" id="randomBookmark" title="随机书签">
                        <img src="/src/assets/icons/dice_icon32.png" alt="" class="icon">
                    </button>
                    <button class="btn btn-primary" id="homeBtn">
                        <img src="/src/assets/icons/home.svg" alt="" class="icon">
                        首页
                    </button>
                    <button class="btn btn-success" id="checkBtn">
                        <img src="/src/assets/icons/check.svg" alt="" class="icon">
                        检查链接
                    </button>
                    <button class="btn btn-warning" id="duplicateBtn">
                        <img src="/src/assets/icons/find.svg" alt="" class="icon">
                        查找重复
                    </button>
                    <button class="btn btn-info" id="aiAssistant">
                        <img src="/src/assets/icons/ai.svg" alt="" class="icon">
                        AI辅助
                    </button>
                    
                    <div class="utils">
                        <button class="btn-icon" id="themeToggle" title="切换主题">
                            <img src="/src/assets/icons/theme.svg" alt="主题" class="icon">
                        </button>
                        <button class="btn-icon" id="langToggle" title="切换语言">中</button>
                        <button class="btn-icon" id="settings" title="设置">
                            <img src="/src/assets/icons/settings.svg" alt="设置" class="icon">
                        </button>
                    </div>
                </div>
            </header>
        `;
    }

    // 设置事件监听器
    setupEventListeners() {
        // 获取按钮元素
        const homeBtn = this.shadowRoot.getElementById('homeBtn');
        const checkBtn = this.shadowRoot.getElementById('checkBtn');
        const duplicateBtn = this.shadowRoot.getElementById('duplicateBtn');
        const aiAssistant = this.shadowRoot.getElementById('aiAssistant');
        const randomBookmark = this.shadowRoot.getElementById('randomBookmark');
        const themeToggle = this.shadowRoot.getElementById('themeToggle');

        // 添加事件监听器
        if (homeBtn) {
            homeBtn.addEventListener('click', () => this.navigateTo('home'));
        }
        if (checkBtn) {
            checkBtn.addEventListener('click', () => this.navigateTo('check'));
        }
        if (duplicateBtn) {
            duplicateBtn.addEventListener('click', () => this.navigateTo('duplicate'));
        }
        if (aiAssistant) {
            aiAssistant.addEventListener('click', () => this.navigateTo('ai'));
        }
        if (randomBookmark) {
            randomBookmark.addEventListener('click', () => this.openRandomBookmark());
        }
        if (themeToggle) {
            themeToggle.addEventListener('click', () => this.toggleTheme());
        }

        // 设置当前页面的活动按钮
        this.setActiveButton();

        // 加载统计数据
        this.loadStats();

        // 应用当前主题
        this.applyCurrentTheme();
    }

    // 设置当前页面的活动按钮
    setActiveButton() {
        const currentPath = window.location.pathname;
        const homeBtn = this.shadowRoot.getElementById('homeBtn');
        const checkBtn = this.shadowRoot.getElementById('checkBtn');
        const duplicateBtn = this.shadowRoot.getElementById('duplicateBtn');
        const aiAssistant = this.shadowRoot.getElementById('aiAssistant');

        // 移除所有活动状态
        [homeBtn, checkBtn, duplicateBtn, aiAssistant].forEach(btn => {
            if (btn) btn.classList.remove('active');
        });

        // 根据当前路径设置活动按钮
        if (currentPath.includes('/home/')) {
            if (homeBtn) homeBtn.classList.add('active');
        } else if (currentPath.includes('/bookmark-check/')) {
            if (checkBtn) checkBtn.classList.add('active');
        } else if (currentPath.includes('/duplicate-finder/')) {
            if (duplicateBtn) duplicateBtn.classList.add('active');
        } else if (currentPath.includes('/ai-space/')) {
            if (aiAssistant) aiAssistant.classList.add('active');
        }
    }

    // 导航函数
    navigateTo(page) {
        switch(page) {
            case 'home':
                window.location.href = '/src/pages/home/home.html';
                break;
            case 'check':
                window.location.href = '/src/pages/bookmark-check/link-check.html';
                break;
            case 'duplicate':
                window.location.href = '/src/pages/duplicate-finder/duplicate.html';
                break;
            case 'ai':
                window.location.href = '/src/pages/ai-space/ai-space.html';
                break;
        }
    }

    // 打开随机书签
    async openRandomBookmark() {
        try {
            const bookmarks = await this.getAllBookmarks();
            if (bookmarks.length > 0) {
                const randomIndex = Math.floor(Math.random() * bookmarks.length);
                const randomBookmark = bookmarks[randomIndex];
                chrome.tabs.create({ url: randomBookmark.url });
            }
        } catch (error) {
            console.error('打开随机书签时出错:', error);
        }
    }

    // 获取所有书签
    getAllBookmarks() {
        return new Promise((resolve) => {
            chrome.bookmarks.getTree((bookmarkTreeNodes) => {
                const bookmarks = [];
                
                function traverse(node) {
                    if (node.url) {
                        bookmarks.push(node);
                    }
                    if (node.children) {
                        node.children.forEach(traverse);
                    }
                }
                
                bookmarkTreeNodes.forEach(traverse);
                resolve(bookmarks);
            });
        });
    }

    // 切换主题
    toggleTheme() {
        const currentTheme = this.getTheme();
        const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
        
        // 保存新主题
        localStorage.setItem('theme', newTheme);
        
        // 应用新主题
        this.applyTheme(newTheme);
    }

    // 获取当前主题
    getTheme() {
        return localStorage.getItem('theme') || 'dark';
    }

    // 应用当前主题
    applyCurrentTheme() {
        const currentTheme = this.getTheme();
        this.applyTheme(currentTheme);
    }

    // 应用主题
    applyTheme(theme) {
        // 设置文档主题
        document.documentElement.setAttribute('data-theme', theme);
        document.body.setAttribute('data-theme', theme);
        
        // 设置组件主题
        this.setAttribute('data-theme', theme);
        
        // 更新图标颜色
        this.updateIconColors(theme);
    }

    // 更新图标颜色
    updateIconColors(theme) {
        const icons = this.shadowRoot.querySelectorAll('.icon');
        icons.forEach(icon => {
            if (theme === 'light') {
                icon.style.filter = 'invert(0%)';
            } else {
                icon.style.filter = 'invert(100%)';
            }
        });
    }

    // 加载统计数据
    loadStats() {
        chrome.bookmarks.getTree((bookmarkTreeNodes) => {
            const stats = this.countBookmarksAndFolders(bookmarkTreeNodes);
            
            const totalBookmarksElement = this.shadowRoot.getElementById('totalBookmarks');
            const totalFoldersElement = this.shadowRoot.getElementById('totalFolders');
            
            if (totalBookmarksElement) {
                totalBookmarksElement.textContent = stats.bookmarks;
            }
            
            if (totalFoldersElement) {
                totalFoldersElement.textContent = stats.folders;
            }
        });
    }

    // 计算书签和文件夹数量
    countBookmarksAndFolders(nodes) {
        let bookmarks = 0;
        let folders = 0;
        
        function traverse(node) {
            if (node.url) {
                bookmarks++;
            } else if (node.id !== '0' && node.id !== '1') {
                // 排除根节点
                folders++;
            }
            
            if (node.children) {
                node.children.forEach(traverse);
            }
        }
        
        nodes.forEach(traverse);
        
        return { bookmarks, folders };
    }
}

// 注册自定义元素
customElements.define('nav-bar', NavigationBar); 