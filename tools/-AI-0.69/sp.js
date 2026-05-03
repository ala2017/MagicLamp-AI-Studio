// 获取DOM元素
const frequentBookmarksContainer = document.getElementById('frequentBookmarks');
const unvisitedBookmarksContainer = document.getElementById('unvisitedBookmarks');
const themeToggle = document.getElementById('themeToggle');
const langToggle = document.getElementById('langToggle');
const settings = document.getElementById('settings');
const homeBtn = document.getElementById('homeBtn');
const checkBtn = document.getElementById('checkBtn');
const duplicateBtn = document.getElementById('duplicateBtn');
const aiAssistant = document.getElementById('aiAssistant');
const randomBookmark = document.getElementById('randomBookmark');
const totalBookmarksElement = document.getElementById('totalBookmarks');
const totalFoldersElement = document.getElementById('totalFolders');

// 检测浏览器类型 - 使用不同的变量名避免冲突
const isMicrosoftEdge = navigator.userAgent.includes('Edg');
const browserAPI = isMicrosoftEdge ? chrome : chrome;  // Edge使用chrome命名空间

// 添加调试日志函数
function logDebug(message, data) {
    console.log(`[神灯AI书签管理器] ${message}`, data || '');
}

// 图标加载器类
class IconLoader {
    static cache = new Map();
    static defaultIcon = '../../assets/icons/bookmark.svg';
    static iconSize = 64; // 默认图标大小
    
    // 从缓存中获取图标
    static getFromCache(domain) {
        return this.cache.get(domain);
    }
    
    // 将图标保存到缓存
    static saveToCache(domain, iconUrl) {
        this.cache.set(domain, iconUrl);
    }
    
    // 获取网站图标
    static async getFavicon(url) {
        try {
            // 1. 解析域名
            const domain = new URL(url).hostname;
            if (!domain) {
                return this.defaultIcon;
            }
            
            // 2. 检查缓存
            const cachedIcon = this.getFromCache(domain);
            if (cachedIcon) {
                return cachedIcon;
            }
            
            // 3. 使用 Chrome 扩展 API 获取图标
            try {
                const iconUrl = await new Promise((resolve) => {
                    browserAPI.tabs.create(
                        { 
                            url: url, 
                            active: false 
                        }, 
                        (tab) => {
                            // 获取图标后立即关闭标签页
                            browserAPI.tabs.remove(tab.id);
                            
                            // 如果有高清图标就使用高清图标
                            if (tab.favIconUrl) {
                                resolve(tab.favIconUrl);
                            } else {
                                // 使用 Google Favicon 服务作为备选
                                resolve(`https://www.google.com/s2/favicons?domain=${domain}&sz=128`);
                            }
                        }
                    );
                });
                
                // 保存到缓存
                if (iconUrl) {
                    this.saveToCache(domain, iconUrl);
                    return iconUrl;
                }
            } catch (e) {
                console.warn('使用 Chrome API 获取图标失败:', e);
            }
            
            // 4. 如果 Chrome API 获取失败，使用 Google Favicon 服务
            const googleIconUrl = `https://www.google.com/s2/favicons?domain=${domain}&sz=128`;
            this.saveToCache(domain, googleIconUrl);
            return googleIconUrl;
            
        } catch (e) {
            console.warn('获取图标出错:', e);
            return this.defaultIcon;
        }
    }
}

// 改进 favicon 处理
class FaviconLoader {
    static defaultIcon = '../../assets/icons/bookmark.svg';
    static cache = new Map();
    
    static async getFavicon(url) {
        return IconLoader.getFavicon(url);
    }
}

// 创建书签卡片
function createBookmarkCard(bookmark) {
    logDebug('创建书签卡片', bookmark);
    
    const card = document.createElement('div');
    card.className = 'bookmark-card';
    
    const icon = document.createElement('img');
    icon.className = 'bookmark-icon';
    icon.src = FaviconLoader.defaultIcon;
    
    // 异步加载图标
    if (bookmark.url) {
        FaviconLoader.getFavicon(bookmark.url)
            .then(iconUrl => {
                icon.src = iconUrl;
            })
            .catch(() => {
                icon.src = FaviconLoader.defaultIcon;
            });
    }
    
    icon.alt = '';
    
    const info = document.createElement('div');
    info.className = 'bookmark-info';
    
    const title = document.createElement('div');
    title.className = 'bookmark-title';
    title.textContent = bookmark.title || '未命名书签';
    
    const visitCount = document.createElement('div');
    visitCount.className = 'visit-count';
    
    // 根据访问次数或最后访问时间设置不同的显示
    if (bookmark.visitCount !== undefined) {
        visitCount.textContent = `访问 ${bookmark.visitCount} 次`;
    } else if (bookmark.lastVisitTime) {
        const days = Math.floor((Date.now() - bookmark.lastVisitTime) / (1000 * 60 * 60 * 24));
        visitCount.textContent = `${days} 天未访问`;
    } else {
        visitCount.textContent = '从未访问';
    }
    
    card.appendChild(icon);
    info.appendChild(title);
    info.appendChild(visitCount);
    card.appendChild(info);
    
    // 添加点击事件
    card.addEventListener('click', () => {
        if (bookmark.url) {
            browserAPI.tabs.create({ url: bookmark.url });
        }
    });
    
    return card;
}

// 创建字母图标
function createLetterIcon(imgElement) {
    const letter = imgElement.getAttribute('data-letter');
    if (!letter) {
        imgElement.src = '../../assets/icons/bookmark.svg';
        return;
    }
    
    // 创建字母图标的canvas
    const canvas = document.createElement('canvas');
    canvas.width = 32;
    canvas.height = 32;
    const ctx = canvas.getContext('2d');
    
    // 绘制背景
    ctx.fillStyle = getRandomColor(letter);
    ctx.fillRect(0, 0, 32, 32);
    
    // 绘制文字
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 20px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(letter, 16, 16);
    
    // 转换为data URL
    imgElement.src = canvas.toDataURL('image/png');
}

// 生成随机颜色
function getRandomColor(seed) {
    // 使用字符的ASCII码作为种子
    const charCode = seed.charCodeAt(0);
    
    // 预定义的颜色数组
    const colors = [
        '#4285F4', // Google Blue
        '#EA4335', // Google Red
        '#FBBC05', // Google Yellow
        '#34A853', // Google Green
        '#5E35B1', // Deep Purple
        '#1E88E5', // Blue
        '#039BE5', // Light Blue
        '#00ACC1', // Cyan
        '#00897B', // Teal
        '#43A047', // Green
        '#7CB342', // Light Green
        '#C0CA33', // Lime
        '#FDD835', // Yellow
        '#FFB300', // Amber
        '#FB8C00', // Orange
        '#F4511E', // Deep Orange
        '#6D4C41', // Brown
        '#757575', // Grey
        '#546E7A'  // Blue Grey
    ];
    
    // 使用字符码选择颜色
    return colors[charCode % colors.length];
}

// 更新统计数据
function updateStats(bookmarkTreeNodes) {
    let totalBookmarks = 0;
    let totalFolders = 0;
    
    function countItems(node) {
        if (node.url) {
            totalBookmarks++;
        } else if (node.children) {
            if (node.title) { // 根节点没有标题，不计入文件夹数
                totalFolders++;
            }
            node.children.forEach(countItems);
        }
    }
    
    bookmarkTreeNodes.forEach(countItems);
    
    // 更新显示
    if (totalBookmarksElement) {
        totalBookmarksElement.textContent = totalBookmarks;
    }
    if (totalFoldersElement) {
        totalFoldersElement.textContent = totalFolders;
    }
    
    logDebug('统计数据已更新', { bookmarks: totalBookmarks, folders: totalFolders });
}

// 加载常用书签
function loadFrequentBookmarks() {
    logDebug('开始加载常用书签');
    
    if (!frequentBookmarksContainer) {
        console.error('常用书签容器元素未找到!');
        return;
    }
    
    try {
        // 获取所有历史记录，不限制数量以确保获取完整的访问记录
        browserAPI.history.search({ 
            text: '', 
            maxResults: 10000,  // 增加获取数量
            startTime: 0  // 从最早的记录开始
        }, async (historyItems) => {
            logDebug('获取到历史记录', historyItems.length);
            
            // 获取每个URL的详细访问记录
            const urlVisitMap = {};
            for (const item of historyItems) {
                try {
                    const visits = await new Promise((resolve) => {
                        browserAPI.history.getVisits({ url: item.url }, resolve);
                    });
                    urlVisitMap[item.url] = visits.length; // 使用实际的访问次数
                } catch (error) {
                    urlVisitMap[item.url] = item.visitCount || 0;
                }
            }
            
            // 获取所有书签
            browserAPI.bookmarks.getTree((bookmarkTreeNodes) => {
                logDebug('获取到书签树', bookmarkTreeNodes);
                
                // 更新统计数据
                updateStats(bookmarkTreeNodes);
                
                const bookmarks = [];
                
                // 递归遍历书签树
                function processNode(node) {
                    if (node.url) {
                        const visitCount = urlVisitMap[node.url] || 0;
                        bookmarks.push({
                            id: node.id,
                            title: node.title,
                            url: node.url,
                            visitCount: visitCount
                        });
                    }
                    
                    if (node.children) {
                        node.children.forEach(processNode);
                    }
                }
                
                bookmarkTreeNodes.forEach(processNode);
                
                logDebug('处理后的书签总数', bookmarks.length);
                
                // 按访问次数排序
                bookmarks.sort((a, b) => b.visitCount - a.visitCount);
                
                // 显示前12个常用书签
                const frequentBookmarks = bookmarks.slice(0, 12);
                logDebug('常用书签', frequentBookmarks);
                
                // 清空容器
                frequentBookmarksContainer.innerHTML = '';
                
                // 添加书签卡片
                frequentBookmarks.forEach(bookmark => {
                    const card = createBookmarkCard(bookmark);
                    frequentBookmarksContainer.appendChild(card);
                });
                
                logDebug('常用书签加载完成');
            });
        });
    } catch (error) {
        console.error('加载常用书签时出错:', error);
    }
}

// 加载长时间未访问的书签
function loadUnvisitedBookmarks() {
    logDebug('开始加载被冷落的书签');
    
    if (!unvisitedBookmarksContainer) {
        console.error('被冷落书签容器元素未找到!');
        return;
    }
    
    try {
        // 获取所有历史记录，不限制数量以确保获取完整的访问记录
        browserAPI.history.search({ 
            text: '', 
            maxResults: 10000,  // 增加获取数量
            startTime: 0  // 从最早的记录开始
        }, async (historyItems) => {
            logDebug('获取到历史记录', historyItems.length);
            
            // 创建URL到最后访问时间的映射
            const urlLastVisitMap = {};
            for (const item of historyItems) {
                try {
                    const visits = await new Promise((resolve) => {
                        browserAPI.history.getVisits({ url: item.url }, resolve);
                    });
                    // 如果有访问记录，使用最后一次访问的时间
                    if (visits && visits.length > 0) {
                        urlLastVisitMap[item.url] = Math.max(...visits.map(v => v.visitTime));
                    } else {
                        urlLastVisitMap[item.url] = 0; // 从未访问过
                    }
                } catch (error) {
                    urlLastVisitMap[item.url] = item.lastVisitTime || 0;
                }
            }
            
            // 获取所有书签
            browserAPI.bookmarks.getTree((bookmarkTreeNodes) => {
                logDebug('获取到书签树', bookmarkTreeNodes);
                
                const bookmarks = [];
                const now = Date.now();
                
                // 递归遍历书签树
                function processNode(node) {
                    if (node.url) {
                        const lastVisitTime = urlLastVisitMap[node.url] || 0;
                        const daysSinceLastVisit = lastVisitTime ? 
                            Math.floor((now - lastVisitTime) / (1000 * 60 * 60 * 24)) : 
                            Number.MAX_SAFE_INTEGER; // 从未访问过的放在最前面
                        
                        bookmarks.push({
                            id: node.id,
                            title: node.title,
                            url: node.url,
                            lastVisitTime: lastVisitTime,
                            daysSinceLastVisit: daysSinceLastVisit
                        });
                    }
                    
                    if (node.children) {
                        node.children.forEach(processNode);
                    }
                }
                
                bookmarkTreeNodes.forEach(processNode);
                
                logDebug('处理后的书签总数', bookmarks.length);
                
                // 按未访问天数排序（从大到小）
                bookmarks.sort((a, b) => b.daysSinceLastVisit - a.daysSinceLastVisit);
                
                // 显示前12个最长时间未访问的书签
                const unvisitedBookmarks = bookmarks.slice(0, 12);
                logDebug('被冷落书签', unvisitedBookmarks);
                
                // 清空容器
                unvisitedBookmarksContainer.innerHTML = '';
                
                // 添加书签卡片
                unvisitedBookmarks.forEach(bookmark => {
                    const card = createBookmarkCard(bookmark);
                    unvisitedBookmarksContainer.appendChild(card);
                });
                
                logDebug('被冷落书签加载完成');
            });
        });
    } catch (error) {
        console.error('加载被冷落书签时出错:', error);
    }
}

// 随机书签功能
function openRandomBookmark() {
    logDebug('打开随机书签');
    
    try {
        browserAPI.bookmarks.getTree((bookmarkTreeNodes) => {
            const bookmarks = [];
            
            // 递归遍历书签树
            function processNode(node) {
                if (node.url) {
                    bookmarks.push({
                        id: node.id,
                        title: node.title,
                        url: node.url
                    });
                }
                
                if (node.children) {
                    node.children.forEach(processNode);
                }
            }
            
            bookmarkTreeNodes.forEach(processNode);
            
            logDebug('随机书签总数', bookmarks.length);
            
            // 随机选择一个书签
            if (bookmarks.length > 0) {
                const randomIndex = Math.floor(Math.random() * bookmarks.length);
                const randomBookmark = bookmarks[randomIndex];
                
                logDebug('选择的随机书签', randomBookmark);
                
                // 打开随机书签
                browserAPI.tabs.create({ url: randomBookmark.url });
            } else {
                console.warn('没有可用的书签');
            }
        });
    } catch (error) {
        console.error('打开随机书签时出错:', error);
    }
}

// 主题切换功能
function toggleTheme() {
    logDebug('切换主题');
    
    const root = document.documentElement;
    const currentTheme = root.getAttribute('data-theme') || 'dark';
    const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
    
    root.setAttribute('data-theme', newTheme);
    
    // 保存主题设置
    browserAPI.storage.local.set({ theme: newTheme });
    
    logDebug('主题已切换为', newTheme);
}

// 加载保存的主题设置
function loadTheme() {
    logDebug('加载主题设置');
    
    browserAPI.storage.local.get('theme', (result) => {
        if (result.theme) {
            document.documentElement.setAttribute('data-theme', result.theme);
            logDebug('已加载主题', result.theme);
        } else {
            logDebug('未找到保存的主题设置，使用默认主题');
        }
    });
}

// 导航函数
function navigateTo(page) {
    logDebug('导航到页面', page);
    
    switch(page) {
        case 'home':
            window.location.href = './home.html';
            break;
        case 'check':
            window.location.href = '../bookmark-check/link-check.html';
            break;
        case 'duplicate':
            window.location.href = '../duplicate-finder/duplicate.html';
            break;
        case 'ai':
            window.location.href = '../ai-space/cloud-map/cloud-map.html';
            break;
        default:
            console.error('未知的页面:', page);
            return;
    }
}

// 检查DOM元素是否存在
function checkDomElements() {
    logDebug('检查DOM元素');
    
    if (!frequentBookmarksContainer) {
        console.error('常用书签容器元素未找到! ID: frequentBookmarks');
    }
    
    if (!unvisitedBookmarksContainer) {
        console.error('被冷落书签容器元素未找到! ID: unvisitedBookmarks');
    }
    
    if (!themeToggle) {
        console.error('主题切换按钮未找到! ID: themeToggle');
    }
    
    if (!randomBookmark) {
        console.error('随机书签按钮未找到! ID: randomBookmark');
    }
    
    if (!homeBtn) {
        console.error('首页按钮未找到! ID: homeBtn');
    }
    
    if (!checkBtn) {
        console.error('检查链接按钮未找到! ID: checkBtn');
    }
    
    if (!duplicateBtn) {
        console.error('查找重复按钮未找到! ID: duplicateBtn');
    }
    
    if (!aiAssistant) {
        console.error('AI辅助按钮未找到! ID: aiAssistant');
    }
}

// 事件监听器
document.addEventListener('DOMContentLoaded', () => {
    logDebug('DOM加载完成');
    
    // 检查DOM元素
    checkDomElements();
    
    // 加载书签数据
    loadFrequentBookmarks();
    loadUnvisitedBookmarks();
    
    // 加载主题设置
    loadTheme();
    
    // 添加事件监听器
    if (themeToggle) {
        themeToggle.addEventListener('click', toggleTheme);
    }
    
    if (randomBookmark) {
        randomBookmark.addEventListener('click', openRandomBookmark);
    }
    
    // 导航按钮事件
    if (homeBtn) {
        homeBtn.addEventListener('click', () => navigateTo('home'));
    }
    
    if (checkBtn) {
        checkBtn.addEventListener('click', () => navigateTo('check'));
    }
    
    if (duplicateBtn) {
        duplicateBtn.addEventListener('click', () => navigateTo('duplicate'));
    }
    
    if (aiAssistant) {
        aiAssistant.addEventListener('click', () => navigateTo('ai'));
    }
    
    logDebug('事件监听器已添加');
    
    // 测试Chrome API是否可用
    if (typeof chrome !== 'undefined' && chrome.bookmarks) {
        logDebug('Chrome API 可用');
    } else {
        console.error('Chrome API 不可用!');
    }
}); 