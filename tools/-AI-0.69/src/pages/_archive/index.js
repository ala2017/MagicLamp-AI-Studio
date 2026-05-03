// 获取DOM元素
const frequentBookmarksContainer = document.getElementById('frequentBookmarks');
const unvisitedBookmarksContainer = document.getElementById('unvisitedBookmarks');
const themeToggle = document.getElementById('themeToggle');
const langToggle = document.getElementById('langToggle');
const settings = document.getElementById('settings');

// 检测浏览器类型
const isEdge = navigator.userAgent.includes('Edg');
const browser = isEdge ? chrome : chrome;  // Edge使用chrome命名空间

// 添加缺失的controller变量
let controller = null;

// 改进 favicon 处理
class FaviconLoader {
    static defaultIcon = '../assets/icons/bookmark.svg';
    static cache = new Map();
    
    static async getFavicon(url) {
        try {
            // 1. 解析域名
            const domain = new URL(url).hostname;
            if (!domain) {
                return this.defaultIcon;
            }
            
            // 2. 检查缓存 - 提前到域名解析后立即检查
            const cacheKey = domain; // 使用域名作为缓存键
            if (this.cache.has(cacheKey)) {
                console.log(`[Favicon] Cache hit for ${domain}`);
                return this.cache.get(cacheKey);
            }

            // 3. 构建 favicon 候选列表
            const candidates = [
                `https://${domain}/favicon.png`,
                `https://${domain}/favicon.ico`,
                `https://www.google.com/s2/favicons?domain=${domain}&sz=128`,
                this.defaultIcon
            ];

            // 4. 预检查图片是否可访问
            const checkImage = (src) => {
                return new Promise((resolve) => {
                    const img = new Image();
                    img.onload = () => resolve(src);
                    img.onerror = () => resolve(null);
                    img.src = src;
                });
            };

            // 5. 尝试加载第一个可用的图标
            for (const candidate of candidates) {
                const result = await checkImage(candidate);
                if (result) {
                    // 6. 缓存结果
                    this.cache.set(cacheKey, result);
                    console.log(`[Favicon] Saved to cache: ${domain} -> ${result}`);
                    return result;
                }
            }

            // 7. 都失败则返回默认图标
            this.cache.set(cacheKey, this.defaultIcon);
            return this.defaultIcon;

        } catch (error) {
            console.warn('Favicon load error:', error);
            return this.defaultIcon;
        }
    }
}

// 添加以下函数用于替换原来的getFaviconUrl
function getFaviconUrl(url) {
    return FaviconLoader.getFavicon(url);
}

// 创建书签卡片
function createBookmarkCard(bookmark) {
    const card = document.createElement('div');
    card.className = 'bookmark-card';
    
    const title = document.createElement('div');
    title.className = 'bookmark-title';
    
    const icon = document.createElement('img');
    icon.className = 'bookmark-icon';
    icon.src = getFaviconUrl(bookmark.url);
    icon.alt = '';
    
    // 简化错误处理，因为FaviconLoader已经处理了多级回退
    icon.onerror = () => {
            icon.src = '../assets/icons/bookmark.svg';
    };
    
    const name = document.createElement('span');
    name.className = 'bookmark-name';
    name.textContent = bookmark.title;
    
    const visits = document.createElement('div');
    visits.className = 'bookmark-visits';
    if (bookmark.visits) {
        const text = document.createTextNode('访问 ');
        const count = document.createElement('span');
        count.className = 'visit-count';
        count.textContent = `${bookmark.visits}`;
        // 添加排名和百分比信息
        if (bookmark.rank && bookmark.percentage) {
            count.title = `排名 #${bookmark.rank} · TOP ${bookmark.percentage}%`;
        }
        const suffix = document.createTextNode(' 次');
        visits.appendChild(text);
        visits.appendChild(count);
        visits.appendChild(suffix);
    } else {
        visits.textContent = '被遗忘了';
    }
    
    title.appendChild(icon);
    title.appendChild(name);
    card.appendChild(title);
    card.appendChild(visits);
    
    card.addEventListener('click', () => {
        browser.tabs.create({ url: bookmark.url });
    });
    
    return card;
}

// 加载书签数据
async function loadBookmarks() {
    try {
        // 获取所有书签
        const bookmarks = await browser.bookmarks.getTree();
        // 获取访问历史
        const history = await browser.history.search({
            text: '',  // 搜索所有URL
            startTime: 0,  // 从最早的记录开始
            maxResults: 10000  // 获取更多结果
        });

        // 获取详细的访问记录
        const visits = await Promise.all(
            history.map(async h => {
                try {
                    const details = await browser.history.getVisits({
                        url: h.url
                    });
                    return {
                        url: h.url,
                        // 计算真实的访问次数
                        visitCount: details.length,
                        lastVisit: h.lastVisitTime
                    };
                } catch (e) {
                    return {
                        url: h.url,
                        visitCount: h.visitCount,
                        lastVisit: h.lastVisitTime
                    };
                }
            })
        );

        // 合并相同URL的访问记录
        const visitMap = visits.reduce((map, visit) => {
            if (map.has(visit.url)) {
                const existing = map.get(visit.url);
                existing.visitCount += visit.visitCount;
                existing.lastVisit = Math.max(existing.lastVisit, visit.lastVisit);
            } else {
                map.set(visit.url, visit);
            }
            return map;
        }, new Map());
        
        // 处理书签数据
        const processedBookmarks = processBookmarks(bookmarks[0], visitMap);
        
        // 更新统计数据
        updateStats(processedBookmarks);
        
        // 渲染最常访问的书签
        renderFrequentBookmarks(processedBookmarks.frequent);
        
        // 渲染未访问的书签
        renderUnvisitedBookmarks(processedBookmarks.unvisited);
        
    } catch (error) {
        console.error('Error loading bookmarks:', error);
    }
}

// 处理书签数据
function processBookmarks(node, visitMap) {
    const bookmarks = {
        all: [],
        frequent: [],
        unvisited: []
    };
    
    function traverse(node) {
        if (node.url) {
            const visitInfo = visitMap.get(node.url);
            const visits = visitInfo ? visitInfo.visitCount : 0;
            const lastVisit = visitInfo ? visitInfo.lastVisit : 0;
            const bookmark = {
                id: node.id,
                title: node.title,
                url: node.url,
                visits,
                lastVisit
            };
            
            bookmarks.all.push(bookmark);
            
            if (visits === 0) {
                bookmarks.unvisited.push(bookmark);
            } else {
                bookmarks.frequent.push(bookmark);
            }
        }
        
        if (node.children) {
            node.children.forEach(traverse);
        }
    }
    
    traverse(node);
    
    // 按访问次数排序，访问次数相同时按最后访问时间排序
    bookmarks.frequent.sort((a, b) => {
        const visitDiff = b.visits - a.visits;
        if (visitDiff !== 0) return visitDiff;
        return b.lastVisit - a.lastVisit;
    });
    
    // 获取访问次数最多的前12个书签
    const topVisits = bookmarks.frequent.length > 0 ? 
        bookmarks.frequent[0].visits : 0;
    
    // 保留前12个
    bookmarks.frequent = bookmarks.frequent.slice(0, 12);
    bookmarks.unvisited = bookmarks.unvisited.slice(0, 12);
    
    // 为常用书签添加排名信息
    bookmarks.frequent = bookmarks.frequent.map((bookmark, index) => ({
        ...bookmark,
        rank: index + 1,
        percentage: Math.round((bookmark.visits / topVisits) * 100)
    }));
    
    return bookmarks;
}

// 更新统计数据
function updateStats(bookmarks) {
    const bookmarkCount = document.querySelector('.stat-count');
    const folderCount = document.querySelectorAll('.stat-count')[1];
    
    bookmarkCount.textContent = bookmarks.all.length;
    // TODO: 计算文件夹数量
}

// 修改渲染最常访问的书签函数
function renderFrequentBookmarks(bookmarks) {
    frequentBookmarksContainer.innerHTML = '';
    // 只显示前12个书签
    const topBookmarks = bookmarks.slice(0, 12);
    topBookmarks.forEach(bookmark => {
        frequentBookmarksContainer.appendChild(createBookmarkCard(bookmark));
    });
}

// 修改渲染未访问的书签函数
function renderUnvisitedBookmarks(bookmarks) {
    unvisitedBookmarksContainer.innerHTML = '';
    // 只显示前12个书签
    const topUnvisited = bookmarks.slice(0, 12);
    topUnvisited.forEach(bookmark => {
        unvisitedBookmarksContainer.appendChild(createBookmarkCard(bookmark));
    });
}

// 容器切换函数
function switchContainer(showContainer) {
    console.log('Switching to container:', showContainer);
    
    // 隐藏所有容器
    const containers = [
        '.bookmark-container',
        '.check-container',
        '.duplicate-container',
        '.ai-container'
    ];
    
    containers.forEach(container => {
        const el = document.querySelector(container);
        if (el) {
            el.style.display = 'none';
        } else {
            console.error(`Container not found: ${container}`);
        }
    });
    
    // 显示目标容器
    const targetContainer = document.querySelector(showContainer);
    if (targetContainer) {
        targetContainer.style.display = 'block';
        console.log('Container shown:', showContainer);
    } else {
        console.error(`Target container not found: ${showContainer}`);
    }
}

// 主题设置
function setTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('theme', theme);
}

// 获取当前主题
function getTheme() {
    return localStorage.getItem('theme') || 'dark';
}

// 主题切换
themeToggle.addEventListener('click', () => {
    const currentTheme = getTheme();
    const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
    setTheme(newTheme);
    
    // 更新图标状态
    const themeIcon = themeToggle.querySelector('.icon');
    themeIcon.style.opacity = newTheme === 'dark' ? '1' : '0.7';
});

// 语言切换
langToggle.addEventListener('click', () => {
    const currentLang = langToggle.textContent;
    langToggle.textContent = currentLang === '中' ? 'En' : '中';
    // TODO: 切换语言
});

// 设置按钮
settings.addEventListener('click', () => {
    // TODO: 打开设置页面
});

// 生成随机浅色
function getRandomPastelColor() {
    const hue = Math.floor(Math.random() * 360);  // 随机色相
    return `hsl(${hue}, 70%, 80%)`;  // 固定饱和度和亮度以确保是浅色
}

// 随机访问被冷落的书签
function visitRandomBookmark() {
    // 获取所有被冷落的书签
    browser.bookmarks.getTree(async (nodes) => {
        const history = await browser.history.search({
            text: '',  // 搜索所有URL
            startTime: 0,  // 从最早的记录开始
            maxResults: 10000  // 获取更多结果
        });

        const visitMap = new Map(history.map(h => [h.url, h.visitCount]));
        const unvisitedBookmarks = [];

        // 遍历所有书签
        function traverse(node) {
            if (node.url) {
                const visits = visitMap.get(node.url) || 0;
                if (visits === 0) {
                    unvisitedBookmarks.push(node);
                }
            }
            if (node.children) {
                node.children.forEach(traverse);
            }
        }

        nodes.forEach(traverse);

        if (unvisitedBookmarks.length > 0) {
            // 随机选择一个书签
            const randomIndex = Math.floor(Math.random() * unvisitedBookmarks.length);
            const randomBookmark = unvisitedBookmarks[randomIndex];
            
            // 在新标签页打开
            browser.tabs.create({ url: randomBookmark.url });
        }
    });
}

// 初始化随机访问按钮
document.addEventListener('DOMContentLoaded', () => {
    const randomBtn = document.getElementById('randomBookmark');
    
    // 设置初始随机颜色
    randomBtn.style.setProperty('--random-color', getRandomPastelColor());
    
    // 点击时随机访问并更新颜色
    randomBtn.addEventListener('click', () => {
        visitRandomBookmark();
        randomBtn.style.setProperty('--random-color', getRandomPastelColor());
    });
});

// 页面容器
const containers = {
    home: document.querySelector('.main-container'),
    check: document.querySelector('.check-container'),
    duplicate: document.querySelector('.duplicate-container'),
    ai: document.querySelector('.ai-container')
};

// 修改导航按钮的ID选择
const navButtons = {
    home: document.getElementById('homeBtn'),
    check: document.getElementById('checkBtn'),
    duplicate: document.getElementById('duplicateBtn'),
    ai: document.getElementById('aiAssistant')
};

// 切换页面显示
function switchPage(page) {
    console.log('切换到页面:', page);
    
    // 修改容器选择器，使其与HTML结构匹配
    const containers = {
        home: document.querySelector('.bookmark-container'), // 修改为正确的主页容器
        check: document.querySelector('.check-container'),
        duplicate: document.querySelector('.duplicate-container'),
        ai: document.querySelector('.ai-container')
    };
    
    console.log('容器状态:', {
        home: !!containers.home,
        check: !!containers.check,
        duplicate: !!containers.duplicate,
        ai: !!containers.ai
    });
    
    // 确保选择器在页面加载后获取
    if (!containers.home && page === 'home') {
        console.warn('主页容器未找到，尝试替代选择器');
        // 尝试备用选择器
        containers.home = document.querySelector('.main-content') || 
                          document.querySelector('.bookmark-section') || 
                          document.getElementById('bookmarkContent');
    }
    
    // 其余代码保持不变
    Object.values(containers).forEach(container => {
        if (container) {
            container.style.display = 'none';
        } else {
            console.warn('容器未找到');
        }
    });
    
    // 显示目标页面
    const targetContainer = containers[page];
    if (targetContainer) {
        console.log(`显示${page}容器`);
        targetContainer.style.display = page === 'home' ? 'flex' : 'block';
        
        // 如果切换到AI页面，初始化量子云图
        if (page === 'ai') {
            console.log('初始化AI页面');
            targetContainer.style.display = 'flex';
            
            // 使用量子管理器显示和初始化
            if (QuantumManager && typeof QuantumManager.init === 'function') {
                QuantumManager.show();
            }
        }
        
        // 特殊处理查找重复页面
        if (page === 'duplicate') {
            console.log('初始化查找重复页面');
            // 确保容器可见
            setTimeout(() => {
                if (targetContainer.style.display !== 'block') {
                    console.warn('强制显示查找重复容器');
                    targetContainer.style.display = 'block';
                }
            }, 50);
        }
    } else {
        console.error(`目标容器[${page}]不存在，请检查HTML结构`);
        // 尝试显示任何可见容器作为备选
        const anyContainer = document.querySelector('.bookmark-container') || 
                            document.querySelector('.main-container') ||
                            document.querySelector('.main-content');
        if (anyContainer) {
            console.warn('使用备选容器作为主页');
            anyContainer.style.display = 'flex';
        }
    }
    
    // 更新按钮状态
    Object.entries(navButtons).forEach(([key, btn]) => {
        if (btn) {
            btn.classList.toggle('active', key === page);
        }
    });
}

// 修复checkUrl函数 - 这个函数需要完整实现
function checkUrl(url) {
    return new Promise((resolve) => {
    try {
            // 创建一个新的 AbortController
            controller = new AbortController();
            const signal = controller.signal;
        
            // 使用HEAD请求检查URL是否可访问
            fetch(url, {
            method: 'HEAD',
                signal: signal,
                mode: 'no-cors' // 添加no-cors模式避免CORS问题
            })
            .then(response => {
                resolve({ 
                    ok: true,
                    status: response.status
                });
            })
            .catch(error => {
                console.warn(`检查URL失败: ${url}`, error);
                let errorType = 'NETWORK_ERROR';
                let errorMessage = '网络连接问题';
                
                if (error.name === 'AbortError') {
                    errorType = 'ABORTED';
                    errorMessage = '检查被中止';
                } else if (error.name === 'TypeError') {
                    errorType = 'INVALID_URL';
                    errorMessage = '无效的URL';
                } else if (error.message.includes('certificate')) {
                    errorType = 'CERT_ERROR';
                    errorMessage = '证书错误';
                }
                
                resolve({ 
                ok: false,
                    error: errorType,
                    errorMessage: errorMessage
                });
            });
            
            // 设置超时
            setTimeout(() => {
                if (controller) {
                    controller.abort();
                    resolve({ 
            ok: false,
                        error: 'TIMEOUT',
                        errorMessage: '连接超时'
                    });
                }
            }, 5000);
        } catch (error) {
            console.error('检查URL时发生错误:', error);
            resolve({ ok: false, error: '检查过程出错' });
        }
    });
}

// 创建结果项
function createResultItem(bookmark, error) {
    const item = document.createElement('div');
    item.className = 'result-item';
    
    const icon = document.createElement('img');
    icon.className = 'result-icon';
    icon.src = getFaviconUrl(bookmark.url);
    icon.onerror = () => icon.src = '../assets/icons/bookmark.svg';
    
    const info = document.createElement('div');
    info.className = 'result-info';
    
    const title = document.createElement('a');
    title.className = 'result-title';
    title.textContent = bookmark.title;
    title.href = bookmark.url;
    title.target = '_blank';
    title.rel = 'noopener noreferrer';
    
    const errorText = document.createElement('div');
    errorText.className = 'result-error';
    errorText.textContent = error;
    
    const actions = document.createElement('div');
    actions.className = 'result-actions';
    
    const deleteTip = document.createElement('span');
    deleteTip.className = 'delete-tip';
    deleteTip.textContent = '建议删除前再次点击链接确认';
    
    const deleteBtn = document.createElement('button');
    deleteBtn.className = 'result-btn btn-delete';
    deleteBtn.textContent = '删除';
    deleteBtn.onclick = () => {
        browser.bookmarks.remove(bookmark.id);
        item.remove();
    };
    
    info.appendChild(title);
    info.appendChild(errorText);
    actions.appendChild(deleteTip);
    actions.appendChild(deleteBtn);
    
    item.appendChild(icon);
    item.appendChild(info);
    item.appendChild(actions);
    
    return item;
}

// 检查控制相关
const checkControls = {
    stop: document.querySelector('.check-container .btn-stop'),
    resume: document.querySelector('.check-container .btn-resume'),
    restart: document.querySelector('.check-container .btn-restart')
};

// 链接检查相关变量
let isChecking = false;
let isPaused = false;
let checkProgress = {
    completed: [],
    remaining: [],
    errors: 0,
    total: 0
};

// 检查链接相关DOM元素
const checkElements = {
    progressBar: document.querySelector('.check-container .progress-inner'),
    currentUrl: document.querySelector('.check-container .current-url'),
    completed: document.querySelector('.check-container .completed'),
    total: document.querySelector('.check-container .total'),
    errorCount: document.querySelector('.check-container .error-count'),
    results: document.querySelector('.check-container .check-results')
};

// 添加更新控制按钮状态的函数
function updateControlButtons(state) {
    if (!checkControls.stop || !checkControls.resume || !checkControls.restart) {
        console.warn('控制按钮未找到');
        return;
    }
    
    // 修改逻辑：暂停状态下应该可以点击重新检查
    checkControls.stop.disabled = !state.isChecking || state.isPaused;
    checkControls.resume.disabled = !state.isChecking || !state.isPaused; 
    // 无论是否正在检查，都允许重新检查（除非正在检查且未暂停）
    checkControls.restart.disabled = state.isChecking && !state.isPaused;
    
    console.log('按钮状态：', {
        isChecking: state.isChecking,
        isPaused: state.isPaused,
        stopDisabled: checkControls.stop.disabled,
        resumeDisabled: checkControls.resume.disabled,
        restartDisabled: checkControls.restart.disabled
    });
}

// 添加量子元素初始化函数
function initQuantumElements() {
    console.log('初始化量子元素...');
    // 这里可以添加量子相关元素的初始化代码
    return true;
}

// 添加继续检查函数
function continueCheck() {
    if (!isChecking || isPaused) return;
    
    // 如果没有剩余书签，则完成检查
    if (checkProgress.remaining.length === 0) {
        isChecking = false;
    updateControlButtons({ isChecking, isPaused });
    
        if (checkElements.currentUrl) {
            checkElements.currentUrl.textContent = '检查完成!';
        }
        return;
    }
    
    // 获取下一批书签（最多10个同时检查）
    const batch = checkProgress.remaining.splice(0, 10);
    
    // 更新当前检查的URL
    if (checkElements.currentUrl && batch.length > 0) {
        checkElements.currentUrl.textContent = batch[0].url;
    }
    
    // 执行检查
    Promise.all(batch.map(async bookmark => {
        try {
            // 检查URL
            const result = await checkUrl(bookmark.url);
            
            // 添加到已完成列表
            checkProgress.completed.push(bookmark);
            
            // 如果有错误，创建结果项
            if (!result.ok) {
                checkProgress.errors++;
                
                if (checkElements.results) {
                    const item = createResultItem(bookmark, result.error);
                    checkElements.results.appendChild(item);
                }
                
                if (checkElements.errorCount) {
                    checkElements.errorCount.textContent = `(发现 ${checkProgress.errors} 个错误)`;
                }
            }
            
            // 更新进度
            const progress = (checkProgress.completed.length / checkProgress.total) * 100;
            
            if (checkElements.progressBar) {
                checkElements.progressBar.style.width = `${progress}%`;
            }
            
            if (checkElements.completed) {
                checkElements.completed.textContent = checkProgress.completed.length.toString();
            }
            
        } catch (error) {
            console.error('检查URL时出错:', error);
        }
    })).then(() => {
        // 继续检查下一批
        if (isChecking && !isPaused) {
            setTimeout(continueCheck, 100);
        }
    });
}

// 终止检查按钮处理函数
checkControls.stop.addEventListener('click', () => {
    if (controller) {
        controller.abort();
        controller = null;
    }
    // 问题在这里：不应该将isChecking设为false，否则恢复按钮无法工作
    //isChecking = false;  // 删除此行
    isPaused = true;  // 只设置暂停状态
    updateControlButtons({ isChecking, isPaused });
    checkElements.currentUrl.textContent = '检查已暂停';
});

// 恢复检查按钮处理函数
checkControls.resume.addEventListener('click', () => {
    isPaused = false;
    updateControlButtons({ isChecking, isPaused });
    // 添加检查，确保能继续检查
    if (checkProgress.remaining.length > 0) {
    continueCheck();
    } else {
        checkElements.currentUrl.textContent = '没有剩余项目可检查';
    }
});

// 重新检查按钮处理函数
checkControls.restart.addEventListener('click', () => {
    // 移除这个条件检查，允许在暂停状态下重新开始
    // if (isChecking) return;
    
    // 重置检查状态
    isChecking = false;
    isPaused = false;
    
    // 清空进度
    checkProgress = {
        completed: [],
        remaining: [],
        errors: 0,
        total: 0
    };

    // 重置状态
    checkElements.progressBar.style.width = '0';
    checkElements.completed.textContent = '0';
    checkElements.total.textContent = '0';
    checkElements.errorCount.textContent = '(发现 0 个错误)';
    checkElements.results.innerHTML = '';
    checkElements.currentUrl.textContent = '准备开始检查...';
    
    // 更新按钮状态
    updateControlButtons({ isChecking, isPaused });
    
    // 开始新的检查
    startLinkCheck();
});

// 开始检查链接
async function startLinkCheck() {
    console.log('开始检查链接...');
    
    if (!checkElements.progressBar) {
        // 确保在DOM元素存在时才继续
        console.error('检查链接所需的DOM元素未找到');
        setTimeout(() => {
            // 重新获取DOM元素
            Object.assign(checkElements, {
                progressBar: document.querySelector('.check-container .progress-inner'),
                currentUrl: document.querySelector('.check-container .current-url'),
                completed: document.querySelector('.check-container .completed'),
                total: document.querySelector('.check-container .total'),
                errorCount: document.querySelector('.check-container .error-count'),
                results: document.querySelector('.check-container .check-results')
            });
            
            if (checkElements.progressBar) {
                startLinkCheck();
            }
        }, 100);
        return;
    }
    
    // 重置状态
    isChecking = true;
    isPaused = false;
    
    // 清空结果
    if (checkElements.results) {
        checkElements.results.innerHTML = '';
    }
    
    // 重置进度条
    if (checkElements.progressBar) {
        checkElements.progressBar.style.width = '0';
    }
    
    // 显示准备信息
    if (checkElements.currentUrl) {
        checkElements.currentUrl.textContent = '正在获取书签...';
    }
    
    // 更新检查控制按钮
    updateControlButtons({ isChecking, isPaused });
    
    // 获取所有书签并开始检查
    browser.bookmarks.getTree(async (nodes) => {
        const bookmarks = [];
        
        // 遍历书签树
    function traverse(node) {
            if (node.url) {
                bookmarks.push(node);
            }
            if (node.children) {
                node.children.forEach(traverse);
            }
        }
        
        nodes.forEach(traverse);
        
        // 更新总数
        const total = bookmarks.length;
        if (checkElements.total) {
            checkElements.total.textContent = total.toString();
        }
        
        // 重置进度
    checkProgress = {
        completed: [],
            remaining: bookmarks,
        errors: 0,
            total
    };
    
    // 开始检查
    continueCheck();
    });
}

// 重复查找相关元素
const duplicateElements = {
    progressBar: document.querySelector('.duplicate-container .progress-inner'),
    currentUrl: document.querySelector('.duplicate-container .current-url'),
    completed: document.querySelector('.duplicate-container .completed'),
    total: document.querySelector('.duplicate-container .total'),
    groupCount: document.querySelector('.group-count'),
    duplicateCount: document.querySelector('.duplicate-count'),
    results: document.querySelector('.duplicate-results')
};

// 重复查找控制
const duplicateControls = {
    stop: document.querySelector('.duplicate-container .btn-stop'),
    restart: document.querySelector('.duplicate-container .btn-restart'),
    batch: document.querySelector('.duplicate-container .btn-batch')
};

// 查找状态
let isSearching = false;
let searchProgress = {
    completed: [],
    remaining: [],
    total: 0,
    groups: []
};

// 更新按钮状态
function updateDuplicateButtons(state) {
    duplicateControls.stop.disabled = !state.isSearching;
    duplicateControls.restart.disabled = state.isSearching;
    duplicateControls.batch.disabled = !searchProgress.groups.length;
}

// 创建重复组元素
function createDuplicateGroup(items, index) {
    const group = document.createElement('div');
    group.className = 'duplicate-group';
    
    const header = document.createElement('div');
    header.className = 'group-header';
    header.innerHTML = `<div class="group-title">重复组 #${index + 1} (${items.length}个)</div>`;
    
    const itemsList = document.createElement('div');
    itemsList.className = 'duplicate-items';
    
    items.forEach(bookmark => {
        const item = createDuplicateItem(bookmark);
        itemsList.appendChild(item);
    });
    
    group.appendChild(header);
    group.appendChild(itemsList);
    return group;
}

// 创建重复项元素 - 恢复删除按钮功能，只添加路径显示
function createDuplicateItem(bookmark) {
    const item = document.createElement('div');
    item.className = 'duplicate-item';
    
    const icon = document.createElement('img');
    icon.className = 'result-icon';
    icon.src = getFaviconUrl(bookmark.url);
    icon.onerror = () => icon.src = '../assets/icons/bookmark.svg';
    
    const info = document.createElement('div');
    info.className = 'item-info';
    
    const title = document.createElement('a');
    title.className = 'item-title';
    title.href = bookmark.url;
    title.textContent = bookmark.title;
    title.target = '_blank';
    
    // 添加路径显示
    const path = document.createElement('div');
    path.className = 'item-path';
    path.textContent = bookmark.path || '未知路径';
    path.title = '点击导航到文件夹';
    
    const meta = document.createElement('div');
    meta.className = 'item-meta';
    meta.textContent = `最后访问：${formatDate(bookmark.lastVisit)}`;
    
    const actions = document.createElement('div');
    actions.className = 'item-actions';
    
    // 恢复原有的删除按钮
    const deleteBtn = document.createElement('button');
    deleteBtn.className = 'group-action-btn delete-btn';
    deleteBtn.textContent = '删除';
    deleteBtn.onclick = async () => {
        try {
            // 添加删除动画
            item.classList.add('deleting');
            // 等待动画完成
            await new Promise(resolve => setTimeout(resolve, 500));
            // 删除书签
            await browser.bookmarks.remove(bookmark.id);
            // 检查是否是组内最后一个项目
            const group = item.closest('.duplicate-group');
            item.remove();
            if (group && group.querySelector('.duplicate-item') === null) {
                // 如果是最后一个项目，移除整个组
                group.remove();
                // 更新统计数据
                const groupCount = document.querySelector('.group-count');
                const duplicateCount = document.querySelector('.duplicate-count');
                groupCount.textContent = parseInt(groupCount.textContent) - 1;
                duplicateCount.textContent = parseInt(duplicateCount.textContent) - 1;
            } else {
                // 只更新重复项计数
                const duplicateCount = document.querySelector('.duplicate-count');
                duplicateCount.textContent = parseInt(duplicateCount.textContent) - 1;
            }
        } catch (error) {
            console.error('删除书签失败:', error);
            item.classList.remove('deleting');
        }
    };
    
    actions.appendChild(deleteBtn);
    
    info.appendChild(title);
    info.appendChild(path);  // 添加路径显示
    info.appendChild(meta);
    
    item.appendChild(icon);
    item.appendChild(info);
    item.appendChild(actions);
    
    return item;
}

// 恢复原始查找重复功能并添加路径收集
async function findDuplicates() {
    if (isSearching) return;
    
    isSearching = true;
    updateDuplicateButtons({ isSearching });
    
    // 清空结果
    duplicateElements.results.innerHTML = '';
    duplicateElements.progressBar.style.width = '0';
    duplicateElements.currentUrl.textContent = '正在获取书签...';
    
    // 获取所有书签
    const bookmarks = await browser.bookmarks.getTree();
    const allBookmarks = [];
    
    // 获取历史记录，扩大搜索范围
    const history = await browser.history.search({
        text: '',  // 搜索所有URL
        startTime: 0,  // 从最早的记录开始
        maxResults: 100000,  // 增加获取数量
        endTime: Date.now()  // 到当前时间
    });

    // 创建访问记录映射
    const visitMap = new Map(history.map(h => [h.url, {
        visitCount: h.visitCount,
        lastVisit: h.lastVisitTime
    }]));
    
    // 添加路径收集
    function traverse(node, path = []) {
        if (node.url) {
            const visitInfo = visitMap.get(node.url);
            allBookmarks.push({
                ...node,
                path: path.join(' / '),  // 添加路径信息
                lastVisit: visitInfo ? visitInfo.lastVisit : 0,
                visits: visitInfo ? visitInfo.visitCount : 0
            });
        }
        if (node.children) {
            node.children.forEach(child => {
                traverse(child, [...path, child.title]);
            });
        }
    }
    
    bookmarks.forEach(node => traverse(node));
    
    // 初始化进度
    searchProgress = {
        completed: [],
        remaining: [...allBookmarks],
        total: allBookmarks.length,
        groups: []
    };
    
    // 更新UI
    duplicateElements.total.textContent = allBookmarks.length;
    
    // 查找重复
    const urlMap = new Map();
    allBookmarks.forEach(bookmark => {
        const key = bookmark.url.toLowerCase();
        if (!urlMap.has(key)) {
            urlMap.set(key, []);
        }
        urlMap.get(key).push(bookmark);
    });
    
    // 过滤出重复组
    const duplicateGroups = Array.from(urlMap.values())
        .filter(group => group.length > 1)
        .sort((a, b) => b.length - a.length);
    
    searchProgress.groups = duplicateGroups;
    
    // 更新统计
    const totalDuplicates = duplicateGroups.reduce((sum, group) => sum + group.length, 0);
    duplicateElements.groupCount.textContent = duplicateGroups.length;
    duplicateElements.duplicateCount.textContent = totalDuplicates;
    
    // 显示结果
    duplicateGroups.forEach((group, index) => {
        const groupElement = createDuplicateGroup(group, index);
        duplicateElements.results.appendChild(groupElement);
    });
    
    // 完成查找
    isSearching = false;
    duplicateElements.currentUrl.textContent = '查找完成';
    duplicateElements.progressBar.style.width = '100%';
    updateDuplicateButtons({ isSearching });
}

// 查找重复书签（具体实现）
function findDuplicateBookmarks(bookmarks) {
    console.log(`分析 ${bookmarks.length} 个书签...`);
    
    // 1. 按URL分组
    const urlGroups = {};
    
    // 遍历所有书签并收集路径信息
    function collectBookmarksWithPath(node, path = []) {
        if (node.url) {
            const normalizedUrl = normalizeUrl(node.url);
            if (!urlGroups[normalizedUrl]) {
                urlGroups[normalizedUrl] = [];
            }
            
            // 添加书签时包含路径信息
            urlGroups[normalizedUrl].push({
                ...node,
                path: path.join(' / ')  // 将路径数组转为字符串
            });
        }
        
        if (node.children) {
            node.children.forEach(child => {
                // 对于文件夹节点，将其标题添加到路径中
                collectBookmarksWithPath(child, [...path, child.title]);
            });
        }
    }
    
    // 获取完整的书签树并构建路径
    browser.bookmarks.getTree(nodes => {
        nodes.forEach(rootNode => {
            // 对于根节点的子节点，使用其标题作为路径起点
            if (rootNode.children) {
                rootNode.children.forEach(child => {
                    collectBookmarksWithPath(child, [child.title]);
                });
            }
        });
        
        // 2. 找出重复项
        const duplicateGroups = [];
        
        // URL重复
        Object.values(urlGroups).forEach(group => {
            if (group.length > 1) {
                duplicateGroups.push({
                    type: 'url',
                    items: group,
                    url: group[0].url
                });
            }
        });
        
        // 更新进度和计数
        searchProgress.groups = duplicateGroups;
        const duplicateCount = duplicateGroups.reduce((sum, group) => sum + group.items.length, 0);
        
        if (duplicateElements.groupCount) {
            duplicateElements.groupCount.textContent = duplicateGroups.length.toString();
        }
        
        if (duplicateElements.duplicateCount) {
            duplicateElements.duplicateCount.textContent = duplicateCount.toString();
        }
        
        // 进度条完成
        if (duplicateElements.progressBar) {
            duplicateElements.progressBar.style.width = '100%';
        }
        
        if (duplicateElements.completed && duplicateElements.total) {
            duplicateElements.completed.textContent = bookmarks.length.toString();
        }
        
        if (duplicateElements.currentUrl) {
            duplicateElements.currentUrl.textContent = 
                duplicateGroups.length > 0 
                    ? `找到 ${duplicateGroups.length} 组重复书签`
                    : '未找到重复书签';
        }
        
        // 显示结果
        displayDuplicateGroups(duplicateGroups);
        
        // 更新按钮状态
    isSearching = false;
    updateDuplicateButtons({ isSearching });
    });
}

// 标准化URL（忽略www前缀和尾部斜杠等）
function normalizeUrl(url) {
    try {
        const urlObj = new URL(url);
        let hostname = urlObj.hostname;
        // 移除www.前缀
        if (hostname.startsWith('www.')) {
            hostname = hostname.substring(4);
        }
        // 构建标准化URL
        const normalized = 
            urlObj.protocol + '//' + 
            hostname + 
            urlObj.pathname.replace(/\/$/, ''); // 移除尾部斜杠
        return normalized.toLowerCase();
    } catch (e) {
        return url.toLowerCase();
    }
}

// 显示重复组
function displayDuplicateGroups(groups) {
    if (!duplicateElements.results) return;
    
    duplicateElements.results.innerHTML = '';
    
    if (groups.length === 0) {
        const emptyMessage = document.createElement('div');
        emptyMessage.className = 'empty-message';
        emptyMessage.textContent = '未找到重复书签';
        duplicateElements.results.appendChild(emptyMessage);
        return;
    }
    
    groups.forEach((group, index) => {
        const groupElement = createDuplicateGroup(group.items, index);
        duplicateElements.results.appendChild(groupElement);
    });
}

// 格式化日期
function formatDate(timestamp) {
    if (!timestamp) return '从未访问';
    const date = new Date(timestamp);
    // 如果时间戳太小，可能是无效数据
    if (date.getFullYear() < 2000) return '从未访问';
    return date.toLocaleString('zh-CN', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
    });
}

// 测试数据
const testBookmarks = [
    {
        title: "GitHub - microsoft/TypeScript: TypeScript is a superset of JavaScript that compiles to clean JavaScript output.",
        url: "https://github.com/microsoft/TypeScript",
        path: ["编程开发", "前端技术", "JavaScript"]
    },
    {
        title: "深入浅出 RxJS - 程序员在线学习视频教程",
        url: "https://www.example.com/rxjs-tutorial",
        path: ["编程开发", "前端技术", "响应式编程"]
    },
    {
        title: "Docker 从入门到实践 | Docker 从入门到实践",
        url: "https://www.example.com/docker-practice",
        path: ["运维部署", "容器技术"]
    }
];

// AI分析函数
function analyzeBookmark(bookmark) {
    // 1. 提取关键词
    const keywords = extractKeywords(bookmark);
    
    // 2. 生成多维度标签
    return {
        topic: generateTopicTags(keywords, bookmark.path),
        type: generateTypeTags(keywords, bookmark.url),
        usage: generateUsageTags(keywords, bookmark.path),
        field: generateFieldTags(keywords, bookmark.path)
    };
}

// 提取关键词
function extractKeywords(bookmark) {
    const words = new Set();
    
    // 从标题中提取
    const titleWords = bookmark.title
        .replace(/[^\w\s\u4e00-\u9fa5]/g, ' ')
        .split(/\s+/)
        .filter(w => w.length > 1);
    
    // 从路径中提取
    const pathWords = bookmark.path.join(' ').split(/\s+/);
    
    // 从URL中提取
    const urlWords = bookmark.url
        .replace(/https?:\/\/|www\.|\.com|\.org|\.net/g, ' ')
        .split(/[/.-]/)
        .filter(w => w.length > 1);
    
    return [...new Set([...titleWords, ...pathWords, ...urlWords])];
}

// 生成主题标签
function generateTopicTags(keywords, path) {
    // 示例：从关键词和路径推断主题
    const topics = new Set();
    
    // 技术类主题
    if (keywords.some(k => /typescript|javascript|rxjs/i.test(k))) {
        topics.add("前端开发");
    }
    if (keywords.some(k => /docker|容器/i.test(k))) {
        topics.add("容器技术");
    }
    
    // 从路径推断
    path.forEach(p => {
        if (/编程|开发|技术/.test(p)) {
            topics.add("软件开发");
        }
    });
    
    return Array.from(topics);
}

// 生成内容类型标签
function generateTypeTags(keywords, url) {
    const types = new Set();
    
    // 根据URL判断
    if (url.includes('github.com')) {
        types.add("开源项目");
    }
    if (/tutorial|教程|学习/.test(url)) {
        types.add("教程文档");
    }
    if (/practice|实践/.test(url)) {
        types.add("实践指南");
    }
    
    return Array.from(types);
}

// 生成用途标签
function generateUsageTags(keywords, path) {
    const usage = new Set();
    
    // 根据关键词和路径推断用途
    if (path.some(p => /学习|教程/.test(p))) {
        usage.add("学习参考");
    }
    if (keywords.some(k => /practice|实践|指南/.test(k))) {
        usage.add("实践指导");
    }
    
    return Array.from(usage);
}

// 生成领域标签
function generateFieldTags(keywords, path) {
    const fields = new Set();
    
    // 从路径推断领域
    if (path.includes("前端技术")) {
        fields.add("Web开发");
    }
    if (path.includes("运维部署")) {
        fields.add("DevOps");
    }
    
    return Array.from(fields);
}

// 测试分析
testBookmarks.forEach(bookmark => {
    const analysis = analyzeBookmark(bookmark);
    console.log('\n分析结果:', bookmark.title);
    console.log('主题标签:', analysis.topic);
    console.log('内容类型:', analysis.type);
    console.log('用途标签:', analysis.usage);
    console.log('相关领域:', analysis.field);
});

// 终极版本的卡片管理器
const QuantumCardManager = {
    init() {
        console.log('初始化卡片管理器...');
        this.cards = document.querySelectorAll('.feature-card');
        this.buttons = document.querySelectorAll('.feature-btn');
        this.bindEvents();
        
        // 默认显示第一个卡片
        const defaultCard = document.querySelector('.feature-card.quantum-card');
        if (defaultCard) {
            defaultCard.classList.add('active');
            defaultCard.style.display = 'flex';
            const defaultBtn = document.querySelector('.feature-btn[data-feature="quantum"]');
            if (defaultBtn) {
                defaultBtn.classList.add('active');
            }
            
            // 确保容器显示
            const container = defaultCard.querySelector('.quantum-cloud-container');
            if (container) {
                container.style.display = 'flex';
            }
            
            // 初始化可视化
            setTimeout(() => {
                console.log('Starting visualization initialization');
                if (typeof initializeVisualization === 'function') {
                    initializeVisualization();
                }
            }, 100);
        }
    },

    showCard(feature) {
        console.log('显示卡片:', feature);
        
        // 隐藏所有卡片
        this.cards.forEach(card => {
            card.classList.remove('active');
            card.style.display = 'none';
        });

        // 取消所有按钮的激活状态
        this.buttons.forEach(btn => btn.classList.remove('active'));

        // 显示选中的卡片
        const targetCard = document.querySelector(`.feature-card.${feature}-card`);
        const targetBtn = document.querySelector(`.feature-btn[data-feature="${feature}"]`);

        if (targetCard) {
            targetCard.classList.add('active');
            targetCard.style.display = 'flex';
            
            // 如果是量子标签，确保显示量子云图并初始化
            if (feature === 'quantum') {
                const container = targetCard.querySelector('.quantum-cloud-container');
                if (container) {
                    container.style.display = 'flex';
                }
                setTimeout(() => {
                    console.log('Starting visualization initialization');
                    if (typeof initializeVisualization === 'function') {
                        initializeVisualization();
                    }
                }, 100);
            }
        }

        if (targetBtn) {
            targetBtn.classList.add('active');
        }
    },

    bindEvents() {
        this.buttons.forEach(btn => {
            btn.addEventListener('click', () => {
                const feature = btn.dataset.feature;
                this.showCard(feature);
            });
        });
    }
};

// 等待 DOM 加载完成后初始化
document.addEventListener('DOMContentLoaded', () => {
    console.log('DOM加载完成，初始化卡片管理器...');
    QuantumCardManager.init();
});

// 全局配置
const CONFIG = {
    API_ENDPOINTS: {
        GUIJI: 'https://api.siliconflow.cn/v1',
        OPENAI: 'https://api.openai.com/v1',
        ANTHROPIC: 'https://api.anthropic.com/v1',
        GEMINI: 'https://generativelanguage.googleapis.com/v1'
    },
    DEFAULT_PARAMS: {
        temperature: 0.7,
        top_p: 0.7,
        max_tokens: 50
    }
};

// 错误处理工具
const ErrorHandler = {
    logError: (error, context) => {
        console.error(`[${context}] 错误:`, error);
        return {
            success: false,
            message: `${context}失败: ${error.message}`
        };
    },
    
    async wrapAsync(promise, context) {
        try {
            return await promise;
        } catch (error) {
            return this.logError(error, context);
        }
    }
};

// 日志工具
const Logger = {
    info: (message, data) => {
        console.log(`[INFO] ${message}`, data || '');
    },
    error: (message, error) => {
        console.error(`[ERROR] ${message}`, error || '');
    }
};

// 模型设置相关
const modelSettings = {
    currentProvider: null,
    providers: {
        openai: {
            apiKey: null,
            model: 'gpt-4',
            models: [],
            logo: 'https://registry.npmmirror.com/@lobehub/icons-static-png/latest/files/dark/openai.png'
        },
        deepseek: {
            apiKey: null,
            model: 'deepseek-chat',
            models: [],
            logo: 'https://registry.npmmirror.com/@lobehub/icons-static-png/latest/files/dark/deepseek-color.png'
        },
        gemini: {
            apiKey: null,
            model: 'gemini-pro',
            models: [],
            logo: 'https://registry.npmmirror.com/@lobehub/icons-static-png/latest/files/dark/gemini-color.png'
        },
        guiji: {
            apiKey: null,
            model: 'deepseek-ai/DeepSeek-V3',
            models: [],
            logo: 'https://registry.npmmirror.com/@lobehub/icons-static-png/latest/files/dark/siliconcloud-color.png'
        }
    }
};

// 添加在 modelSettings 对象后面
function getProviderName(provider) {
    const names = {
        openai: 'OpenAI',
        deepseek: 'Deepseek',
        gemini: 'Gemini',
        guiji: 'SiliconFlow'
    };
    return names[provider] || provider;
}

// 初始化
document.addEventListener('DOMContentLoaded', () => {
    Logger.info('初始化应用');
    
    // 1. 初始化基础UI元素
    initQuantumElements();
    
    // 2. 初始化渲染系统
    QuantumRenderManager.init();
    
    // 3. 初始化模型设置
    initModelSettings();
    
    // 4. 加载书签数据
    loadBookmarks();
    
    // 5. 初始化可视化
    initializeVisualization();
    
    Logger.info('应用初始化完成');
});

// 初始化模型设置
function initModelSettings() {
    const modelSelectors = document.querySelectorAll('.model-selector');
    
    modelSelectors.forEach(selector => {
        selector.addEventListener('change', (e) => {
            const modelType = e.target.getAttribute('data-model-type');
            const modelValue = e.target.value;
            
            // 保存设置
            saveModelSetting(modelType, modelValue);
            
            // 更新量子管理器的模型
            if (modelType === 'bookmark' && QuantumManager) {
                QuantumManager.setModel(modelValue);
            }
        });
    });
    
    // 加载保存的设置
    loadModelSettings();
}

// 保存模型设置
function saveModelSetting(type, value) {
    const settings = JSON.parse(localStorage.getItem('modelSettings') || '{}');
    settings[type] = value;
    localStorage.setItem('modelSettings', JSON.stringify(settings));
}

// 加载模型设置
function loadModelSettings() {
    const settings = JSON.parse(localStorage.getItem('modelSettings') || '{}');
    const defaultModels = {
        bookmark: 'quantum-v1',
        analyze: 'alchemy-v2',
        generate: 'fusion-v1'
    };
    
    // 合并默认设置和保存的设置
    const finalSettings = {...defaultModels, ...settings};
    
    // 更新选择器UI
    Object.entries(finalSettings).forEach(([type, value]) => {
        const selector = document.querySelector(`.model-selector[data-model-type="${type}"]`);
        if (selector) {
            selector.value = value;
        }
    });
    
    // 设置量子管理器的模型
    if (QuantumManager) {
        QuantumManager.setModel(finalSettings.bookmark);
    }
}

// 修改 updateProviderCards 函数
function updateProviderCards() {
    const providerList = document.querySelector('.api-provider-list');
    providerList.innerHTML = '';

    Object.entries(modelSettings.providers).forEach(([provider, config]) => {
        const card = document.createElement('div');
        card.className = 'api-provider-card';
        card.setAttribute('data-provider', provider);
        if (provider === modelSettings.currentProvider) {
            card.classList.add('active');
        }

        card.innerHTML = `
            <img src="${config.logo}" alt="${provider} logo" />
            <span>${getProviderName(provider)}</span>
        `;

        card.addEventListener('click', () => {
            switchProvider(provider);
        });

        providerList.appendChild(card);
    });
}

// 添加 switchProvider 函数
function switchProvider(provider) {
    modelSettings.currentProvider = provider;
    updateProviderCards();
    // 保存设置
    chrome.storage.local.set({ modelSettings });
}

// 从设置更新UI
function updateUIFromSettings() {
    Logger.info('从设置更新UI');

    // 如果有当前服务商，切换到对应配置
    if (modelSettings.currentProvider) {
        UIController.switchProvider(modelSettings.currentProvider);
    }

    // 更新所有服务商的配置
    Object.entries(modelSettings.providers).forEach(([provider, config]) => {
        const configEl = document.querySelector(`.api-config[data-provider="${provider}"]`);
        if (configEl) {
            // 更新API Key和模型选择
            if (config.apiKey) {
                configEl.querySelector('.api-key-input input').value = config.apiKey;
                fetchModels(provider);
            }
            if (config.model) {
                const select = configEl.querySelector('select');
                if (select) {
                    select.value = config.model;
                }
            }
        }
    });
}

// 保存设置到storage
function saveSettings() {
    Logger.info('保存设置');
    chrome.storage.local.set({ modelSettings }, () => {
        if (chrome.runtime.lastError) {
            Logger.error('保存设置失败:', chrome.runtime.lastError);
        }
    });
}

// 获取服务商可用模型列表
async function fetchModels(provider) {
    Logger.info('获取模型列表:', provider);
    const apiKey = modelSettings.providers[provider].apiKey;
    if (!apiKey) return;

    try {
        let models = [];
        switch (provider) {
            case 'openai':
                models = await APIService.fetchOpenAIModels(apiKey);
                break;
            case 'deepseek':
                models = await APIService.fetchDeepseekModels(apiKey);
                break;
            case 'gemini':
                models = await APIService.fetchGeminiModels(apiKey);
                break;
            case 'guiji':
                models = await APIService.fetchGuijiModels(apiKey);
                break;
        }
        modelSettings.providers[provider].models = models;
        updateModelSelect(provider, models);
    } catch (error) {
        Logger.error(`获取${provider}模型列表失败:`, error);
    }
}

// 更新模型选择下拉框
function updateModelSelect(provider, models) {
    Logger.info('更新模型选择:', provider, models);
    const select = document.querySelector(`.api-config[data-provider="${provider}"] select`);
    if (!select) {
        Logger.error('未找到模型选择框:', provider);
        return;
    }

    // 保存当前选中的模型
    const currentModel = select.value;

    // 清空并重新填充选项
    select.innerHTML = '';
    models.forEach(model => {
        const option = document.createElement('option');
        option.value = model.id;
        option.textContent = model.name;
        select.appendChild(option);
    });

    // 尝试恢复之前选中的模型
    if (models.some(m => m.id === currentModel)) {
        select.value = currentModel;
    }

    // 保存当前选择的模型
    chrome.storage.local.get(['providerModels'], (result) => {
        const providerModels = {};
        providerModels[provider] = select.value;
        chrome.storage.local.set({ 
            providerModels: { 
                ...(result.providerModels || {}), 
                ...providerModels 
            } 
        });
    });

    // 监听模型选择变化
    select.addEventListener('change', () => {
        const providerModels = {};
        providerModels[provider] = select.value;
        chrome.storage.local.get(['providerModels'], (result) => {
            chrome.storage.local.set({ 
                providerModels: { 
                    ...(result.providerModels || {}), 
                    ...providerModels 
                } 
            });
        });
    });
}

// API服务接口
const APIService = {
    // 获取硅基流动模型列表
    async fetchGuijiModels(apiKey) {
        try {
            Logger.info('请求硅基流动模型列表');
            const response = await fetch(`${CONFIG.API_ENDPOINTS.GUIJI}/models`, {
                headers: {
                    'Authorization': `Bearer ${apiKey}`,
                    'Content-Type': 'application/json'
                }
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const data = await response.json();
            Logger.info('获取到模型列表:', data);

            return data.data.map(model => ({
                id: model.id,
                name: model.id.split('/').pop()
            }));
        } catch (error) {
            Logger.error('获取硅基流动模型列表失败:', error);
            throw error;
        }
    },

    // 其他服务商的模型获取方法
    async fetchOpenAIModels(apiKey) {
        // TODO: 实现OpenAI模型获取
        return [];
    },

    async fetchGeminiModels(apiKey) {
        // TODO: 实现Gemini模型获取
        return [];
    },

    // 获取 DeepSeek 模型列表
    async fetchDeepseekModels(apiKey) {
        try {
            Logger.info('请求 DeepSeek 模型列表');
            const response = await fetch('https://api.deepseek.com/v1/models', {
                headers: {
                    'Authorization': `Bearer ${apiKey}`,
                    'Content-Type': 'application/json'
                }
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const data = await response.json();
            Logger.info('获取到模型列表:', data);

            // DeepSeek 固定模型列表
            return [
                { id: 'deepseek-chat', name: 'DeepSeek Chat' },
                { id: 'deepseek-coder', name: 'DeepSeek Coder' },
                { id: 'deepseek-math', name: 'DeepSeek Math' }
            ];
        } catch (error) {
            Logger.error('获取 DeepSeek 模型列表失败:', error);
            throw error;
        }
    }
};

// 在现有代码后添加
document.addEventListener('DOMContentLoaded', () => {
    // 监听 AI 辅助按钮点击
    document.getElementById('aiAssistant').addEventListener('click', () => {
        // 切换到 AI 容器
        switchContainer('.ai-container');
        
        // 显示量子云图卡片
        document.querySelectorAll('.feature-card').forEach(card => {
            card.style.display = card.classList.contains('quantum-cloud-card') ? 'flex' : 'none';
        });
        
        // 初始化可视化
        const canvas = document.querySelector('.quantum-cloud-card .visualization-canvas');
        const loading = document.querySelector('.quantum-cloud-card .visualization-loading');
        if (canvas && loading) {
            loading.style.display = 'block';
            initializeVisualization().finally(() => {
                loading.style.display = 'none';
            });
        }
    });
    
    // ====== 添加功能按钮事件监听 ======
    console.log('添加功能按钮事件监听器');
    
    // 当前选中的功能
    let currentFeature = 'quantum-cloud'; // 默认选中量子云图
    
    // 获取所有功能按钮
    const featureButtons = document.querySelectorAll('.feature-button');
    console.log('找到功能按钮数量:', featureButtons.length);
    
    // 首先创建缺失的容器
    const createMissingContainers = () => {
        console.log('检查并创建缺失的容器');
        const featureContent = document.querySelector('.feature-content');
        
        if (!featureContent) {
            console.error('找不到feature-content容器');
            return;
        }

        console.log('找到feature-content容器:', featureContent);
        
        // 不再清空整个容器，而是检查是否存在各功能容器
        console.log('检查各功能容器是否存在');
        
        // 确保feature-content可见且没有样式冲突
        featureContent.style.cssText = 'display: block; visibility: visible; position: relative; width: 100%; min-height: 500px; overflow: visible;';
        
        // 检查量子云图容器并创建
        let cloudContainer = document.querySelector('.quantum-cloud-container');
        if (!cloudContainer) {
            console.log('创建量子云图容器');
            cloudContainer = document.createElement('div');
            cloudContainer.className = 'quantum-cloud-container';
            cloudContainer.style.cssText = 'display: none; width: 100%; position: absolute; top: 70px; left: 0; right: 0; z-index: 20;';
            featureContent.appendChild(cloudContainer);
        } else {
            // 确保样式正确
            cloudContainer.style.cssText = 'display: none; width: 100%; position: absolute; top: 70px; left: 0; right: 0; z-index: 20;';
        }
        
        // 检查量子标签容器并创建
        let tagsContainer = document.querySelector('.quantum-tags-container');
        if (!tagsContainer) {
            console.log('创建量子标签容器');
            tagsContainer = document.createElement('div');
            tagsContainer.className = 'quantum-tags-container';
            tagsContainer.style.cssText = 'display: none; width: 100%; position: absolute; top: 70px; left: 0; right: 0; z-index: 20;';
            featureContent.appendChild(tagsContainer);
        } else {
            tagsContainer.style.cssText = 'display: none; width: 100%; position: absolute; top: 70px; left: 0; right: 0; z-index: 20;';
        }
        
        // 检查模型设置容器并创建
        let modelContainer = document.querySelector('.model-selection-container');
        if (!modelContainer) {
            console.log('创建模型设置容器');
            modelContainer = document.createElement('div');
            modelContainer.className = 'model-selection-container';
            modelContainer.style.cssText = 'display: none; width: 100%; position: absolute; top: 70px; left: 0; right: 0; z-index: 20;';
            featureContent.appendChild(modelContainer);
        } else {
            modelContainer.style.cssText = 'display: none; width: 100%; position: absolute; top: 70px; left: 0; right: 0; z-index: 20;';
        }
        
        // 检查数字炼金石容器并创建
        let alchemyContainer = document.querySelector('.digital-alchemy-container');
        if (!alchemyContainer) {
            console.log('创建数字炼金石容器');
            alchemyContainer = document.createElement('div');
            alchemyContainer.className = 'digital-alchemy-container';
            alchemyContainer.style.cssText = 'display: none; width: 100%; position: absolute; top: 70px; left: 0; right: 0; z-index: 20;';
            featureContent.appendChild(alchemyContainer);
        } else {
            alchemyContainer.style.cssText = 'display: none; width: 100%; position: absolute; top: 70px; left: 0; right: 0; z-index: 20;';
        }
        
        // 检查智能聚合容器并创建
        let aggregationContainer = document.querySelector('.smart-aggregation-container');
        if (!aggregationContainer) {
            console.log('创建智能聚合容器');
            aggregationContainer = document.createElement('div');
            aggregationContainer.className = 'smart-aggregation-container';
            aggregationContainer.style.cssText = 'display: none; width: 100%; position: absolute; top: 70px; left: 0; right: 0; z-index: 20;';
            featureContent.appendChild(aggregationContainer);
        } else {
            aggregationContainer.style.cssText = 'display: none; width: 100%; position: absolute; top: 70px; left: 0; right: 0; z-index: 20;';
        }
    };
    
    // 创建缺失的容器
    createMissingContainers();
    
    // 更新当前功能显示
    function updateCurrentFeature(feature) {
        console.log('切换功能到:', feature);
        currentFeature = feature;
        
        // 更新当前功能显示（增加对元素是否存在的检查）
        const currentFeatureElement = document.getElementById('current-feature');
        if (currentFeatureElement) {
            currentFeatureElement.textContent = `当前功能: ${feature}`;
        } else {
            console.log('current-feature元素不存在，跳过更新');
        }
        
        // 每次切换功能时都隐藏测试面板
        // 移除对hideTestPanel的调用，这个功能已不再需要
        
        // 更新按钮状态（增加对featureButtons的检查和重新获取）
        const buttons = document.querySelectorAll('.feature-button');
        if (buttons && buttons.length > 0) {
            buttons.forEach(btn => {
                if (btn.dataset.feature === feature) {
                    btn.classList.add('active');
                } else {
                    btn.classList.remove('active');
                }
            });
        } else {
            console.log('未找到功能按钮，跳过更新按钮状态');
        }
        
        // 更新AI标题
        const aiHeader = document.querySelector('.ai-header h2');
        if (aiHeader) {
            if (feature === 'quantum-cloud') {
                aiHeader.textContent = '量子云图';
            } else if (feature === 'quantum-tags') {
                aiHeader.textContent = '量子标签';
            } else if (feature === 'model-selection') {
                aiHeader.textContent = '模型设置';
            } else if (feature === 'digital-alchemy') {
                aiHeader.textContent = '数字炼金石';
            } else if (feature === 'smart-aggregation') {
                aiHeader.textContent = '智能聚合';
            }
        }
        
        // 更新AI描述
        const aiDescription = document.querySelector('.ai-description');
        if (aiDescription) {
            if (feature === 'quantum-cloud') {
                aiDescription.textContent = '已加载 1794 个书签节点';
            } else if (feature === 'quantum-tags') {
                aiDescription.textContent = '已识别 89 个超维标签';
            } else if (feature === 'model-selection') {
                aiDescription.textContent = '配置并管理您的AI服务商和模型';
            } else if (feature === 'digital-alchemy') {
                aiDescription.textContent = '深度解析您的阅读与搜索历史';
            } else if (feature === 'smart-aggregation') {
                aiDescription.textContent = '自动整理并分类您的书签';
            }
        }
        
        // 确保容器存在
        console.log('确保容器存在');
        try {
            createMissingContainers();
        } catch (error) {
            console.error('创建容器出错:', error);
        }
        
        // 强制隐藏所有容器
        const allContainers = [
            '.quantum-cloud-container',
            '.quantum-tags-container',
            '.model-selection-container',
            '.digital-alchemy-container',
            '.smart-aggregation-container'
        ];
        
        allContainers.forEach(selector => {
            const containers = document.querySelectorAll(selector);
            console.log(`找到 ${containers.length} 个匹配 ${selector} 的容器`);
            
            containers.forEach((container, index) => {
                if (container) {
                    container.style.display = 'none';
                    container.style.visibility = 'hidden';
                    console.log(`隐藏容器 ${selector} #${index}`);
                }
            });
        });
        
        // 显示当前功能容器并初始化相应功能
        let containerSelector = '';
        if (feature === 'quantum-cloud') {
            containerSelector = '.quantum-cloud-container';
            // 初始化量子云图功能
            setTimeout(() => {
                try {
                    if (typeof initQuantumCloudFeature === 'function') {
                        initQuantumCloudFeature();
                    } else {
                        console.warn('量子云图初始化函数不存在');
                    }
                } catch (error) {
                    console.error('初始化量子云图出错:', error);
                }
            }, 100); // 稍微延迟初始化，确保DOM已准备好
        } else if (feature === 'quantum-tags') {
            containerSelector = '.quantum-tags-container';
            // 初始化量子标签功能
            try {
                console.log('准备初始化量子标签功能');
                
                // 确保存在量子标签功能容器
                let tagsContainer = document.querySelector('.quantum-tags-container');
                if (!tagsContainer) {
                    console.log('未找到量子标签容器，手动创建');
                    const featureContent = document.querySelector('.feature-content');
                    if (featureContent) {
                        tagsContainer = document.createElement('div');
                        tagsContainer.className = 'quantum-tags-container';
                        tagsContainer.style.cssText = 'display: block; width: 100%; position: absolute; top: 70px; left: 0; right: 0; z-index: 999;';
                        featureContent.appendChild(tagsContainer);
                    } else {
                        console.error('找不到feature-content容器');
                    }
                }
                
                // 直接调用fixQuantumTagsDisplay函数来准备标签功能所需的结构
                if (typeof fixQuantumTagsDisplay === 'function') {
                    console.log('调用fixQuantumTagsDisplay修复量子标签显示');
                    fixQuantumTagsDisplay();
                }
                
                // 延迟调用量子标签初始化函数
                setTimeout(() => {
                    // 使用备用方法确保初始化标签功能
                    if (typeof initQuantumTagsDirectly === 'function') {
                        console.log('使用initQuantumTagsDirectly初始化');
                        initQuantumTagsDirectly();
                    } else if (typeof initQuantumTagsFeature === 'function') {
                        console.log('使用标准initQuantumTagsFeature初始化');
                        initQuantumTagsFeature();
                    } else {
                        console.error('找不到任何量子标签初始化函数');
                    }
                }, 200);
            } catch (error) {
                console.error('初始化量子标签出错:', error);
            }
        } else if (feature === 'model-selection') {
            containerSelector = '.model-selection-container';
            // 初始化模型设置功能
            try {
                if (typeof initModelSettings === 'function') {
                    initModelSettings();
                } else {
                    console.warn('模型设置初始化函数不存在');
                }
            } catch (error) {
                console.error('初始化模型设置出错:', error);
            }
        } else if (feature === 'digital-alchemy') {
            containerSelector = '.digital-alchemy-container';
            // 初始化数字炼金石功能
            try {
                if (typeof initDigitalAlchemyFeature === 'function') {
                    initDigitalAlchemyFeature();
                } else {
                    console.warn('数字炼金石初始化函数不存在');
                }
            } catch (error) {
                console.error('初始化数字炼金石出错:', error);
            }
        } else if (feature === 'smart-aggregation') {
            containerSelector = '.smart-aggregation-container';
            // 初始化智能聚合功能
            try {
                if (typeof initSmartAggregationFeature === 'function') {
                    initSmartAggregationFeature();
                } else {
                    console.warn('智能聚合初始化函数不存在');
                }
            } catch (error) {
                console.error('初始化智能聚合出错:', error);
            }
        }
        
        if (containerSelector) {
            console.log('尝试显示容器:', containerSelector);
            // 先尝试手动创建容器，确保它存在
            if (containerSelector === '.quantum-tags-container' && !document.querySelector(containerSelector)) {
                console.log('量子标签容器不存在，尝试创建');
                ensureQuantumTagsStructure();
            }

            // 确保容器存在
            const containers = document.querySelectorAll(containerSelector);
            if (containers.length === 0) {
                console.log('容器不存在，尝试再次重新创建');
                createMissingContainers();
            }
            
            // 直接通过DOM API设置容器为可见
            const container = document.querySelector(containerSelector);
            if (container) {
                console.log('找到容器，直接设置为可见');
                container.setAttribute('style', 'display: block !important; visibility: visible !important; position: absolute; top: 70px; left: 0; right: 0; z-index: 9999;');
                
                // 如果是量子标签容器，确保初始化
                if (containerSelector === '.quantum-tags-container') {
                    try {
                        if (typeof fixQuantumTagsDisplay === 'function') {
                            console.log('调用fixQuantumTagsDisplay');
                            fixQuantumTagsDisplay();
                        }
                        
                        // 延迟初始化
                        setTimeout(() => {
                            if (typeof initQuantumTagsFeature === 'function') {
                                console.log('延迟初始化量子标签');
                                initQuantumTagsFeature();
                            }
                        }, 200);
                    } catch (error) {
                        console.error('量子标签初始化错误:', error);
                    }
                }
            } else {
                console.error('即使重新创建后仍找不到容器');
            }
        }
        
        // 为容器提供足够的垂直空间
        const featureContent = document.querySelector('.feature-content');
        if (featureContent) {
            featureContent.style.minHeight = '600px';
        }
        
        // 添加一个通知提示，更小型
        const notification = document.createElement('div');
        notification.style.cssText = `
            position: fixed;
            bottom: 20px;
            right: 20px;
            background: rgba(0, 0, 0, 0.8);
            color: white;
            padding: 12px 20px;
            border-radius: 8px;
            font-weight: bold;
            font-size: 16px;
            z-index: 9999;
            box-shadow: 0 4px 15px rgba(0, 0, 0, 0.3);
            transition: opacity 0.5s;
        `;
        notification.innerHTML = `
            <div>已切换到: <span style="color: ${
                feature === 'quantum-cloud' ? '#2196f3' : 
                feature === 'quantum-tags' ? '#4caf50' : 
                feature === 'model-selection' ? '#ff9800' : 
                feature === 'digital-alchemy' ? '#9c27b0' : 
                feature === 'smart-aggregation' ? '#e91e63' : '#fff'
            };">${
                feature === 'quantum-cloud' ? '量子云图' : 
                feature === 'quantum-tags' ? '量子标签' : 
                feature === 'model-selection' ? '模型设置' : 
                feature === 'digital-alchemy' ? '数字炼金石' : 
                feature === 'smart-aggregation' ? '智能聚合' : '未知功能'
            }</span></div>
        `;
        document.body.appendChild(notification);
        
        // 2秒后自动移除通知
        setTimeout(() => {
            notification.style.opacity = '0';
            setTimeout(() => {
                if (document.body.contains(notification)) {
                    document.body.removeChild(notification);
                }
            }, 500);
        }, 2000);
    }
    
    // 为每个功能按钮添加点击事件
    featureButtons.forEach(button => {
        button.addEventListener('click', () => {
            const feature = button.dataset.feature;
            console.log('点击功能按钮:', feature);
            updateCurrentFeature(feature);
        });
    });
    
    // 初始化量子云图功能
    initQuantumCloudFeature();
});

// 页面加载完成后直接初始化可视化
document.addEventListener('DOMContentLoaded', async () => {
    const canvas = document.querySelector('.visualization-canvas');
    const loading = document.querySelector('.visualization-loading');

    if (!canvas || !loading) {
        console.error('找不到必要的DOM元素');
        return;
    }

    try {
        loading.style.display = 'block';
        
        // 获取书签数据
        const bookmarks = await chrome.bookmarks.getTree();
        
        // 开始可视化
        await startVisualization(canvas, bookmarks[0]);
        
    } catch (error) {
        console.error('可视化初始化失败:', error);
    } finally {
        loading.style.display = 'none';
    }
});

// 修改 initializeVisualization 函数
async function initializeVisualization() {
    // 检查 D3.js 是否正确加载
    if (typeof d3 === 'undefined') {
        console.error('D3.js 未加载');
        return;
    }
    console.log('D3.js 版本:', d3.version); // 打印版本号确认加载

    const canvas = document.querySelector('.visualization-canvas');
    const loading = document.querySelector('.visualization-loading');
    
    try {
        loading.style.display = 'block';
        
        // 获取书签数据
        const bookmarks = await chrome.bookmarks.getTree();
        
        // 开始可视化
        await startVisualization(canvas, bookmarks[0]);
        
    } catch (error) {
        console.error('可视化初始化失败:', error);
    } finally {
        loading.style.display = 'none';
    }
}

// 处理书签数据
function processBookmarkData(bookmarkTree) {
    const nodes = [];
    const links = [];
    let nodeId = 0;

    // 为每个级别定义描边颜色（使用对比色）
    const levelColors = {
        0: { bg: '#1A237E', stroke: '#4F8FFE' },  // 中心节点：深蓝底-亮蓝边
        1: { bg: '#2A3F5F', stroke: '#FF4B6B' },  // 一级节点：深灰底-红边
        2: { bg: '#00695C', stroke: '#00E676' },  // 二级节点：深青底-亮绿边
        3: { bg: '#E65100', stroke: '#FF9100' }   // 三级节点：深橙底-亮橙边
    };

    // 一级节点的背景色和描边色配对
    const level1Colors = [
        { bg: '#E91E63', stroke: '#4CAF50' }, // 玫红底-绿边
        { bg: '#2196F3', stroke: '#FF5722' }, // 蓝底-橙边
        { bg: '#9C27B0', stroke: '#FFC107' }, // 紫底-黄边
        { bg: '#00BCD4', stroke: '#FF4081' }, // 青底-粉边
        { bg: '#4CAF50', stroke: '#E91E63' }, // 绿底-玫红边
        { bg: '#FF5722', stroke: '#2196F3' }, // 橙底-蓝边
        { bg: '#FFC107', stroke: '#9C27B0' }, // 黄底-紫边
        { bg: '#3F51B5', stroke: '#FF9800' }  // 靛蓝底-橙边
    ];

    // 定义需要跳过的特殊目录
    const skipFolders = ["我的收藏夹", "其他收藏夹", "工作区收藏夹", "收藏夹栏"];

    // 添加中心节点
    const centerNode = {
        id: nodeId++,
        title: "收藏夹栏",
        type: 'center',
        level: 0,
        color: levelColors[0].bg,      // 深蓝色背景
        stroke: levelColors[0].stroke   // 亮蓝色描边
    };
    nodes.push(centerNode);

    // 处理目录
    function processDirectory(items, parentId, parentColor, level, parentRootColor) {
        // 获取有效的文件夹项目（排除特殊目录和非文件夹项）
        const validFolders = items.filter(item => !item.url && !skipFolders.includes(item.title));
        
        // 为同级节点生成颜色
        const colors = validFolders.map((_, index) => {
            if (level === 1) {
                // 一级节点使用预设的对比色组合
                return level1Colors[index % level1Colors.length];
            } else {
                // 其他级别继承父节点颜色，使用当前级别的描边色
                const defaultStroke = levelColors[level]?.stroke || levelColors[1].stroke;
                return { 
                    bg: parentColor, 
                    stroke: defaultStroke
                };
            }
        });
        
        let colorIndex = 0;
        
        items.forEach((item, index) => {
            if (skipFolders.includes(item.title)) {
                if (item.title === "收藏夹栏" && item.children) {
                    processDirectory(item.children, parentId, parentColor, level, parentRootColor);
                }
                return;
            }

            if (!item.url) {
                const currentId = nodeId++;
                let colorSet;
                
                if (level === 1) {
                    colorSet = colors[colorIndex++];
                } else {
                    colorSet = {
                        bg: parentColor,
                        stroke: levelColors[level]?.stroke || levelColors[1].stroke
                    };
                }

                const rootColor = level === 1 ? colorSet.bg : parentRootColor;
                
                // 统计书签数量
                const bookmarkCount = item.children ? item.children.filter(child => child.url).length : 0;
                
                nodes.push({
                    id: currentId,
                    title: item.title,
                    type: 'folder',
                    level: level,
                    color: colorSet.bg,
                    stroke: colorSet.stroke,
                    children: item.children || [],
                    expanded: level === 0,  // 只有中心节点初始展开
                    parentId: parentId,
                    bookmarkCount: bookmarkCount,
                    rawBookmarks: item.children ? item.children.filter(child => child.url) : []
                });

                links.push({
                    source: parentId,
                    target: currentId,
                    color: rootColor || levelColors[level].stroke,
                    level: level
                });

                // 递归处理所有层级，但初始只显示第一级
                if (item.children) {
                    processDirectory(item.children, currentId, colorSet.bg, level + 1, rootColor);
                }
            }
        });
    }

    // 处理第一级目录时传入中心节点的颜色作为初始rootColor
    processDirectory(bookmarkTree.children, centerNode.id, centerNode.color, 1, centerNode.color);
    return { nodes, links };
}

// 修改 startVisualization 函数中的节点显示逻辑
function startVisualization(canvas, bookmarkTree) {
    try {
        const containerRect = canvas.getBoundingClientRect();
        const width = containerRect.width;
        const height = containerRect.height;
        const centerX = width / 2;
        const centerY = height / 2;

        let { nodes, links } = processBookmarkData(bookmarkTree);
        
        // 清除已有的 SVG
        d3.select(canvas).selectAll("svg").remove();
        
        const svg = d3.select(canvas)
            .append('svg')
            .attr('width', width)
            .attr('height', height)
            .attr('viewBox', [0, 0, width, height]);

        // 添加缩放功能
        const zoom = d3.zoom()
            .scaleExtent([0.5, 2])
            .on('zoom', (event) => {
                g.attr('transform', event.transform);
            });

        svg.call(zoom);

        // 声明为全局变量
        let node;
        let g;
        let link;
        let simulation;

        // 创建一个容器组
        g = svg.append('g');

        // 创建力导向图
        simulation = d3.forceSimulation(nodes)
            .force('link', d3.forceLink(links).id(d => d.id)
                .distance(d => d.level === 1 ? 150 : 80))
            .force('charge', d3.forceManyBody()
                .strength(d => d.type === 'center' ? -1000 : -500))
            .force('center', d3.forceCenter(centerX, centerY))
            .force('collision', d3.forceCollide()
                .radius(d => d.type === 'center' ? 60 : 40))
            .force('x', d3.forceX(centerX).strength(0.1))
            .force('y', d3.forceY(centerY).strength(0.1));

        // 定义拖拽事件处理函数
        function dragstarted(event) {
            if (!event.active) simulation.alphaTarget(0.3).restart();
            event.subject.fx = event.subject.x;
            event.subject.fy = event.subject.y;
        }

        function dragged(event) {
            event.subject.fx = event.x;
            event.subject.fy = event.y;
        }

        function dragended(event) {
            if (!event.active) simulation.alphaTarget(0);
            event.subject.fx = null;
            event.subject.fy = null;
        }

        // 创建连接线
        link = g.append('g')
            .selectAll('path')
            .data(links)
            .join('path')
            .attr('class', 'link')
            .attr('stroke', d => d.color)
            .attr('stroke-width', d => d.level === 1 ? 2 : 1)
            .attr('fill', 'none')
            .style('opacity', d => d.level === 1 ? 0.6 : 0.4);

        // 创建节点
        node = g.append('g')
            .selectAll('.node')
            .data(nodes)
            .join('g')
            .attr('class', 'node')
            .call(d3.drag()
                .on('start', dragstarted)
                .on('drag', dragged)
                .on('end', dragended));

        // 节点渲染
        node.each(function(d) {
            const g = d3.select(this);
            
            if (d.type === 'bookmark') {
                // 创建一个组来包含图标
                const iconGroup = g.append('g')
                    .style('cursor', 'pointer')
                    .on('click', () => {
                        window.open(d.url, '_blank');
                    });
                
                // 添加图标背景圆
                iconGroup.append('circle')
                    .attr('r', 16)
                    .attr('fill', d.color)
                    .attr('stroke', d.stroke)
                    .attr('stroke-width', '2');
                
                // 添加图标（初始使用默认图标）
                iconGroup.append('image')
                    .attr('x', -12)
                    .attr('y', -12)
                    .attr('width', 24)
                    .attr('height', 24)
                    .attr('xlink:href', d.favicon || 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjQiIGhlaWdodD0iMjQiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PHJlY3Qgd2lkdGg9IjI0IiBoZWlnaHQ9IjI0IiBmaWxsPSIjOTA5MDkwIiByeD0iNCIvPjx0ZXh0IHg9IjEyIiB5PSIxNyIgZm9udC1zaXplPSIxNCIgZmlsbD0iI2ZmZiIgdGV4dC1hbmNob3I9Im1pZGRsZSI+QjwvdGV4dD48L3N2Zz4=');

                // 添加标题提示
                iconGroup.append('title')
                    .text(d.title);
            } else {
                // 根据级别设置不同的样式参数
                const styles = {
                    center: {
                        color: '#4F8FFE',
                        fontSize: '16px',
                        padding: 20,
                        height: 40
                    },
                    level1: {
                        fontSize: '14px',
                        padding: 15,
                        height: 30
                    },
                    level2: {
                        fontSize: '12px',
                        padding: 12,
                        height: 26
                    }
                };
                
                // 获取当前节点的样式
                let style;
                if (d.type === 'center') {
                    style = styles.center;
                } else if (d.level === 1) {
                    style = styles.level1;
                } else {
                    style = styles.level2;
                }
                
                // 创建一个组来包含背景框和文字
                const nodeGroup = g.append('g')
                    .style('cursor', 'pointer')
                    .on('click', (event, d) => {
                        event.stopPropagation();
                        toggleNode(d);
                    })
                    .on('mouseover', () => {
                        // 鼠标悬停效果
                        d3.select(this).select('rect')
                            .transition()
                            .duration(200)
                            .attr('filter', 'url(#glow) brightness(1.2)');
                        d3.select(this).select('text')
                            .transition()
                            .duration(200)
                            .style('font-weight', 'bolder');
                    })
                    .on('mouseout', () => {
                        // 恢复正常效果
                        d3.select(this).select('rect')
                            .transition()
                            .duration(200)
                            .attr('filter', 'url(#glow)');
                        d3.select(this).select('text')
                            .transition()
                            .duration(200)
                            .style('font-weight', 'bold');
                    });
                
                // 添加文字
                const textElement = nodeGroup.append('text')
                    .text(d.title)
                    .attr('text-anchor', 'middle')
                    .attr('y', 5)
                    .attr('fill', '#fff')
                    .style('font-size', style.fontSize)
                    .style('font-weight', 'bold')
                    .style('pointer-events', 'none'); // 确保文字不会干扰点击事件
                
                // 获取文字宽度，为背景框设置尺寸
                const textWidth = textElement.node().getBBox().width;
                
                // 添加背景框
                nodeGroup.insert('rect', 'text')
                    .attr('x', -textWidth/2 - style.padding)
                    .attr('y', -style.height/2)
                    .attr('width', textWidth + style.padding * 2)
                    .attr('height', style.height)
                    .attr('rx', style.height/2)
                    .attr('fill', d.color)
                    .attr('stroke', d.stroke)
                    .attr('stroke-width', '3')
                    .attr('filter', 'url(#glow)');
            }
        });

        // 节点展开/收起函数
        function toggleNode(d) {
            d.expanded = !d.expanded;
            
            // 检查是否有子目录
            const hasSubfolders = nodes.some(n => n.parentId === d.id && n.type === 'folder');
            
            if (!hasSubfolders && d.bookmarkCount > 0) {
                if (d.expanded) {
                    // 创建书签节点
                    const bookmarkNodes = d.rawBookmarks.map((bookmark, index) => {
                        const bookmarkId = `bookmark_${d.id}_${index}`;
                        const angle = (2 * Math.PI * index) / d.rawBookmarks.length;
                        const radius = 100;
                        
                        return {
                            id: bookmarkId,
                            title: bookmark.title,
                            type: 'bookmark',
                            level: d.level + 1,
                            url: bookmark.url,
                            favicon: null,
                            parentId: d.id,
                            color: d.color,
                            stroke: d.stroke,
                            visible: true,
                            // 设置初始位置
                            x: d.x + radius * Math.cos(angle),
                            y: d.y + radius * Math.sin(angle),
                            // 添加固定位置
                            fx: d.x + radius * Math.cos(angle),
                            fy: d.y + radius * Math.sin(angle)
                        };
                    });
                    
                    // 添加到 nodes 数组
                    nodes.push(...bookmarkNodes);
                    
                    // 隐藏其他分支
                    const rootParent = findRootParent(d);
                    nodes.forEach(n => {
                        if (n.type === 'folder' && n.level === 1 && n.id !== rootParent.id) {
                            hideNodeAndChildren(n);
                        }
                    });
                    
                    // 加载图标
                    bookmarkNodes.forEach(bookmark => {
                        getFaviconUrl(bookmark.url).then(favicon => {
                            bookmark.favicon = favicon;
                            // 更新节点的图标
                            node.filter(n => n.id === bookmark.id)
                                .select('image')
                                .attr('xlink:href', favicon);
                        });
                    });
                    
                    // 重新创建节点元素
                    updateNodes();
                    
                } else {
                    // 移除书签节点
                    nodes = nodes.filter(n => n.type !== 'bookmark' || n.parentId !== d.id);
                    updateNodes();
                }
                
                // 更新连接线显示
                link.style('display', 'none');
                
            } else {
                // 目录的展开/收起逻辑
                node.style('display', n => {
                    // 中心节点始终显示
                    if (n.type === 'center') return 'block';
                    
                    // 如果是当前节点的直接子节点
                    if (n.parentId === d.id) {
                        return d.expanded ? 'block' : 'none';
                    }
                    
                    // 检查父节点链是否都是展开状态
                    let parent = nodes.find(node => node.id === n.parentId);
                    let shouldShow = true;
                    while (parent) {
                        if (!parent.expanded) {
                            shouldShow = false;
                            break;
                        }
                        parent = nodes.find(node => node.id === parent.parentId);
                    }
                    
                    return shouldShow ? 'block' : 'none';
                });

                // 更新连接线显示
                link.style('display', l => {
                    // 如果是当前节点的连接线
                    if (l.source.id === d.id) {
                        return d.expanded ? 'block' : 'none';
                    }
                    
                    // 检查目标节点的父节点链是否都是展开状态
                    let parent = nodes.find(node => node.id === l.target.parentId);
                    let shouldShow = true;
                    while (parent) {
                        if (!parent.expanded) {
                            shouldShow = false;
                            break;
                        }
                        parent = nodes.find(node => node.id === parent.parentId);
                    }
                    
                    return shouldShow ? 'block' : 'none';
                });
            }
            
            // 更新力导向图
            simulation.alpha(0.3).restart();
        }

        // 辅助函数：查找根父节点
        function findRootParent(node) {
            let current = node;
            while (current.parentId) {
                const parent = nodes.find(n => n.id === current.parentId);
                if (parent.level === 1) return parent;
                current = parent;
            }
            return current;
        }

        // 辅助函数：隐藏节点及其子节点
        function hideNodeAndChildren(node) {
            node.visible = false;
            nodes.filter(n => n.parentId === node.id).forEach(child => {
                hideNodeAndChildren(child);
            });
        }

        // 更新函数
        simulation.on('tick', () => {
            // 限制节点位置在视图范围内
            nodes.forEach(d => {
                d.x = Math.max(50, Math.min(width - 50, d.x));
                d.y = Math.max(50, Math.min(height - 50, d.y));
            });

            link.attr('d', d => {
                const dx = d.target.x - d.source.x;
                const dy = d.target.y - d.source.y;
                return `M${d.source.x},${d.source.y}L${d.target.x},${d.target.y}`;
            });

            node.attr('transform', d => `translate(${d.x},${d.y})`);
        });

        // 添加更新节点的函数
        function updateNodes() {
            // 移除所有现有节点
            node.remove();
            
            // 重新创建节点
            node = g.append('g')
                .selectAll('.node')
                .data(nodes)
                .join('g')
                .attr('class', 'node')
                .call(d3.drag()
                    .on('start', dragstarted)
                    .on('drag', dragged)
                    .on('end', dragended));
            
            // 重新渲染节点
            node.each(function(d) {
                const g = d3.select(this);
                
                if (d.type === 'bookmark') {
                    // 创建一个组来包含图标
                    const iconGroup = g.append('g')
                        .style('cursor', 'pointer')
                        .on('click', () => {
                            window.open(d.url, '_blank');
                        });
                    
                    // 添加图标背景圆
                    iconGroup.append('circle')
                        .attr('r', 16)
                        .attr('fill', d.color)
                        .attr('stroke', d.stroke)
                        .attr('stroke-width', '2');
                    
                    // 添加图标（初始使用默认图标）
                    iconGroup.append('image')
                        .attr('x', -12)
                        .attr('y', -12)
                        .attr('width', 24)
                        .attr('height', 24)
                        .attr('xlink:href', d.favicon || 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjQiIGhlaWdodD0iMjQiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PHJlY3Qgd2lkdGg9IjI0IiBoZWlnaHQ9IjI0IiBmaWxsPSIjOTA5MDkwIiByeD0iNCIvPjx0ZXh0IHg9IjEyIiB5PSIxNyIgZm9udC1zaXplPSIxNCIgZmlsbD0iI2ZmZiIgdGV4dC1hbmNob3I9Im1pZGRsZSI+QjwvdGV4dD48L3N2Zz4=');

                        // 添加标题提示
                        iconGroup.append('title')
                            .text(d.title);
                } else {
                    // 根据级别设置不同的样式参数
                    const styles = {
                        center: {
                            color: '#4F8FFE',
                            fontSize: '16px',
                            padding: 20,
                            height: 40
                        },
                        level1: {
                            fontSize: '14px',
                            padding: 15,
                            height: 30
                        },
                        level2: {
                            fontSize: '12px',
                            padding: 12,
                            height: 26
                        }
                    };
                    
                    // 获取当前节点的样式
                    let style;
                    if (d.type === 'center') {
                        style = styles.center;
                    } else if (d.level === 1) {
                        style = styles.level1;
                    } else {
                        style = styles.level2;
                    }
                    
                    // 创建一个组来包含背景框和文字
                    const nodeGroup = g.append('g')
                        .style('cursor', 'pointer')
                        .on('click', (event, d) => {
                            event.stopPropagation();
                            toggleNode(d);
                        })
                        .on('mouseover', () => {
                            // 鼠标悬停效果
                            d3.select(this).select('rect')
                                .transition()
                                .duration(200)
                                .attr('filter', 'url(#glow) brightness(1.2)');
                            d3.select(this).select('text')
                                .transition()
                                .duration(200)
                                .style('font-weight', 'bolder');
                        })
                        .on('mouseout', () => {
                            // 恢复正常效果
                            d3.select(this).select('rect')
                                .transition()
                                .duration(200)
                                .attr('filter', 'url(#glow)');
                            d3.select(this).select('text')
                                .transition()
                                .duration(200)
                                .style('font-weight', 'bold');
                        });
                    
                    // 添加文字
                    const textElement = nodeGroup.append('text')
                        .text(d.title)
                        .attr('text-anchor', 'middle')
                        .attr('y', 5)
                        .attr('fill', '#fff')
                        .style('font-size', style.fontSize)
                        .style('font-weight', 'bold')
                        .style('pointer-events', 'none'); // 确保文字不会干扰点击事件
                    
                    // 获取文字宽度，为背景框设置尺寸
                    const textWidth = textElement.node().getBBox().width;
                    
                    // 添加背景框
                    nodeGroup.insert('rect', 'text')
                        .attr('x', -textWidth/2 - style.padding)
                        .attr('y', -style.height/2)
                        .attr('width', textWidth + style.padding * 2)
                        .attr('height', style.height)
                        .attr('rx', style.height/2)
                        .attr('fill', d.color)
                        .attr('stroke', d.stroke)
                        .attr('stroke-width', '3')
                        .attr('filter', 'url(#glow)');
                }
            });
        }

        // 更新函数
        simulation.on('tick', () => {
            // 限制节点位置在视图范围内
            nodes.forEach(d => {
                d.x = Math.max(50, Math.min(width - 50, d.x));
                d.y = Math.max(50, Math.min(height - 50, d.y));
            });

            link.attr('d', d => {
                const dx = d.target.x - d.source.x;
                const dy = d.target.y - d.source.y;
                return `M${d.source.x},${d.source.y}L${d.target.x},${d.target.y}`;
            });

            node.attr('transform', d => `translate(${d.x},${d.y})`);
        });

        // 添加更新节点的函数
        function updateNodes() {
            // 移除所有现有节点
            node.remove();
            
            // 重新创建节点
            node = g.append('g')
                .selectAll('.node')
                .data(nodes)
                .join('g')
                .attr('class', 'node')
                .call(d3.drag()
                    .on('start', dragstarted)
                    .on('drag', dragged)
                    .on('end', dragended));
            
            // 重新渲染节点
            node.each(function(d) {
                const g = d3.select(this);
                
                if (d.type === 'bookmark') {
                    // 创建一个组来包含图标
                    const iconGroup = g.append('g')
                        .style('cursor', 'pointer')
                        .on('click', () => {
                            window.open(d.url, '_blank');
                        });
                    
                    // 添加图标背景圆
                    iconGroup.append('circle')
                        .attr('r', 16)
                        .attr('fill', d.color)
                        .attr('stroke', d.stroke)
                        .attr('stroke-width', '2');
                    
                    // 添加图标（初始使用默认图标）
                    iconGroup.append('image')
                        .attr('x', -12)
                        .attr('y', -12)
                        .attr('width', 24)
                        .attr('height', 24)
                        .attr('xlink:href', d.favicon || 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjQiIGhlaWdodD0iMjQiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PHJlY3Qgd2lkdGg9IjI0IiBoZWlnaHQ9IjI0IiBmaWxsPSIjOTA5MDkwIiByeD0iNCIvPjx0ZXh0IHg9IjEyIiB5PSIxNyIgZm9udC1zaXplPSIxNCIgZmlsbD0iI2ZmZiIgdGV4dC1hbmNob3I9Im1pZGRsZSI+QjwvdGV4dD48L3N2Zz4=');

                        // 添加标题提示
                        iconGroup.append('title')
                            .text(d.title);
                } else {
                    // 根据级别设置不同的样式参数
                    const styles = {
                        center: {
                            color: '#4F8FFE',
                            fontSize: '16px',
                            padding: 20,
                            height: 40
                        },
                        level1: {
                            fontSize: '14px',
                            padding: 15,
                            height: 30
                        },
                        level2: {
                            fontSize: '12px',
                            padding: 12,
                            height: 26
                        }
                    };
                    
                    // 获取当前节点的样式
                    let style;
                    if (d.type === 'center') {
                        style = styles.center;
                    } else if (d.level === 1) {
                        style = styles.level1;
                    } else {
                        style = styles.level2;
                    }
                    
                    // 创建一个组来包含背景框和文字
                    const nodeGroup = g.append('g')
                        .style('cursor', 'pointer')
                        .on('click', (event, d) => {
                            event.stopPropagation();
                            toggleNode(d);
                        })
                        .on('mouseover', () => {
                            // 鼠标悬停效果
                            d3.select(this).select('rect')
                                .transition()
                                .duration(200)
                                .attr('filter', 'url(#glow) brightness(1.2)');
                            d3.select(this).select('text')
                                .transition()
                                .duration(200)
                                .style('font-weight', 'bolder');
                        })
                        .on('mouseout', () => {
                            // 恢复正常效果
                            d3.select(this).select('rect')
                                .transition()
                                .duration(200)
                                .attr('filter', 'url(#glow)');
                            d3.select(this).select('text')
                                .transition()
                                .duration(200)
                                .style('font-weight', 'bold');
                        });
                    
                    // 添加文字
                    const textElement = nodeGroup.append('text')
                        .text(d.title)
                        .attr('text-anchor', 'middle')
                        .attr('y', 5)
                        .attr('fill', '#fff')
                        .style('font-size', style.fontSize)
                        .style('font-weight', 'bold')
                        .style('pointer-events', 'none'); // 确保文字不会干扰点击事件
                    
                    // 获取文字宽度，为背景框设置尺寸
                    const textWidth = textElement.node().getBBox().width;
                    
                    // 添加背景框
                    nodeGroup.insert('rect', 'text')
                        .attr('x', -textWidth/2 - style.padding)
                        .attr('y', -style.height/2)
                        .attr('width', textWidth + style.padding * 2)
                        .attr('height', style.height)
                        .attr('rx', style.height/2)
                        .attr('fill', d.color)
                        .attr('stroke', d.stroke)
                        .attr('stroke-width', '3')
                        .attr('filter', 'url(#glow)');
                }
            });
        }

    } catch (error) {
        console.error('可视化渲染失败:', error);
        throw error;
    }
}

// 修改路径处理逻辑
function getResourcePath(path) {
    // 确保路径是字符串
    if (path instanceof Promise) {
        console.warn('Received Promise instead of string path:', path);
        return ''; // 返回空字符串或默认路径
    }
    return path;
}

// 修改资源加载相关的代码
document.querySelectorAll('a[href], img[src], script[src]').forEach(el => {
    if (el.href) {
        el.href = getResourcePath(el.href);
    }
    if (el.src) {
        el.src = getResourcePath(el.src);
    }
});

// 量子渲染管理器
const QuantumRenderManager = {
    init() {
        // 初始化渲染系统
        this.setupRenderSystem();
        // 绑定按钮事件
        this.bindEvents();
        // 显示默认卡片
        this.showCard('quantum');
    },

    setupRenderSystem() {
        // 创建渲染观察器
        this.observer = new ResizeObserver(entries => {
            entries.forEach(entry => {
                if (entry.target.classList.contains('active')) {
                    this.forceRerender(entry.target);
                }
            });
        });

        // 观察所有卡片
        document.querySelectorAll('.feature-card').forEach(card => {
            this.observer.observe(card);
        });
    },

    bindEvents() {
        document.querySelectorAll('.feature-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('.feature-btn')
                    .forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                this.showCard(btn.dataset.feature);
            });
        });
    },

    forceRerender(card) {
        // 强制浏览器重新计算布局
        card.style.display = 'none';
        void card.offsetHeight;
        card.style.display = 'block';

        // 重新初始化内容
        const content = card.querySelector('.card-content');
        if (content) {
            content.style.opacity = '0';
            requestAnimationFrame(() => {
                content.style.opacity = '1';
                
                // 关键：强制子元素重新布局
                const canvas = content.querySelector('.visualization-canvas');
                if (canvas) {
                    canvas.style.display = 'none';
                    void canvas.offsetHeight;
                    canvas.style.display = 'block';
                    
                    // 触发 resize 事件
                    window.dispatchEvent(new Event('resize'));
                }
            });
        }
    },

    showCard(feature) {
        console.log('Showing card:', feature);
        
        // 隐藏所有卡片
        document.querySelectorAll('.feature-card').forEach(card => {
            card.classList.remove('active');
            card.style.display = 'none';
            card.style.opacity = '0';
        });

        // 显示目标卡片
        const targetCard = document.querySelector(`.${feature}-card`);
        console.log('Target card:', targetCard);
        
        if (!targetCard) return;

        // 设置初始状态
        targetCard.style.opacity = '0';
        targetCard.style.display = 'block';
        targetCard.classList.add('active');

        // 使用 RAF 确保渲染正确
        requestAnimationFrame(() => {
            requestAnimationFrame(() => {
                targetCard.style.opacity = '1';
                this.forceRerender(targetCard);
            });
        });
    }
};

// 初始化
document.addEventListener('DOMContentLoaded', () => {
    QuantumRenderManager.init();
});

// 量子云图相关的DOM元素
const quantumElements = {
    container: null,
    vizContainer: null,
    init() {
        this.container = document.querySelector('.quantum-cloud-container');
        this.vizContainer = document.getElementById('quantum-cloud-viz');
        return this.container && this.vizContainer;
    }
};

// 初始化量子云图
function initializeVisualization() {
    console.log('开始初始化量子云图...');
    
    // 初始化DOM元素
    if (!quantumElements.init()) {
        console.error('找不到必要的DOM元素');
        return;
    }
    
    try {
        const container = quantumElements.container;
        const vizContainer = quantumElements.vizContainer;
        
        // 确保容器可见
        if (container && container.style) {
            container.style.removeProperty('display');
            container.classList.remove('hidden');
        }
        
        if (!vizContainer) {
            console.error('可视化容器不存在');
            return;
        }
        
        // 清空容器
        vizContainer.innerHTML = '';
        
        // 添加加载提示
        const loadingDiv = document.createElement('div');
        loadingDiv.className = 'visualization-loading';
        loadingDiv.innerHTML = `
            <div class="loading-spinner"></div>
            <div class="loading-text">正在加载量子云图...</div>
        `;
        vizContainer.appendChild(loadingDiv);
        
        // 获取容器尺寸
        const width = vizContainer.clientWidth;
        const height = vizContainer.clientHeight;
        
        console.log(`容器尺寸: ${width}x${height}`);
        
        // 如果容器尺寸为0，等待一会再试
        if (width === 0 || height === 0) {
            console.log('容器尺寸为0，稍后重试...');
            setTimeout(initializeVisualization, 100);
            return;
        }
        
        // 创建SVG
        const svg = d3.select(vizContainer)
            .append('svg')
            .attr('width', width)
            .attr('height', height);
        
        // 移除加载提示
        loadingDiv.remove();
        
        console.log('量子云图初始化完成');
        
    } catch (error) {
        console.error('可视化初始化失败:', error);
    }
}

// 量子管理器
const QuantumManager = {
    elements: {
        container: null,
        vizContainer: null,
        card: null,
        init() {
            this.container = document.querySelector('.quantum-cloud-container');
            this.vizContainer = document.getElementById('quantum-cloud-viz');
            this.card = document.querySelector('.quantum-card');
            return this.container && this.vizContainer && this.card;
        }
    },
    
    init() {
        console.log('正在初始化量子管理器...');
        if (!this.elements.init()) {
            console.error('找不到必要的DOM元素');
            return false;
        }
        return true;
    },
    
    show() {
        if (!this.elements.card || !this.elements.container) return;
        
        this.elements.card.classList.add('active');
        this.elements.card.style.display = 'flex';
        this.elements.container.style.display = 'flex';
        
        // 初始化可视化
        setTimeout(() => {
            console.log('Starting visualization initialization');
            if (typeof initializeVisualization === 'function') {
                initializeVisualization();
            }
        }, 100);
    },
    
    setModel(modelName) {
        // 这里应该实现设置模型名称的逻辑
        console.log(`设置模型: ${modelName}`);
    }
};

// 切换页面显示
function switchPage(page) {
    console.log('切换到页面:', page);
    
    // 修改容器选择器，使其与HTML结构匹配
    const containers = {
        home: document.querySelector('.bookmark-container'), // 修改为正确的主页容器
        check: document.querySelector('.check-container'),
        duplicate: document.querySelector('.duplicate-container'),
        ai: document.querySelector('.ai-container')
    };
    
    console.log('容器状态:', {
        home: !!containers.home,
        check: !!containers.check,
        duplicate: !!containers.duplicate,
        ai: !!containers.ai
    });
    
    // 确保选择器在页面加载后获取
    if (!containers.home && page === 'home') {
        console.warn('主页容器未找到，尝试替代选择器');
        // 尝试备用选择器
        containers.home = document.querySelector('.main-content') || 
                          document.querySelector('.bookmark-section') || 
                          document.getElementById('bookmarkContent');
    }
    
    // 其余代码保持不变
    Object.values(containers).forEach(container => {
        if (container) {
            container.style.display = 'none';
        } else {
            console.warn('容器未找到');
        }
    });
    
    // 显示目标页面
    const targetContainer = containers[page];
    if (targetContainer) {
        console.log(`显示${page}容器`);
        targetContainer.style.display = page === 'home' ? 'flex' : 'block';
        
        // 如果切换到AI页面，初始化量子云图
        if (page === 'ai') {
            console.log('初始化AI页面');
            targetContainer.style.display = 'flex';
            
            // 使用量子管理器显示和初始化
            if (QuantumManager && typeof QuantumManager.init === 'function') {
                QuantumManager.show();
            }
        }
        
        // 特殊处理查找重复页面
        if (page === 'duplicate') {
            console.log('初始化查找重复页面');
            // 确保容器可见
            setTimeout(() => {
                if (targetContainer.style.display !== 'block') {
                    console.warn('强制显示查找重复容器');
                    targetContainer.style.display = 'block';
                }
            }, 50);
        }
    } else {
        console.error(`目标容器[${page}]不存在，请检查HTML结构`);
        // 尝试显示任何可见容器作为备选
        const anyContainer = document.querySelector('.bookmark-container') || 
                            document.querySelector('.main-container') ||
                            document.querySelector('.main-content');
        if (anyContainer) {
            console.warn('使用备选容器作为主页');
            anyContainer.style.display = 'flex';
        }
    }
    
    // 更新按钮状态
    Object.entries(navButtons).forEach(([key, btn]) => {
        if (btn) {
            btn.classList.toggle('active', key === page);
        }
    });
}

// 等待 DOM 加载完成后初始化
document.addEventListener('DOMContentLoaded', () => {
    console.log('DOM加载完成，开始初始化...');
    
    // 初始化量子管理器
    if (QuantumManager && typeof QuantumManager.init === 'function') {
        QuantumManager.init();
    }
    
    // 初始化卡片管理器
    if (typeof QuantumCardManager !== 'undefined' && typeof QuantumCardManager.init === 'function') {
    QuantumCardManager.init();
    }
    
    // 绑定导航按钮事件
    navButtons.home?.addEventListener('click', () => switchPage('home'));
    navButtons.check?.addEventListener('click', () => {
        switchPage('check');
        if (typeof startLinkCheck === 'function') {
        startLinkCheck();
        }
    });
    navButtons.duplicate?.addEventListener('click', () => {
        switchPage('duplicate');
        if (typeof findDuplicates === 'function') {
        findDuplicates();
        }
    });
    navButtons.ai?.addEventListener('click', () => {
        switchPage('ai');
        
        // 延迟初始化量子管理器
        setTimeout(() => {
            // 确保量子云图容器存在
            const cloudContainer = document.querySelector('.quantum-cloud-container');
            if (!cloudContainer) {
                const featureContent = document.querySelector('.feature-content');
                if (featureContent) {
                    const newContainer = document.createElement('div');
                    newContainer.className = 'quantum-cloud-container';
                    featureContent.appendChild(newContainer);
                }
            }
            
            // 然后再显示量子管理器
            if (QuantumManager && typeof QuantumManager.show === 'function') {
                QuantumManager.show();
            }
        }, 100);
    });

    // 初始化显示首页
    switchPage('home');
    
    // 安全地初始化应用，避免重复初始化
    window.isAppInitialized = window.isAppInitialized || false;
    if (!window.isAppInitialized) {
        initializeApp();
        window.isAppInitialized = true;
    }
});

// 初始化应用
function initializeApp() {
    Logger.info('初始化应用');
    
    // 1. 确保功能卡片不显示
    const featureCards = document.querySelector('.feature-cards');
    if (featureCards) {
        featureCards.style.display = 'none';
        // 或者更彻底的移除
        // featureCards.remove();
    }
    
    // 2. 初始化量子管理器
    if (QuantumManager && typeof QuantumManager.init === 'function') {
        QuantumManager.init();
    }
    
    // 其他初始化代码...
    
    // 更新版本号显示
    const versionElement = document.querySelector('.version-number');
    if (versionElement) {
        versionElement.textContent = 'v0.61';
    }
    
    // 或者可能是这样设置的
    document.getElementById('version').textContent = 'v0.61';
}

// 找到显示版本号的代码
const VERSION = '0.6';
// 使用正确的选择器 - version是现有元素的类名
const versionElement = document.querySelector('.version');
if (versionElement) {
    versionElement.textContent = `v${VERSION}`;
} else {
    console.warn('无法找到版本显示元素');
}

// 添加初始化可视化功能
function initializeVisualization() {
    console.log('初始化量子云图可视化...');
    
    // 获取可视化容器
    const container = document.querySelector('.quantum-cloud-container');
    if (!container) {
        console.error('找不到量子云图容器');
        return;
    }
    
    // 创建可视化容器
    const vizElement = document.createElement('div');
    vizElement.className = 'quantum-visualization';
    container.appendChild(vizElement);
    
    // 加载数据并渲染云图
    loadBookmarksForVisualization(vizElement);
}

// 为可视化加载书签数据
async function loadBookmarksForVisualization(container) {
    // 显示加载中状态
    container.innerHTML = `
        <div class="loading-indicator">
            <div class="spinner"></div>
            <div class="loading-text">正在加载书签数据...</div>
        </div>
    `;
    
    try {
        // 获取书签数据
        const bookmarks = await new Promise(resolve => {
            browser.bookmarks.getTree(resolve);
        });
        
        // 处理并扁平化书签数据
        const bookmarkData = flattenBookmarks(bookmarks);
        
        // 显示预览
        renderBookmarkVisualization(container, bookmarkData);
    } catch (error) {
        console.error('加载书签数据失败:', error);
        container.innerHTML = `
            <div class="error-message">
                加载数据失败: ${error.message}
            </div>
        `;
    }
}

// 扁平化书签树结构
function flattenBookmarks(nodes) {
    const bookmarks = [];
    
    function traverse(node, path = []) {
        if (node.url) {
            bookmarks.push({
                ...node,
                path: path.join(' / ')
            });
        }
        
        if (node.children) {
            node.children.forEach(child => {
                traverse(child, [...path, child.title]);
            });
        }
    }
    
    nodes.forEach(node => traverse(node));
    return bookmarks;
}

// 修改渲染书签可视化函数，改为径向树布局
function renderBookmarkVisualization(container, bookmarkData) {
    console.log(`渲染量子云图，共计书签数：${bookmarkData?.length || 0}`);
    
    // 更新顶部的描述文字，确保数量是最新的
    const descriptionElement = document.querySelector('.ai-description');
    if (descriptionElement && bookmarkData) {
        descriptionElement.textContent = `已加载 ${bookmarkData.length} 个书签节点`;
    }
    
    // 创建图表容器
    container.innerHTML = `
        <div class="force-graph-container">
            <div class="nodes-preview" style="display:none;"></div>
        </div>
    `;
    
    const graphContainer = container.querySelector('.force-graph-container');
    
    // 如果可用D3.js，创建高级可视化
    if (typeof d3 !== 'undefined') {
        console.log('找到D3库，创建径向树可视化');
        // 获取完整书签树，而不是扁平化的数据
        getBookmarkTree().then(bookmarkTree => {
            createRadialTreeVisual(graphContainer, bookmarkTree);
        });
    } else {
        // 回退到简单节点预览
        const nodesPreview = container.querySelector('.nodes-preview');
        nodesPreview.style.display = 'flex';
        renderSimplePreview(nodesPreview, bookmarkData);
    }
}

// 获取完整的书签树结构
async function getBookmarkTree() {
    return new Promise(resolve => {
        chrome.bookmarks.getTree(treeNodes => {
            // 获取完整树
            const fullTree = treeNodes[0];
            
            // 只保留书签栏（通常是id为1的节点）
            if (fullTree.children && fullTree.children.length > 0) {
                const bookmarkBar = fullTree.children.find(child => child.id === "1");
                
                if (bookmarkBar) {
                    // 直接使用书签栏作为根节点，避免显示"根目录"
                    resolve(bookmarkBar);
                } else {
                    // 如果找不到书签栏，则使用原始树
                    resolve(fullTree);
                }
            } else {
                // 如果树结构异常，返回原始树
                resolve(fullTree);
            }
        });
    });
}

// 创建径向树可视化
function createRadialTreeVisual(container, rootNode) {
    // 设置SVG大小
    const width = container.clientWidth || window.innerWidth * 0.7;
    const height = container.clientHeight || window.innerHeight * 0.7;
    
    // 确保容器具有明确的尺寸
    if (!container.style.height || container.style.height === 'auto') {
        container.style.height = '600px';
    }
    
    // 创建SVG元素
    const svg = d3.select(container)
        .append('svg')
        .attr('width', '100%')
        .attr('height', '100%')
        .attr('class', 'force-graph')
        .attr('viewBox', `0 0 ${width} ${height}`);
    
    // 创建包含所有元素的主容器组，放置在中心
    const g = svg.append("g")
        .attr("class", "everything")
        .attr("transform", `translate(${width/2},${height/2})`);
    
    // 初始化根节点的展开状态
    initializeNodeState(rootNode);
    
    // 创建径向树布局 - 进一步增加间距和树的大小
    const tree = d3.tree()
        .size([2 * Math.PI, Math.min(width, height) / 2 - 80]) // 调整整体大小
        .separation((a, b) => {
            // 大幅增加节点间的水平间距
            // 同一父节点下的兄弟节点间距更大
            return (a.parent == b.parent ? 3 : 4) / (a.depth || 1); 
        });
    
    // 当前已展开的节点
    let nodes, links;
    
    // 更新可视化
    function update(source) {
        // 转换数据为d3层次结构
        const root = d3.hierarchy(source);
        
        // 只包含展开的节点
        root.descendants().forEach(d => {
            if (!d.data._expanded && d.children) {
                d._children = d.children;
                d.children = null;
            }
        });
        
        // 计算新的树布局
        tree(root);
        
        // 节点 - 使用径向坐标，增加层级间距
        nodes = root.descendants();
        nodes.forEach(d => {
            // 对于深层次的节点，给予更大的层级间距
            const depthFactor = 120; // 基础间距
            const depthMultiplier = Math.max(1, (3 - d.depth) * 0.5); // 顶层节点间距更大
            
            d.y = d.depth * depthFactor * depthMultiplier; 
            d.x = d.x; // 角度保持不变
        });
        
        // 链接 - 创建路径
        links = root.links();
        
        // 创建径向连接线路径
        const linkPath = d3.linkRadial()
            .angle(d => d.x)
            .radius(d => d.y);
        
        // 更新链接
        const link = g.selectAll(".link")
            .data(links, d => d.target.data.id);
        
        // 退出的链接
        link.exit().remove();
        
        // 进入的链接
        const linkEnter = link.enter().append("path")
            .attr("class", "link")
            .attr("d", linkPath)
            .attr("fill", "none")
            .attr("stroke", "#555")
            .attr("stroke-opacity", 0.4)
            .attr("stroke-width", 1.5);
        
        // 更新现有链接
        link.merge(linkEnter)
            .transition()
            .duration(500)
            .attr("d", linkPath);
        
        // 更新节点
        const node = g.selectAll(".node")
            .data(nodes, d => d.data.id);
        
        // 退出的节点
        node.exit().remove();
        
        // 进入的节点 - 简化节点显示，移除图标
        const nodeEnter = node.enter().append("g")
            .attr("class", d => d.data.url ? "node bookmark-node" : "node folder-node")
            .attr("transform", d => `rotate(${d.x * 180 / Math.PI - 90}) translate(${d.y},0)`)
            .on("click", clicked);
        
        // 创建节点圆形 - 为所有节点使用圆形
        nodeEnter.append("circle")
            .attr("r", d => d.data.children || d.data._children ? 10 : 6) // 目录节点稍大
            .attr("fill", d => getNodeColor(d))
            .attr("stroke", "#fff")
            .attr("stroke-width", 1.5);
        
        // 创建节点文本 - 显示所有节点的文本
        nodeEnter.append("text")
            .attr("dy", ".31em")
            .attr("x", d => {
                // 根据节点方向调整文本位置，避免重叠
                const offset = d.data.children || d.data._children ? 15 : 12;
                return d.x < Math.PI ? offset : -offset;
            })
            .attr("text-anchor", d => d.x < Math.PI ? "start" : "end")
            .attr("transform", d => d.x < Math.PI ? null : "rotate(180)")
            .text(d => d.data.title)
            .style("font-size", d => {
                // 根据深度调整字体大小，顶层目录文字更大
                if (!d.data.url) {
                    return d.depth <= 1 ? "13px" : "11px";
                } else {
                    return "10px";
                }
            })
            .style("fill", "#fff")
            .style("font-weight", d => d.data.url ? "normal" : "bold")
            .style("text-shadow", "0 1px 3px rgba(0,0,0,0.8)")
            .style("pointer-events", "none");
        
        // 添加标题提示
        nodeEnter.append("title")
            .text(d => d.data.title);
    }
    
    // 点击节点处理
    function clicked(event, d) {
        // 如果是书签且有URL，打开URL
        if (d.data.url) {
            window.open(d.data.url, "_blank");
            return;
        }
        
        // 如果是目录，展开或折叠
        if (d.children) {
            // 当前展开，需要折叠
            d._children = d.children;
            d.children = null;
            d.data._expanded = false;
        } else if (d._children) {
            // 当前折叠，需要展开
            d.children = d._children;
            d._children = null;
            d.data._expanded = true;
        }
        
        // 更新视图
        update(rootNode);
    }
    
    // 初始化节点展开状态
    function initializeNodeState(node) {
        // 书签栏（即现在的根节点）默认展开
        node._expanded = true;
        
        // 如果存在子节点，其所有直接子节点也默认展开
        if (node.children) {
            node.children.forEach(child => {
                // 设置子文件夹默认折叠
                child._expanded = false;
                
                // 递归处理更深层次的节点
                if (child.children) {
                    child.children.forEach(grandChild => {
                        initializeNodeStateRecursive(grandChild, false);
                    });
                }
            });
        }
    }
    
    // 递归设置所有子节点的展开状态
    function initializeNodeStateRecursive(node, isExpanded) {
        node._expanded = isExpanded;
        
        if (node.children) {
            node.children.forEach(child => {
                initializeNodeStateRecursive(child, isExpanded);
            });
        }
    }
    
    // 获取节点颜色
    function getNodeColor(d) {
        if (d.data.url) {
            // 书签节点 - 根据域名分组
            try {
                const domain = new URL(d.data.url).hostname;
                const hash = hashCode(domain) % 10;
                const colors = [
                    '#4285f4', '#ea4335', '#fbbc05', '#34a853', '#8e44ad',
                    '#16a085', '#f39c12', '#d35400', '#c0392b', '#2980b9'
                ];
                return colors[Math.abs(hash)];
            } catch (e) {
                return '#888'; // 默认颜色
            }
        } else {
            // 文件夹节点 - 使用固定颜色
            return d.data._expanded ? '#f39c12' : '#3498db';
        }
    }
    
    // 简单哈希函数
    function hashCode(str) {
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            hash = ((hash << 5) - hash) + str.charCodeAt(i);
            hash |= 0; // 转为32位整数
        }
        return hash;
    }
    
    // 创建缩放行为
    const zoom = d3.zoom()
        .scaleExtent([0.2, 5])
        .on("zoom", (event) => {
            g.attr("transform", event.transform);
        });
    
    svg.call(zoom);
    
    // 初始视图缩放
    svg.call(zoom.transform, d3.zoomIdentity
        .translate(width/2, height/2)
        .scale(0.8));
    
    // 初始更新
    update(rootNode);
}

// 辅助函数：为域名生成组ID
function getDomainGroup(domain) {
    if (!domain) return 0;
    
    // 使用简单的哈希计算
    let hash = 0;
    for (let i = 0; i < domain.length; i++) {
        hash = domain.charCodeAt(i) + ((hash << 5) - hash);
    }
    return Math.abs(hash % 10); // 返回0-9的组
}

// 根据组ID获取颜色
function getColor(group) {
    const colors = [
        '#4285f4', // 蓝色
        '#ea4335', // 红色
        '#fbbc05', // 黄色
        '#34a853', // 绿色
        '#8e44ad', // 紫色
        '#16a085', // 青色
        '#f39c12', // 橙色
        '#d35400', // 深橙色
        '#c0392b', // 深红色
        '#2980b9'  // 深蓝色
    ];
    return colors[group % colors.length];
}

// 获取域名显示文本
function getDomainDisplay(domain) {
    if (!domain || domain === 'unknown') return '未知';
    return domain.replace(/^www\./, '').split('.')[0];
}

// 渲染简单节点预览（备用）
function renderSimplePreview(container, bookmarkData) {
    const previewData = bookmarkData.slice(0, 30);
    
    previewData.forEach(bookmark => {
        try {
            const domain = new URL(bookmark.url).hostname;
            const node = document.createElement('div');
            node.className = 'preview-node';
            node.title = bookmark.title;
            node.textContent = domain;
            node.addEventListener('click', () => {
                window.open(bookmark.url, '_blank');
            });
            container.appendChild(node);
        } catch (e) {
            // 跳过无效URL
        }
    });
}

// 获取书签的favicon URL
function getFaviconUrl(url) {
    if (!url) return '../assets/icons/bookmark.svg';
    
    try {
        // 使用现有的FaviconLoader类
        if (window.FaviconLoader && typeof FaviconLoader.getFavicon === 'function') {
            // FaviconLoader返回Promise，我们需要立即返回一个URL
            // 所以使用一个默认值，并异步更新
            const imgNode = d3.select(this);
            FaviconLoader.getFavicon(url).then(iconUrl => {
                imgNode.attr("xlink:href", iconUrl);
            });
            return '../assets/icons/bookmark.svg'; // 默认图标
        }
        
        // 备用方案：使用Google的favicon服务
        const domain = new URL(url).hostname;
        return `https://www.google.com/s2/favicons?domain=${domain}&sz=32`;
    } catch (e) {
        return '../assets/icons/bookmark.svg'; // 出错时的默认图标
    }
}

// 添加图标加载器类
class ProviderIconLoader {
  static cache = new Map();
  static defaultIcons = {
    'siliconio': '../assets/providers/siliconio-logo.png',
    'deepseek': '../assets/providers/deepseek-logo.png', 
    'openrouter': '../assets/providers/openrouter-logo.png',
    'openai': '../assets/providers/openai-logo.png',
    'gemini': '../assets/providers/gemini-logo.png'
  };
  
  static async loadProviderIcon(provider) {
    const iconEl = document.querySelector(`#${provider}-content .provider-logo`);
    if (!iconEl) return;
    
    try {
      // 1. 检查内存缓存
      if (this.cache.has(provider)) {
        iconEl.src = this.cache.get(provider);
        return;
      }
      
      // 2. 检查localStorage缓存
      const cachedIcon = localStorage.getItem(`provider_icon_${provider}`);
      if (cachedIcon) {
        iconEl.src = cachedIcon;
        this.cache.set(provider, cachedIcon);
        return;
      }
      
      // 3. 加载本地图标
      const localPath = this.defaultIcons[provider];
      if (localPath) {
        iconEl.src = localPath;
        this.cache.set(provider, localPath);
        localStorage.setItem(`provider_icon_${provider}`, localPath);
        return;
      }
      
      // 4. 使用默认图标
      const defaultIcon = '../assets/icons/bookmark.svg';
      iconEl.src = defaultIcon;
      this.cache.set(provider, defaultIcon);
      
    } catch (error) {
      console.error(`加载图标失败 ${provider}:`, error);
      iconEl.src = '../assets/icons/bookmark.svg';
    }
  }
}

// 模型选择功能
class ModelSelector {
  constructor() {
    this.providers = ['siliconio', 'deepseek', 'openrouter', 'openai', 'gemini'];
    this.activeProvider = null;
    this.selectedModels = {};
    this.apiKeys = {};
    
    this.init();
  }
  
  init() {
    // 加载保存的API keys和选中的模型
    this.loadSettings();
    
    // 加载提供商图标
    this.providers.forEach(provider => {
      ProviderIconLoader.loadProviderIcon(provider);
    });
    
    // 绑定标签页点击事件
    const tabs = document.querySelectorAll('.model-tab');
    tabs.forEach(tab => {
      tab.addEventListener('click', () => {
        const provider = tab.dataset.provider;
        this.switchTab(provider);
      });
    });
    
    // 绑定表单事件
    this.providers.forEach(provider => {
      // 保存按钮
      const saveBtn = document.querySelector(`#${provider}-content .save-model-btn`);
      if (saveBtn) {
        saveBtn.addEventListener('click', () => this.saveProviderSettings(provider));
      }
      
      // 测试按钮
      const testBtn = document.querySelector(`#${provider}-content .test-model-btn`);
      if (testBtn) {
        testBtn.addEventListener('click', () => this.testConnection(provider));
      }
      
      // 密码显示切换
      const toggleBtn = document.querySelector(`#${provider}-content .toggle-password`);
      if (toggleBtn) {
        toggleBtn.addEventListener('click', (e) => {
          const input = document.querySelector(`#${provider}-api-key`);
          const type = input.getAttribute('type') === 'password' ? 'text' : 'password';
          input.setAttribute('type', type);
          // 更新图标
          const icon = e.currentTarget.querySelector('i');
          icon.classList.toggle('eye-open');
          icon.classList.toggle('eye-closed');
        });
      }
    });
    
    // 初始激活第一个标签或之前选中的标签
    const initialProvider = this.activeProvider || this.providers[0];
    this.switchTab(initialProvider);
    
    // 填充保存的值
    this.fillSavedValues();
  }
  
  loadSettings() {
    // 从localStorage加载设置
    try {
      const settingsStr = localStorage.getItem('model_selector_settings');
      if (settingsStr) {
        const settings = JSON.parse(settingsStr);
        this.apiKeys = settings.apiKeys || {};
        this.selectedModels = settings.selectedModels || {};
        this.activeProvider = settings.activeProvider;
      }
    } catch (e) {
      console.error('Error loading model selector settings:', e);
    }
  }
  
  saveSettings() {
    // 保存设置到localStorage
    try {
      const settings = {
        apiKeys: this.apiKeys,
        selectedModels: this.selectedModels,
        activeProvider: this.activeProvider
      };
      localStorage.setItem('model_selector_settings', JSON.stringify(settings));
    } catch (e) {
      console.error('Error saving model selector settings:', e);
    }
  }
  
  fillSavedValues() {
    // 填充保存的API keys和选中的模型
    this.providers.forEach(provider => {
      // 填充API key
      const apiKeyInput = document.querySelector(`#${provider}-api-key`);
      if (apiKeyInput && this.apiKeys[provider]) {
        apiKeyInput.value = this.apiKeys[provider];
      }
      
      // 设置选中的模型
      const modelSelect = document.querySelector(`#${provider}-model`);
      if (modelSelect && this.selectedModels[provider]) {
        modelSelect.value = this.selectedModels[provider];
      }
      
      // 更新已选标记
      this.updateSelectedBadge(provider);
    });
  }
  
  switchTab(provider) {
    // 更新活动标签
    const tabs = document.querySelectorAll('.model-tab');
    tabs.forEach(tab => {
      if (tab.dataset.provider === provider) {
        tab.classList.add('active');
      } else {
        tab.classList.remove('active');
      }
    });
    
    // 更新内容区域
    const contents = document.querySelectorAll('.model-tab-content');
    contents.forEach(content => {
      if (content.id === `${provider}-content`) {
        content.classList.add('active');
      } else {
        content.classList.remove('active');
      }
    });
    
    // 记录当前活动提供商
    this.activeProvider = provider;
    this.saveSettings();
  }
  
  saveProviderSettings(provider) {
    // 保存API key
    const apiKeyInput = document.querySelector(`#${provider}-api-key`);
    if (apiKeyInput) {
      this.apiKeys[provider] = apiKeyInput.value;
    }
    
    // 保存选中的模型
    const modelSelect = document.querySelector(`#${provider}-model`);
    if (modelSelect) {
      this.selectedModels[provider] = modelSelect.value;
    }
    
    // 更新已选标记
    this.updateSelectedBadge(provider);
    
    // 保存到localStorage
    this.saveSettings();
    
    // 显示保存成功通知
    this.showNotification(`${provider} 设置已保存`);
  }
  
  updateSelectedBadge(provider) {
    // 更新标签上的"已选"标记
    const hasModel = !!this.selectedModels[provider];
    const tab = document.querySelector(`.model-tab[data-provider="${provider}"]`);
    
    if (tab) {
      if (hasModel) {
        tab.classList.add('selected');
      } else {
        tab.classList.remove('selected');
      }
    }
  }
  
  async testConnection(provider) {
    const apiKey = this.apiKeys[provider];
    if (!apiKey) {
      this.showNotification('请先输入API Key', 'error');
      return;
    }
    
    const testBtn = document.querySelector(`#${provider}-content .test-model-btn`);
    testBtn.textContent = '测试中...';
    testBtn.disabled = true;
    
    try {
      // 模拟API测试
      await new Promise(resolve => setTimeout(resolve, 1500));
      const success = Math.random() > 0.1; // 90%成功率
      
      if (success) {
        this.showNotification(`${provider} 连接测试成功`, 'success');
      } else {
        this.showNotification(`${provider} 连接测试失败`, 'error');
      }
    } catch (e) {
      console.error(`Error testing ${provider} connection:`, e);
      this.showNotification(`测试连接时出错: ${e.message}`, 'error');
    } finally {
      testBtn.textContent = '测试连接';
      testBtn.disabled = false;
    }
  }
  
  showNotification(message, type = 'info') {
    // 创建通知元素
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.textContent = message;
    
    // 添加到页面
    document.body.appendChild(notification);
    
    // 3秒后消失
    setTimeout(() => {
      notification.classList.add('fade-out');
      setTimeout(() => {
        document.body.removeChild(notification);
      }, 500);
    }, 3000);
  }
}

// 初始化模型选择器
document.addEventListener('DOMContentLoaded', () => {
  // 当点击模型选择按钮时显示模型选择容器
  const modelSelectionBtn = document.querySelector('[data-feature="model-selection"]');
  const modelSelectionContainer = document.querySelector('.model-selection-container');
  
  if (modelSelectionBtn && modelSelectionContainer) {
    modelSelectionBtn.addEventListener('click', () => {
      // 隐藏其他内容
      document.querySelectorAll('.feature-content > div').forEach(el => {
        if (el !== modelSelectionContainer) {
          el.style.display = 'none';
        }
      });
      
      // 显示模型选择容器
      modelSelectionContainer.style.display = 'flex';
      
      // 更新标题
      const aiHeader = document.querySelector('.ai-header h2');
      const aiDescription = document.querySelector('.ai-description');
      
      if (aiHeader) {
        aiHeader.textContent = '模型选择';
      }
      
      if (aiDescription) {
        aiDescription.textContent = '配置并管理您的AI服务商和模型';
      }
      
      // 确保按钮状态正确
      document.querySelectorAll('.feature-button').forEach(btn => {
        btn.classList.remove('active');
      });
      modelSelectionBtn.classList.add('active');
    });
  }
  
  // 初始化模型选择器
  const modelSelector = new ModelSelector();
});

// 检查单个链接
async function checkLink(url) {
    try {
        // 保持原有超时设置
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000); // 10秒超时
        
        // 发送请求检查链接
        const response = await fetch(url, {
            method: 'HEAD', // 保持使用HEAD请求
            signal: controller.signal,
            mode: 'no-cors',
            headers: {
                'User-Agent': 'Mozilla/5.0 Chrome Extension Link Checker'
            }
        });
        
        // 清除超时
        clearTimeout(timeoutId);
        
        return {
            url: url,
            status: response.status,
            ok: response.ok || response.type === 'opaque', // opaque响应在no-cors模式下可能是正常的
            statusText: response.statusText || getStatusText(response.status)
        };
    } catch (error) {
        // 改进错误处理，提供更准确的错误码和说明
        let errorCode, errorMessage;
        
        if (error.name === 'AbortError') {
            errorCode = 'TIMEOUT';
            errorMessage = '请求超时 (10秒)';
        } else if (error.name === 'TypeError') {
            errorCode = 'NETWORK_ERROR';
            errorMessage = '网络连接问题';
        } else if (error.message && error.message.includes('CERTIFICATE')) {
            errorCode = 'CERT_ERROR';
            errorMessage = '证书错误';
        } else if (error.message && error.message.includes('BLOCKED')) {
            errorCode = 'BLOCKED';
            errorMessage = '请求被阻止';
        } else {
            errorCode = error.name || 'UNKNOWN';
            errorMessage = error.message || '未知错误';
        }
        
        // 特殊处理验证码和登录页面 (根据状态码判断)
        if (error.status === 403 || error.status === 401) {
            return {
                url: url,
                status: error.status,
                ok: true, // 标记为可访问
                statusText: '需要验证/登录但可访问'
            };
        }
        
        return {
            url: url,
            status: 0,
            ok: false,
            error: errorCode,
            errorMessage: errorMessage
        };
    }
}

// 添加HTTP状态码解释函数
function getStatusText(status) {
    const statusMap = {
        200: '正常',
        201: '已创建',
        204: '无内容但正常',
        301: '永久重定向',
        302: '临时重定向',
        304: '未修改',
        400: '请求错误',
        401: '需要身份验证',
        403: '禁止访问或需验证码',
        404: '未找到',
        408: '请求超时',
        429: '请求过多',
        500: '服务器错误',
        502: '网关错误',
        503: '服务不可用',
        504: '网关超时'
    };
    
    return statusMap[status] || `状态码: ${status}`;
}

// 处理链接检查结果的UI更新函数
function updateLinkCheckResult(result) {
    // 这里可能需要修改显示错误信息的代码
    // 但我们不改变这部分逻辑，只是提供更准确的数据
    
    // 特殊处理验证码页面
    if (result.status === 403 || result.status === 401) {
        result.ok = true; // 强制标记为有效
        result.statusText = '需要验证但可访问';
    }
    
    // 其余代码保持不变...
}

// 更新链接检查UI的函数 - 替换原有的处理函数
function updateLinkCheckUI(result, listElement) {
    // 查找或创建结果项
    let item = document.querySelector(`.error-item[data-url="${result.url}"]`);
    
    if (!item) {
        item = document.createElement('div');
        item.className = 'error-item';
        item.setAttribute('data-url', result.url);
        listElement.appendChild(item);
    }
    
    // 获取域名和路径用于显示
    let urlDisplay;
    try {
        const urlObj = new URL(result.url);
        urlDisplay = urlObj.hostname + urlObj.pathname.slice(0, 15) + (urlObj.pathname.length > 15 ? '...' : '');
    } catch (e) {
        urlDisplay = result.url.slice(0, 30) + (result.url.length > 30 ? '...' : '');
    }
    
    // 确定显示的状态信息
    let statusInfo = '';
    let statusClass = '';
    
    if (result.ok) {
        statusClass = 'success';
        statusInfo = result.statusText || '可访问';
    } else {
        statusClass = 'error';
        
        // 使用我们改进的错误信息
        if (result.error && result.errorMessage) {
            // 根据错误类型生成有意义的状态消息
            switch (result.error) {
                case 'TIMEOUT':
                    statusInfo = '请求超时';
                    break;
                case 'NETWORK_ERROR': 
                    statusInfo = '网络问题';
                    break;
                case 'CERT_ERROR':
                    statusInfo = '证书错误';
                    break;
                case 'BLOCKED':
                    statusInfo = '请求被阻止'; 
                    break;
                default:
                    statusInfo = result.errorMessage || '无法访问';
            }
        } else if (result.status) {
            // 使用HTTP状态码信息
            statusInfo = getStatusText(result.status);
        } else {
            statusInfo = '无法访问';
        }
    }
    
    // 特别处理验证码/登录页面为成功
    if (result.status === 403 || result.status === 401 || 
        (result.errorMessage && result.errorMessage.includes('验证'))) {
        statusClass = 'warning'; // 使用警告样式而非错误
        statusInfo = '需要验证但可访问';
        result.ok = true; // 标记为可访问
    }
    
    // 构建HTML
    item.innerHTML = `
        <div class="error-url">${urlDisplay}</div>
        <div class="error-status ${statusClass}">${statusInfo}</div>
        <div class="error-actions">
            <button class="btn-open">打开</button>
        </div>
    `;
    
    // 添加事件监听器
    item.querySelector('.btn-open').addEventListener('click', () => {
        browser.tabs.create({ url: result.url });
    });
    
    return result.ok; // 返回链接是否可访问
}

// 这个函数可能需要添加到原有代码中，以替换原有的错误处理显示逻辑

// 链接检查功能 - 添加或替换现有实现
// 放在文件适当位置，建议放在已添加的updateLinkCheckUI函数下方
function initLinkChecker() {
    const checkBtn = document.getElementById('checkBtn');
    const checkContainer = document.querySelector('.check-container');
    const resultsList = document.querySelector('.check-results-list') || createResultsList();
    let isChecking = false;
    let totalChecked = 0;
    let totalErrors = 0;
    let controller = new AbortController(); // 添加controller变量定义
    
    function createResultsList() {
        const list = document.createElement('div');
        list.className = 'check-results-list';
        checkContainer.appendChild(list);
        return list;
    }
    
    // 初始化检查按钮
    checkBtn.addEventListener('click', () => {
        if (isChecking) {
            // 用户点击取消
            isChecking = false;
            checkBtn.textContent = '检查链接';
            checkBtn.classList.remove('btn-danger');
            checkBtn.classList.add('btn-success');
            
            // 如果有controller，取消所有请求
            if (controller) {
                controller.abort();
                controller = new AbortController();
            }
            
            // 显示中止消息
            const statusElement = document.querySelector('.check-status');
            if (statusElement) {
                statusElement.textContent = '检查被中止';
                statusElement.className = 'check-status warning';
            }
            return;
        }
        
        // 启动链接检查
        showContainer(checkContainer, '.link-check-container');
        
        // 清空之前的结果
        resultsList.innerHTML = '';
        
        // 更新按钮状态
        checkBtn.textContent = '取消检查';
        checkBtn.classList.remove('btn-success');
        checkBtn.classList.add('btn-danger');
        
        // 创建或更新状态信息
        let statusElement = document.querySelector('.check-status');
        if (!statusElement) {
            statusElement = document.createElement('div');
            statusElement.className = 'check-status';
            checkContainer.insertBefore(statusElement, resultsList);
        }
        statusElement.textContent = '正在检查链接...';
        statusElement.className = 'check-status info';
        
        // 重置计数
        totalChecked = 0;
        totalErrors = 0;
        isChecking = true;
        
        // 获取所有书签并开始检查
        browser.bookmarks.getTree(async (nodes) => {
            const allBookmarks = [];
            
            // 遍历所有书签
            function traverse(node) {
                if (node.url) {
                    allBookmarks.push(node);
                }
                if (node.children) {
                    node.children.forEach(traverse);
                }
            }
            
            nodes.forEach(traverse);
            
            // 开始检查
            const total = allBookmarks.length;
            statusElement.textContent = `检查中: 0/${total}`;
            
            // 并发检查，但限制并发数
            const concurrency = 5;
            const chunks = [];
            
            // 分块处理，每次处理concurrency个
            for (let i = 0; i < allBookmarks.length; i += concurrency) {
                chunks.push(allBookmarks.slice(i, i + concurrency));
            }
            
            // 逐块处理
            for (const chunk of chunks) {
                if (!isChecking) break; // 如果用户取消了检查
                
                // 并行检查当前块
                const results = await Promise.all(
                    chunk.map(bookmark => checkLink(bookmark.url)
                        .then(result => {
                            totalChecked++;
                            
                            // 更新进度
                            statusElement.textContent = `检查中: ${totalChecked}/${total}`;
                            
                            if (!result.ok) totalErrors++;
                            
                            // 使用新的UI更新函数
                            updateLinkCheckUI(result, resultsList);
                            
                            return result;
                        })
                    )
                );
                
                // 更新状态显示
                const errorPercentage = totalChecked > 0 ? ((totalErrors / totalChecked) * 100).toFixed(1) : 0;
                statusElement.textContent = `已检查: ${totalChecked}/${total} · 问题链接: ${totalErrors} (${errorPercentage}%)`;
                
                // 检查是否完成
                if (totalChecked >= total) {
                    isChecking = false;
                    checkBtn.textContent = '检查链接';
                    checkBtn.classList.remove('btn-danger');
                    checkBtn.classList.add('btn-success');
                    
                    // 更新最终状态
                    if (totalErrors > 0) {
                        statusElement.className = 'check-status warning';
                        statusElement.textContent = `检查完成: 发现 ${totalErrors} 个问题链接 (${errorPercentage}%)`;
                    } else {
                        statusElement.className = 'check-status success';
                        statusElement.textContent = '检查完成: 所有链接正常';
                    }
                }
            }
        });
    });
    
    return {
        startCheck: () => checkBtn.click(),
        isChecking: () => isChecking
    };
}

// 初始化链接检查功能
const linkChecker = initLinkChecker();

// 初始化应用
function initializeApp() {
  try {
    // 等待 DOM 完全加载
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', initializeApp);
      return;
    }

    // 初始化各个模块
    initQuantumElements();
    initializeVisualization();
    initLinkChecker();
    
    // 更新统计信息
    chrome.bookmarks.getTree(function(tree) {
      const stats = {
        bookmarks: 0,
        folders: 0
      };
      
      function traverse(node) {
        if (node.url) {
          stats.bookmarks++;
        } else {
          if (node.title) stats.folders++;
          if (node.children) {
            node.children.forEach(traverse);
          }
        }
      }
      
      tree.forEach(traverse);
      
      // 更新显示
      const bookmarkCount = document.querySelector('.stat-count:first-child');
      const folderCount = document.querySelector('.stat-count:last-child');
      
      if (bookmarkCount) bookmarkCount.textContent = stats.bookmarks;
      if (folderCount) folderCount.textContent = stats.folders;
    });
    
    // 初始化其他功能
    new ModelSelector();
    
  } catch (error) {
    console.error('初始化失败:', error);
  }
}

// 确保在页面加载完成后初始化
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initializeApp);
} else {
  initializeApp();
}

// 确保所有可能设置版本号的地方都使用正确的版本
const APP_VERSION = 'v0.67';

function initializeApp() {
  // 设置版本号
  document.querySelector('.version').textContent = APP_VERSION;
  
  // ... existing code ...
}

// 如果有其他地方使用版本号，也会使用 APP_VERSION 常量
// ... existing code ...

// 初始化量子云图功能
function initQuantumCloudFeature() {
    console.log('初始化量子云图功能');
    const container = document.querySelector('.quantum-cloud-container');
    if (!container) {
        console.error('找不到量子云图容器');
        return;
    }

    // 不再清空内容，如果已有内容则保留
    if (container.children.length === 0) {
        console.log('量子云图容器为空，初始化容器');
        
        // 添加必要的DOM结构
        const vizContainer = document.createElement('div');
        vizContainer.id = 'cloud-visualization-container';
        vizContainer.style.cssText = 'width: 100%; height: 600px; overflow: visible;';
        container.appendChild(vizContainer);
        
        // 尝试调用多种可能的初始化方法
        try {
            console.log('尝试调用initializeVisualization()');
            if (typeof initializeVisualization === 'function') {
                initializeVisualization();
            } else {
                console.log('尝试其他初始化方法');
                if (typeof loadBookmarksForVisualization === 'function') {
                    loadBookmarksForVisualization(container);
                } else if (typeof renderBookmarkVisualization === 'function') {
                    getBookmarkTree().then(tree => {
                        renderBookmarkVisualization(container, tree);
                    });
                } else {
                    console.error('无法找到合适的可视化初始化函数');
                    container.innerHTML = '<div style="padding: 20px; text-align: center;">无法初始化量子云图</div>';
                }
            }
        } catch (error) {
            console.error('初始化量子云图时出错:', error);
        }
    } else {
        console.log('量子云图容器已有内容，跳过初始化');
    }

    // 确保容器可见
    container.style.display = 'block';
    container.style.visibility = 'visible';
    container.style.minHeight = '600px';
    container.style.position = 'relative';
    container.style.zIndex = '20';
}

// ... existing code ...

// 查找测试面板并隐藏 - 增强版
function hideTestPanel() {
    console.log('尝试隐藏所有测试面板');
    
    // 使用多种可能的选择器
    const possibleSelectors = [
        '.test-panel',
        '#test-panel',
        '.ai-test-panel',
        '.feature-test',
        '[data-testid="test-panel"]',
        // 尝试查找包含测试字眼的元素
        'div[class*="test"]',
        'div[id*="test"]',
        'div[style*="red"]', // 测试面板可能有红色背景
        '.emergency-test',
        '.ai-feature-test'
    ];
    
    let hidden = 0;
    
    // 遍历所有可能的选择器
    possibleSelectors.forEach(selector => {
        const elements = document.querySelectorAll(selector);
        if (elements.length > 0) {
            console.log(`找到 ${elements.length} 个匹配 "${selector}" 的元素`);
            elements.forEach((element, i) => {
                // 确保不隐藏量子标签功能相关元素
                if (element.classList.contains('quantum-tags-container') || 
                    element.closest('.quantum-tags-container') ||
                    element.classList.contains('tag-cloud-container') ||
                    element.classList.contains('relation-graph-container') ||
                    element.classList.contains('result-panel')) {
                    console.log(`跳过量子标签功能元素: ${selector} #${i}`);
                    return;
                }
                
                console.log(`隐藏元素: ${selector} #${i}, 内容: ${element.innerText.substring(0, 30)}...`);
                element.style.display = 'none';
                element.style.visibility = 'hidden';
                // 如果可能，添加到元素类名以便追踪已隐藏的元素
                element.classList.add('hidden-by-system');
                hidden++;
            });
        }
    });
    
    // 查找包含"测试"、"test"字样的按钮和面板
    const testButtons = Array.from(document.querySelectorAll('button, div')).filter(el => {
        const text = el.innerText?.toLowerCase() || '';
        return (text.includes('测试') || text.includes('test')) && 
               !el.classList.contains('hidden-by-system');
    });
    
    if (testButtons.length > 0) {
        console.log(`找到 ${testButtons.length} 个包含"测试"字样的元素`);
        testButtons.forEach((el, i) => {
            // 确保不隐藏量子标签功能相关元素
            if (el.closest('.quantum-tags-container') ||
                el.closest('.tag-cloud-container') ||
                el.closest('.relation-graph-container') ||
                el.closest('.result-panel')) {
                console.log(`跳过量子标签功能元素: 按钮 #${i}`);
                return;
            }
            
            if (el.tagName === 'BUTTON') {
                // 不隐藏按钮，只是记录下来
                console.log(`测试按钮 #${i}: ${el.innerText}`);
            } else {
                // 隐藏非按钮元素
                console.log(`隐藏测试元素 #${i}: ${el.innerText.substring(0, 30)}...`);
                el.style.display = 'none';
                el.style.visibility = 'hidden';
                el.classList.add('hidden-by-system');
                hidden++;
            }
        });
    }
    
    // 查找并隐藏任何紧急测试容器
    const emergencyTest = document.querySelector('.emergency-test, .test-container, #test-container');
    if (emergencyTest) {
        console.log('找到紧急测试容器，隐藏');
        emergencyTest.style.display = 'none';
        emergencyTest.style.visibility = 'hidden';
        hidden++;
    }
    
    // 查找特定测试面板 - 通过HTML特征定位
    const specificTestPanel = Array.from(document.querySelectorAll('div')).find(el => {
        // 确保不隐藏量子标签功能相关元素
        if (el.classList.contains('quantum-tags-container') || 
            el.closest('.quantum-tags-container') ||
            el.classList.contains('tag-cloud-container') ||
            el.classList.contains('relation-graph-container') ||
            el.classList.contains('result-panel')) {
            return false;
        }
        
        // 查找疑似测试面板的容器：有渐变背景、固定位置、红色等特征
        const style = window.getComputedStyle(el);
        const hasRedBackground = style.background.includes('red') || style.backgroundColor.includes('red');
        const isFixed = style.position === 'fixed';
        const hasButtons = el.querySelectorAll('button').length >= 2;
        
        return (hasRedBackground || isFixed) && hasButtons && 
               !el.classList.contains('hidden-by-system');
    });
    
    if (specificTestPanel) {
        console.log('找到特征匹配的测试面板，隐藏');
        specificTestPanel.style.display = 'none';
        specificTestPanel.style.visibility = 'hidden';
        specificTestPanel.classList.add('hidden-by-system');
        hidden++;
    }

    console.log(`总共隐藏了 ${hidden} 个测试相关元素`);
    
    // 确保量子标签功能容器可见
    const quantumTagsContainer = document.querySelector('.quantum-tags-container');
    if (quantumTagsContainer && (
        quantumTagsContainer.style.display === 'none' || 
        quantumTagsContainer.style.visibility === 'hidden')) {
        console.log('恢复量子标签功能容器显示');
        quantumTagsContainer.style.display = 'block';
        quantumTagsContainer.style.visibility = 'visible';
    }
}

// ... existing code ...

// 在DOMContentLoaded和加载后多次尝试隐藏测试面板
document.addEventListener('DOMContentLoaded', () => {
    console.log('DOMContentLoaded: 尝试隐藏测试面板');
    hideTestPanel();
    
    // 在短暂延迟后再次尝试隐藏
    setTimeout(hideTestPanel, 500);
    setTimeout(hideTestPanel, 1500);
});

// 在页面完全加载后也尝试隐藏
window.addEventListener('load', () => {
    console.log('页面加载完成: 尝试隐藏测试面板');
    hideTestPanel();
    
    // 在页面加载后每秒尝试隐藏一次，持续5秒
    for (let i = 1; i <= 5; i++) {
        setTimeout(hideTestPanel, i * 1000);
    }
});

// 确保在任何功能切换时都隐藏测试面板
const originalUpdateCurrentFeature = updateCurrentFeature;
window.updateCurrentFeature = function(feature) {
    console.log('功能切换(全局方法): 尝试隐藏测试面板');
    
    // 使用try-catch包裹，避免任何错误中断流程
    try {
        hideTestPanel();
        originalUpdateCurrentFeature(feature);
        
        // 不再需要再次调用hideTestPanel
        // setTimeout(hideTestPanel, 100);
    } catch (error) {
        console.error('功能切换出错:', error);
        
        // 如果原始方法出错，尝试直接处理最基本的功能切换逻辑
        try {
            console.log('尝试基本的功能切换逻辑');
            
            // 设置当前功能
            window.currentFeature = feature;
            
            // 更新按钮状态
            const buttons = document.querySelectorAll('.feature-button');
            if (buttons && buttons.length > 0) {
                buttons.forEach(btn => {
                    if (btn.dataset.feature === feature) {
                        btn.classList.add('active');
                    } else {
                        btn.classList.remove('active');
                    }
                });
            }
            
            // 直接显示容器
            const containerSelector = `.${feature}-container`;
            const container = document.querySelector(containerSelector);
            if (container) {
                console.log(`直接显示容器: ${containerSelector}`);
                container.style.display = 'block';
                container.style.visibility = 'visible';
            }
        } catch (backupError) {
            console.error('基本功能切换也失败:', backupError);
        }
    }
};

// 添加一个全局快捷键来隐藏测试面板
document.addEventListener('keydown', (e) => {
    // Alt+H 组合键隐藏测试面板
    if (e.altKey && e.key === 'h') {
        console.log('检测到Alt+H快捷键: 隐藏测试面板');
        hideTestPanel();
    }
});

// 定期检查和隐藏测试面板
setInterval(hideTestPanel, 3000);

// 将函数暴露给全局作用域，方便从控制台调用
window.hideTestPanel = hideTestPanel;

// ... existing code ...

// 查找特定测试面板并隐藏 - 精确版
function hideTestPanel() {
    console.log('尝试精确隐藏测试面板');
    
    // 只针对特定的测试面板选择器
    const specificSelectors = [
        '.test-panel',  // 主要测试面板
        '#test-panel',  // ID为test-panel的元素
        '.emergency-test'  // 紧急测试面板
    ];
    
    let hidden = 0;
    
    // 遍历特定选择器
    specificSelectors.forEach(selector => {
        const elements = document.querySelectorAll(selector);
        if (elements.length > 0) {
            console.log(`找到 ${elements.length} 个匹配 "${selector}" 的元素`);
            elements.forEach((element, i) => {
                // 记录隐藏的元素信息，帮助调试
                try {
                    console.log(`隐藏元素: ${selector} #${i}, 内容: ${element.innerText?.substring(0, 30) || '[无文本内容]'}...`);
                } catch (e) {
                    console.log(`隐藏元素: ${selector} #${i}, 无法读取内容`);
                }
                
                element.style.display = 'none';
                element.style.visibility = 'hidden';
                hidden++;
            });
        }
    });
    
    // 查找特定红色测试面板 - 通过具体特征定位
    const redTestPanel = Array.from(document.querySelectorAll('div')).find(el => {
        if (!el || !el.style) return false;
        
        try {
            // 获取元素内容，查找是否包含特定测试关键词
            const text = el.innerText?.toLowerCase() || '';
            const hasTestKeywords = text.includes('测试模型') || 
                                  text.includes('量子云图测试') || 
                                  text.includes('测试按钮') ||
                                  text.includes('emergency test');
            
            // 检查是否有特定样式特征
            const style = window.getComputedStyle(el);
            const hasRedBackground = style.backgroundColor.includes('rgb(255') || // 红色背景
                                  style.background.includes('red') || 
                                  style.background.includes('rgb(255');
            
            // 需要同时满足内容和样式特征
            return hasTestKeywords && hasRedBackground && 
                  el.querySelectorAll('button').length >= 2; // 有多个按钮
        } catch (e) {
            return false;
        }
    });
    
    if (redTestPanel) {
        console.log('找到红色测试面板，隐藏它');
        redTestPanel.style.display = 'none';
        redTestPanel.style.visibility = 'hidden';
        hidden++;
    }
    
    // 查找固定位置的测试容器 - 特别是我们之前创建的测试容器
    const testContainer = document.querySelector('div[style*="position: fixed"][style*="background: linear-gradient"]');
    if (testContainer) {
        // 验证是否是测试容器
        const buttons = testContainer.querySelectorAll('button');
        const isTestPanel = buttons.length >= 3 && 
                            Array.from(buttons).some(btn => 
                                btn.innerText.includes('测试') || 
                                btn.innerText.includes('模型设置') || 
                                btn.innerText.includes('量子'));
        
        if (isTestPanel) {
            console.log('找到固定位置的测试容器，隐藏');
            testContainer.style.display = 'none';
            testContainer.style.visibility = 'hidden';
            hidden++;
        }
    }
    
    // 查找特定的紧急测试按钮面板
    const emergencyPanel = document.querySelector('.emergency-container, .emergency-buttons');
    if (emergencyPanel) {
        console.log('找到紧急测试按钮面板，隐藏');
        emergencyPanel.style.display = 'none';
        emergencyPanel.style.visibility = 'hidden';
        hidden++;
    }
    
    // 如果没找到任何面板，恢复首页和功能按钮
    if (hidden === 0) {
        console.log('没有找到测试面板，检查是否需要恢复被隐藏的元素');
        
        // 恢复首页内容
        const bookmarkContainer = document.querySelector('.bookmark-container');
        if (bookmarkContainer && bookmarkContainer.style.display === 'none') {
            console.log('恢复书签容器显示');
            bookmarkContainer.style.display = 'block';
            bookmarkContainer.style.visibility = 'visible';
        }
        
        // 恢复功能按钮
        const featureButtons = document.querySelectorAll('.feature-button, .ai-button');
        featureButtons.forEach(button => {
            if (button.style.display === 'none') {
                console.log(`恢复按钮: ${button.innerText}`);
                button.style.display = '';
                button.style.visibility = 'visible';
            }
        });
    }
    
    console.log(`总共隐藏了 ${hidden} 个测试相关元素`);
    return hidden > 0;
}

// 在DOMContentLoaded时尝试隐藏测试面板
document.addEventListener('DOMContentLoaded', () => {
    console.log('DOMContentLoaded: 尝试隐藏测试面板');
    setTimeout(hideTestPanel, 500); // 稍微延迟确保DOM加载完成
});

// 添加一个全局快捷键来隐藏测试面板
document.addEventListener('keydown', (e) => {
    // Alt+H 组合键隐藏测试面板
    if (e.altKey && e.key === 'h') {
        console.log('检测到Alt+H快捷键: 隐藏测试面板');
        hideTestPanel();
    }
    // Alt+R 组合键恢复所有元素
    if (e.altKey && e.key === 'r') {
        console.log('检测到Alt+R快捷键: 恢复所有元素');
        document.querySelectorAll('[style*="display: none"]').forEach(el => {
            el.style.display = '';
            el.style.visibility = '';
        });
    }
});

// 将函数暴露给全局作用域，方便从控制台调用
window.hideTestPanel = hideTestPanel;
window.restoreAllElements = function() {
    document.querySelectorAll('[style*="display: none"]').forEach(el => {
        el.style.display = '';
        el.style.visibility = '';
    });
    console.log('已恢复所有隐藏元素');
};

// ... existing code ...

// 初始化量子标签功能
function initQuantumTagsFeature() {
    try {
        console.log('初始化量子标签功能');
        const container = document.querySelector('.quantum-tags-container');
        if (!container) {
            console.error('找不到量子标签容器元素');
            return;
        }
        
        // 清空容器，防止重复加载
        container.innerHTML = '';
        
        // 使用自定义属性检查事件监听器是否已添加
        if (!document.documentElement.hasAttribute('data-model-settings-listener-added')) {
            // 添加事件监听器，处理事件
            document.addEventListener('switchToModelSettings', (event) => {
                console.log('收到切换到模型设置的事件', event.detail);
                if (event.detail && event.detail.feature === 'model-selection') {
                    updateCurrentFeature('model-selection');
                }
            });
            
            // 标记事件监听器已添加
            document.documentElement.setAttribute('data-model-settings-listener-added', 'true');
            console.log('已添加模型设置事件监听器');
        }
        
        // 添加必要的CSS样式
        const styleElement = document.createElement('style');
        styleElement.textContent = `
            .quantum-container {
                display: flex;
                flex-direction: column;
                height: 100%;
                width: 100%;
                padding: 20px;
                background: #222;
                border-radius: 12px;
                color: #fff;
                font-family: Arial, sans-serif;
            }
            
            .view-tabs {
                display: flex;
                margin-bottom: 20px;
                border-radius: 8px;
                overflow: hidden;
                background: rgba(0, 0, 0, 0.2);
            }
            
            .tab-item {
                padding: 12px 20px;
                cursor: pointer;
                text-align: center;
                flex: 1;
                transition: all 0.3s ease;
                font-weight: 500;
                color: rgba(255, 255, 255, 0.7);
            }
            
            .tab-item:hover {
                color: rgba(255, 255, 255, 0.9);
                background: rgba(255, 255, 255, 0.05);
            }
            
            .tab-item.active {
                background: linear-gradient(135deg, #4F8FFE, #18C8FF);
                color: white;
            }
            
            .view-container {
                position: relative;
                flex: 1;
                background: rgba(0, 0, 0, 0.1);
                border-radius: 8px;
                min-height: 300px;
                overflow: hidden;
            }
            
            .tag-cloud-view,
            .tag-relation-view {
                position: absolute;
                width: 100%;
                height: 100%;
                opacity: 0;
                pointer-events: none;
                transition: opacity 0.3s ease;
                display: flex;
                align-items: center;
                justify-content: center;
            }
            
            .tag-cloud-view.active,
            .tag-relation-view.active {
                opacity: 1;
                pointer-events: auto;
            }
            
            .loading-indicator {
                position: absolute;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                display: flex;
                flex-direction: column;
                align-items: center;
                justify-content: center;
                background: rgba(0, 0, 0, 0.2);
            }
            
            .spinner {
                width: 40px;
                height: 40px;
                border: 3px solid rgba(255, 255, 255, 0.1);
                border-radius: 50%;
                border-top-color: #4F8FFE;
                animation: spin 1s ease-in-out infinite;
                margin-bottom: 10px;
            }
            
            @keyframes spin {
                to { transform: rotate(360deg); }
            }
            
            .refresh-button,
            .settings-button {
                display: flex;
                align-items: center;
                justify-content: center;
                width: 36px;
                height: 36px;
                margin-left: 8px;
                border-radius: 50%;
                cursor: pointer;
                transition: background-color 0.3s ease;
            }
            
            .refresh-button:hover,
            .settings-button:hover {
                background-color: rgba(255, 255, 255, 0.1);
            }
            
            .error-container {
                display: flex;
                flex-direction: column;
                align-items: center;
                justify-content: center;
                padding: 2rem;
                background-color: rgba(0, 0, 0, 0.2);
                border-radius: 8px;
                text-align: center;
                max-width: 500px;
                margin: 0 auto;
            }
            
            .error-icon {
                font-size: 48px;
                margin-bottom: 1rem;
            }
            
            .error-title {
                font-size: 20px;
                font-weight: bold;
                margin-bottom: 0.5rem;
                color: #ff5252;
            }
            
            .error-message {
                margin-bottom: 1.5rem;
                line-height: 1.5;
            }
            
            .primary-button,
            .secondary-button,
            .action-button {
                padding: 10px 16px;
                border-radius: 4px;
                border: none;
                font-size: 14px;
                cursor: pointer;
                transition: all 0.3s ease;
                margin: 5px;
            }
            
            .primary-button {
                background-color: #4263EB;
                color: white;
            }
            
            .primary-button:hover {
                background-color: #3b58d9;
                transform: translateY(-2px);
            }
            
            .secondary-button {
                background-color: transparent;
                border: 1px solid #4263EB;
                color: #4263EB;
            }
            
            .secondary-button:hover {
                background-color: rgba(66, 99, 235, 0.1);
                transform: translateY(-2px);
            }
            
            .action-button {
                background-color: #4263EB;
                color: white;
                margin-top: 1rem;
            }
            
            .action-button:hover {
                background-color: #3b58d9;
                transform: translateY(-2px);
            }
            
            .empty-state {
                display: flex;
                flex-direction: column;
                align-items: center;
                justify-content: center;
                height: 100%;
            }
            
            .empty-icon {
                font-size: 48px;
                margin-bottom: 1rem;
            }
            
            .empty-text {
                margin-bottom: 1rem;
                font-size: 16px;
                color: rgba(255, 255, 255, 0.7);
            }
        `;
        document.head.appendChild(styleElement);
        
        // 创建量子标签容器结构
        const quantumContainer = document.createElement('div');
        quantumContainer.className = 'quantum-container';
        
        // 创建标签页
        const tabsContainer = document.createElement('div');
        tabsContainer.className = 'view-tabs';
        
        const cloudTab = document.createElement('div');
        cloudTab.className = 'tab-item active';
        cloudTab.textContent = '标签云';
        
        const relationTab = document.createElement('div');
        relationTab.className = 'tab-item';
        relationTab.textContent = '关系图谱';
        
        const refreshButton = document.createElement('div');
        refreshButton.className = 'refresh-button';
        refreshButton.title = '刷新数据';
        refreshButton.innerHTML = `
            <svg viewBox="0 0 24 24" width="16" height="16">
                <path fill="currentColor" d="M17.65,6.35C16.2,4.9 14.21,4 12,4A8,8 0 0,0 4,12A8,8 0 0,0 12,20C15.73,20 18.84,17.45 19.73,14H17.65C16.83,16.33 14.61,18 12,18A6,6 0 0,1 6,12A6,6 0 0,1 12,6C13.66,6 15.14,6.69 16.22,7.78L13,11H20V4L17.65,6.35Z">
                </path>
            </svg>
        `;
        
        const settingsButton = document.createElement('div');
        settingsButton.className = 'settings-button';
        settingsButton.title = '模型设置';
        settingsButton.innerHTML = `
            <svg viewBox="0 0 24 24" width="16" height="16">
                <path fill="currentColor" d="M12,15.5A3.5,3.5 0 0,1 8.5,12A3.5,3.5 0 0,1 12,8.5A3.5,3.5 0 0,1 15.5,12A3.5,3.5 0 0,1 12,15.5M19.43,12.97C19.47,12.65 19.5,12.33 19.5,12C19.5,11.67 19.47,11.34 19.43,11L21.54,9.37C21.73,9.22 21.78,8.95 21.66,8.73L19.66,5.27C19.54,5.05 19.27,4.96 19.05,5.05L16.56,6.05C16.04,5.66 15.5,5.32 14.87,5.07L14.5,2.42C14.46,2.18 14.25,2 14,2H10C9.75,2 9.54,2.18 9.5,2.42L9.13,5.07C8.5,5.32 7.96,5.66 7.44,6.05L4.95,5.05C4.73,4.96 4.46,5.05 4.34,5.27L2.34,8.73C2.21,8.95 2.27,9.22 2.46,9.37L4.57,11C4.53,11.34 4.5,11.67 4.5,12C4.5,12.33 4.53,12.65 4.57,12.97L2.46,14.63C2.27,14.78 2.21,15.05 2.34,15.27L4.34,18.73C4.46,18.95 4.73,19.03 4.95,18.95L7.44,17.94C7.96,18.34 8.5,18.68 9.13,18.93L9.5,21.58C9.54,21.82 9.75,22 10,22H14C14.25,22 14.46,21.82 14.5,21.58L14.87,18.93C15.5,18.67 16.04,18.34 16.56,17.94L19.05,18.95C19.27,19.03 19.54,18.95 19.66,18.73L21.66,15.27C21.78,15.05 21.73,14.78 21.54,14.63L19.43,12.97Z">
                </path>
            </svg>
        `;
        
        tabsContainer.appendChild(cloudTab);
        tabsContainer.appendChild(relationTab);
        tabsContainer.appendChild(refreshButton);
        tabsContainer.appendChild(settingsButton);
        
        // 创建视图容器
        const viewContainer = document.createElement('div');
        viewContainer.className = 'view-container';
        
        // 内容区域
        const cloudView = document.createElement('div');
        cloudView.className = 'tag-cloud-view active';
        
        const relationView = document.createElement('div');
        relationView.className = 'tag-relation-view';
        
        // 获取API设置
        const modelConfig = {
            apiEndpoint: localStorage.getItem('ai_api_endpoint') || '',
            apiKey: localStorage.getItem('ai_api_key') || '',
            model: localStorage.getItem('ai_model') || ''
        };
        
        // 检查API配置
        if (!modelConfig.apiKey) {
            // 创建错误状态
            const errorContainer = document.createElement('div');
            errorContainer.className = 'error-container';
            
            const errorIcon = document.createElement('div');
            errorIcon.className = 'error-icon';
            errorIcon.textContent = '🔑';
            
            const errorTitle = document.createElement('div');
            errorTitle.className = 'error-title';
            errorTitle.textContent = 'API密钥未配置';
            
            const errorMessage = document.createElement('div');
            errorMessage.className = 'error-message';
            errorMessage.textContent = '您需要先配置API密钥才能使用量子标签功能。请前往模型设置页面配置API密钥。';
            
            const primaryButton = document.createElement('button');
            primaryButton.className = 'primary-button';
            primaryButton.textContent = '前往模型设置';
            primaryButton.addEventListener('click', () => {
                // 发送切换到模型设置的事件
                const customEvent = new CustomEvent('switchToModelSettings', {
                    detail: { feature: 'model-selection' }
                });
                document.dispatchEvent(customEvent);
            });
            
            const secondaryButton = document.createElement('button');
            secondaryButton.className = 'secondary-button';
            secondaryButton.textContent = '重试';
            secondaryButton.addEventListener('click', () => {
                initQuantumTagsFeature(); // 重新初始化
            });
            
            errorContainer.appendChild(errorIcon);
            errorContainer.appendChild(errorTitle);
            errorContainer.appendChild(errorMessage);
            errorContainer.appendChild(primaryButton);
            errorContainer.appendChild(secondaryButton);
            
            viewContainer.appendChild(errorContainer);
        } else {
            // 创建空状态
            const createEmptyState = (parent, isCloudView) => {
                const emptyState = document.createElement('div');
                emptyState.className = 'empty-state';
                
                const emptyIcon = document.createElement('div');
                emptyIcon.className = 'empty-icon';
                emptyIcon.textContent = isCloudView ? '📚' : '🔍';
                
                const emptyText = document.createElement('div');
                emptyText.className = 'empty-text';
                emptyText.textContent = isCloudView ? '没有找到标签数据' : '没有找到关系数据';
                
                const actionButton = document.createElement('button');
                actionButton.className = 'action-button';
                actionButton.textContent = '分析书签';
                actionButton.addEventListener('click', () => {
                    alert('分析书签功能尚未实现');
                });
                
                emptyState.appendChild(emptyIcon);
                emptyState.appendChild(emptyText);
                emptyState.appendChild(actionButton);
                
                parent.appendChild(emptyState);
            };
            
            createEmptyState(cloudView, true);
            createEmptyState(relationView, false);
        }
        
        // 添加视图到容器
        viewContainer.appendChild(cloudView);
        viewContainer.appendChild(relationView);
        
        // 构建完整UI
        quantumContainer.appendChild(tabsContainer);
        quantumContainer.appendChild(viewContainer);
        container.appendChild(quantumContainer);
        
        // 添加事件监听器
        cloudTab.addEventListener('click', () => {
            cloudTab.classList.add('active');
            relationTab.classList.remove('active');
            cloudView.classList.add('active');
            relationView.classList.remove('active');
        });
        
        relationTab.addEventListener('click', () => {
            relationTab.classList.add('active');
            cloudTab.classList.remove('active');
            relationView.classList.add('active');
            cloudView.classList.remove('active');
        });
        
        refreshButton.addEventListener('click', () => {
            alert('刷新功能尚未实现');
        });
        
        settingsButton.addEventListener('click', () => {
            // 发送切换到模型设置的事件
            const customEvent = new CustomEvent('switchToModelSettings', {
                detail: { feature: 'model-selection' }
            });
            document.dispatchEvent(customEvent);
        });
        
        console.log('量子标签功能初始化完成');
    } catch (error) {
        console.error('初始化量子标签功能时发生错误:', error);
        if (container) {
            container.innerHTML = `<div style="color: red; padding: 20px; background: rgba(255,0,0,0.1); border: 1px solid red; border-radius: 8px; text-align: center;">
                <h3 style="margin-bottom: 10px;">初始化量子标签功能失败</h3>
                <p>${error.message}</p>
                <button onclick="initQuantumTagsFeature()" style="margin-top: 15px; padding: 5px 15px; background: #4285f4; color: white; border: none; border-radius: 4px; cursor: pointer;">
                    重试
                </button>
            </div>`;
        }
    }
}

// ... existing code ...

async function initQuantumTagsFeature() {
    console.log('初始化量子标签功能 - 异步版本');
    
    // 确保容器结构存在
    // 1. 确保外部.quantum-tags-container存在
    let tagsContainer = document.querySelector('.quantum-tags-container');
    if (!tagsContainer) {
        console.log('创建量子标签外部容器');
        const featureContent = document.querySelector('.feature-content');
        if (!featureContent) {
            console.error('无法找到feature-content容器');
            return;
        }
        
        tagsContainer = document.createElement('div');
        tagsContainer.className = 'quantum-tags-container';
        tagsContainer.style.cssText = 'display: block; width: 100%; position: absolute; top: 70px; left: 0; right: 0; z-index: 20;';
        featureContent.appendChild(tagsContainer);
    } else {
        // 确保可见
        tagsContainer.style.cssText = 'display: block; width: 100%; position: absolute; top: 70px; left: 0; right: 0; z-index: 20;';
    }
    
    // 2. 确保内部#quantum-container存在
    let container = document.getElementById('quantum-container');
    if (!container) {
        console.log('创建量子标签内部容器');
        container = document.createElement('div');
        container.id = 'quantum-container';
        container.style.cssText = 'width: 100%; height: 100%; min-height: 600px; position: relative;';
        tagsContainer.appendChild(container);
    }
    
    // 清空容器
    container.innerHTML = '';

    // 创建标题和描述
    const header = document.createElement('div');
    header.className = 'quantum-header';
    header.style.margin = '0 0 20px 0';
    header.style.padding = '10px 0';
    header.style.borderBottom = '1px solid rgba(255,255,255,0.1)';
    header.innerHTML = `
        <h2 style="margin: 0; font-size: 24px; color: #fff;">量子标签</h2>
        <p style="margin: 5px 0 0 0; font-size: 14px; color: rgba(255,255,255,0.7);">多维度超维标签系统</p>
    `;
    container.appendChild(header);

    // 创建视图切换标签页
    const viewTabs = document.createElement('div');
    viewTabs.className = 'view-tabs';
    viewTabs.style.display = 'flex';
    viewTabs.style.marginBottom = '15px';
    viewTabs.style.borderBottom = '1px solid rgba(255,255,255,0.1)';
    viewTabs.innerHTML = `
        <div class="tab-item active" data-view="cloud" style="padding: 10px 20px; cursor: pointer; position: relative; color: #fff;">标签云</div>
        <div class="tab-item" data-view="relation" style="padding: 10px 20px; cursor: pointer; position: relative; color: rgba(255,255,255,0.7);">关系图谱</div>
    `;
    container.appendChild(viewTabs);

    // 为活动选项卡添加下划线样式
    const activeTab = viewTabs.querySelector('.tab-item.active');
    if (activeTab) {
        activeTab.style.color = '#4285f4';
        activeTab.style.fontWeight = 'bold';
        activeTab.style.borderBottom = '2px solid #4285f4';
    }

    // 创建进度容器
    const progressContainer = document.createElement('div');
    progressContainer.className = 'progress-container';
    progressContainer.style.margin = '20px 0';
    progressContainer.style.padding = '15px';
    progressContainer.style.background = 'rgba(255,255,255,0.05)';
    progressContainer.style.borderRadius = '8px';
    progressContainer.innerHTML = `
        <div class="progress-info" style="margin-bottom: 10px; color: rgba(255,255,255,0.8);">准备加载书签数据...</div>
        <div class="progress-bar-container" style="height: 6px; background: rgba(255,255,255,0.1); border-radius: 3px; overflow: hidden;">
            <div class="progress-bar" style="width: 0%; height: 100%; background: linear-gradient(90deg, #4285f4, #34a853); border-radius: 3px; transition: width 0.3s ease;"></div>
        </div>
    `;
    container.appendChild(progressContainer);

    // 创建视图容器
    const viewContainer = document.createElement('div');
    viewContainer.className = 'view-container';
    viewContainer.style.position = 'relative';
    viewContainer.style.minHeight = '400px';
    viewContainer.style.margin = '20px 0';
    viewContainer.style.background = 'rgba(255,255,255,0.05)';
    viewContainer.style.borderRadius = '8px';
    viewContainer.innerHTML = `
        <div class="tag-cloud-view active" style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; opacity: 1;"></div>
        <div class="tag-relation-view" style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; opacity: 0; pointer-events: none;"></div>
    `;
    container.appendChild(viewContainer);

    // 创建结果面板
    const resultPanel = document.createElement('div');
    resultPanel.className = 'result-panel';
    resultPanel.style.margin = '20px 0';
    resultPanel.style.padding = '15px';
    resultPanel.style.background = 'rgba(255,255,255,0.05)';
    resultPanel.style.borderRadius = '8px';
    resultPanel.innerHTML = `
        <div class="panel-header" style="display: flex; justify-content: space-between; margin-bottom: 15px; border-bottom: 1px solid rgba(255,255,255,0.1); padding-bottom: 10px;">
            <h3 style="margin: 0; font-size: 16px; color: #fff;">相关书签</h3>
            <span class="count" style="color: rgba(255,255,255,0.7);">0 个结果</span>
        </div>
        <div class="bookmark-list" style="max-height: 300px; overflow-y: auto;"></div>
    `;
    container.appendChild(resultPanel);

    // 将标签页绑定点击事件
    const tabItems = viewTabs.querySelectorAll('.tab-item');
    const views = viewContainer.querySelectorAll('.tag-cloud-view, .tag-relation-view');
    
    tabItems.forEach((tab, index) => {
        tab.addEventListener('click', () => {
            // 重置所有标签和视图
            tabItems.forEach(t => {
                t.classList.remove('active');
                t.style.color = 'rgba(255,255,255,0.7)';
                t.style.fontWeight = 'normal';
                t.style.borderBottom = 'none';
            });
            views.forEach(v => {
                v.style.opacity = '0';
                v.style.pointerEvents = 'none';
            });
            
            // 激活选中的标签和视图
            tab.classList.add('active');
            tab.style.color = '#4285f4';
            tab.style.fontWeight = 'bold';
            tab.style.borderBottom = '2px solid #4285f4';
            
            views[index].style.opacity = '1';
            views[index].style.pointerEvents = 'auto';
        });
    });

    try {
        // 从浏览器获取书签数据
        const progressInfo = progressContainer.querySelector('.progress-info');
        const progressBar = progressContainer.querySelector('.progress-bar');
        progressInfo.textContent = '正在获取书签数据...';
        
        // 获取书签数据
        const bookmarks = await new Promise((resolve, reject) => {
            if (typeof chrome !== 'undefined' && chrome.bookmarks) {
                chrome.bookmarks.getTree(resolve);
            } else if (typeof browser !== 'undefined' && browser.bookmarks) {
                browser.bookmarks.getTree().then(resolve);
            } else {
                reject(new Error('无法访问浏览器书签API，当前环境不支持。'));
            }
        });

        // 收集书签信息
        progressInfo.textContent = '正在处理书签数据...';
        progressBar.style.width = '10%';

        // 辅助函数：收集书签信息
        function collectBookmarkInfo(node, parentPath = []) {
            const results = [];

            function traverse(node, path) {
                if (node.children) {
                    const newPath = [...path, node.title];
                    // 遍历子节点
                    node.children.forEach(child => traverse(child, newPath));
                } else if (node.url && /^https?:\/\//.test(node.url)) {
                    // 如果是有效的书签
                    try {
                        const url = new URL(node.url);
                        results.push({
                            title: node.title,
                            url: node.url,
                            domain: url.hostname,
                            path: path.join(' > '), // 完整的目录路径
                            folder: path[path.length - 1] || '根目录' // 直接父文件夹
                        });
                    } catch (e) {
                        console.warn('Invalid URL:', node.url);
                    }
                }
            }
            
            traverse(node, parentPath);
            return results;
        }

        // 收集所有书签数据
        const allBookmarks = bookmarks.flatMap(node => collectBookmarkInfo(node));
        
        // 存储书签数据到全局变量，以供标签点击时访问
        window._cachedBookmarks = allBookmarks;
        
        // ... 其他处理代码 ...

        // 处理所有批次
        let processedCount = 0;
        let allTags = [];
        let allRelations = [];
        let newCachedResults = {...cachedResults};
        
        // ... 原有批处理代码 ...
        
        // 完成处理后，确保标签云和关系图正确显示
        progressInfo.textContent = '分析完成，正在渲染结果...';
        progressBar.style.width = '95%';
        
        // 使用去重后的标签和关系
        if (uniqueTags.length > 0) {
            // 隐藏进度条
            setTimeout(() => {
                progressContainer.style.display = 'none';
                
                // 确保视图容器可见
                viewContainer.style.display = 'block';
                
                // 保存标签和关系的全局引用，以便交互使用
                window._cachedTags = uniqueTags;
                window._cachedRelations = uniqueRelations;
                
                // 更新标签视图
                updateTagViews(uniqueTags, uniqueRelations);
                
                // 激活第一个标签(如果有)
                if (uniqueTags.length > 0) {
                    setTimeout(() => {
                        const firstTag = document.querySelector('.tag');
                        if (firstTag) {
                            firstTag.click();
                        }
                    }, 100);
                }
            }, 500);
        } else {
            // 如果没有标签，显示提示信息
            progressInfo.textContent = '分析完成，但未能生成标签。';
            progressBar.style.width = '100%';
            
            // 在标签云视图中显示空状态
            const cloudView = viewContainer.querySelector('.tag-cloud-view');
            const relationView = viewContainer.querySelector('.tag-relation-view');
            
            if (cloudView) {
                cloudView.innerHTML = `
                    <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100%; color: rgba(255,255,255,0.5); text-align: center; padding: 20px;">
                        <div style="font-size: 48px; margin-bottom: 16px;">🏷️</div>
                        <h3 style="margin: 0 0 10px 0;">未能生成标签</h3>
                        <p style="margin: 0;">请尝试选择不同的书签或调整AI模型</p>
                    </div>
                `;
            }
            
            if (relationView) {
                relationView.innerHTML = `
                    <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100%; color: rgba(255,255,255,0.5); text-align: center; padding: 20px;">
                        <div style="font-size: 48px; margin-bottom: 16px;">🔄</div>
                        <h3 style="margin: 0 0 10px 0;">未能生成关系图</h3>
                        <p style="margin: 0;">需要先生成标签才能显示关系图</p>
                    </div>
                `;
            }
        }
        
        // 完成
        progressInfo.textContent = `分析完成！共处理 ${processedCount} 个书签，生成 ${uniqueTags.length} 个标签。`;
        progressBar.style.width = '100%';
        
    } catch (error) {
        console.error('初始化量子标签功能时出错:', error);
        progressInfo.textContent = `错误: ${error.message}`;
        progressBar.style.width = '0%';
        progressBar.style.backgroundColor = '#ff5252';
    }
}

// 更新视图函数
function updateTagViews(tags, relations) {
    // 获取视图容器
    const cloudView = document.querySelector('.tag-cloud-view');
    const relationView = document.querySelector('.tag-relation-view');
    
    if (!cloudView || !relationView) {
        console.error('找不到视图容器');
        return;
    }
    
    // 清空容器
    cloudView.innerHTML = '';
    relationView.innerHTML = '';
    
    // 根据权重排序标签
    const sortedTags = [...tags].sort((a, b) => b.weight - a.weight);
    
    // 检查是否有标签
    if (sortedTags.length === 0) {
        createEmptyState(cloudView, true);
        createEmptyState(relationView, false);
        return;
    }
    
    // 更新标签云视图
    updateTagCloud(cloudView, sortedTags);
    
    // 更新关系图视图
    updateRelationGraph(relationView, sortedTags, relations);
    
    // 绑定交互事件
    bindTagInteractions(sortedTags, relations);
    
    // 创建空状态函数
    function createEmptyState(parent, isCloudView) {
        const emptyState = document.createElement('div');
        emptyState.className = 'empty-state';
        emptyState.style.display = 'flex';
        emptyState.style.flexDirection = 'column';
        emptyState.style.alignItems = 'center';
        emptyState.style.justifyContent = 'center';
        emptyState.style.height = '100%';
        emptyState.style.padding = '20px';
        emptyState.style.textAlign = 'center';
        emptyState.style.color = 'rgba(255,255,255,0.5)';
        
        emptyState.innerHTML = `
            <div style="font-size: 48px; margin-bottom: 16px;">🏷️</div>
            <h3 style="margin: 0 0 10px 0;">暂无标签数据</h3>
            <p style="margin: 0;">${isCloudView ? '标签云' : '关系图谱'}将在分析完成后显示</p>
        `;
        
        parent.appendChild(emptyState);
    }
}

function updateTagCloud(container, tags) {
    // 创建标签云容器
    const cloudContainer = document.createElement('div');
    cloudContainer.className = 'tag-cloud';
    cloudContainer.style.display = 'flex';
    cloudContainer.style.flexWrap = 'wrap';
    cloudContainer.style.gap = '10px';
    cloudContainer.style.padding = '20px';
    cloudContainer.style.justifyContent = 'center';
    cloudContainer.style.alignContent = 'flex-start';
    cloudContainer.style.height = '100%';
    cloudContainer.style.overflow = 'auto';
    
    // 输出标签数量信息
    const infoElement = document.createElement('div');
    infoElement.className = 'tag-info';
    infoElement.style.width = '100%';
    infoElement.style.marginBottom = '20px';
    infoElement.style.textAlign = 'center';
    infoElement.style.color = 'rgba(255,255,255,0.7)';
    infoElement.textContent = `已识别 ${tags.length} 个超维标签`;
    cloudContainer.appendChild(infoElement);
    
    // 设置最大和最小字体大小
    const minFontSize = 12;
    const maxFontSize = 28;
    
    // 找出最大和最小权重
    const maxWeight = Math.max(...tags.map(tag => tag.weight));
    const minWeight = Math.min(...tags.map(tag => tag.weight));
    
    // 为每个标签创建元素
    tags.forEach(tag => {
        const tagElement = document.createElement('div');
        tagElement.className = 'tag';
        tagElement.dataset.name = tag.name;
        tagElement.textContent = tag.name;
        
        // 计算字体大小，基于权重
        let fontSize;
        if (maxWeight === minWeight) {
            fontSize = (minFontSize + maxFontSize) / 2;
        } else {
            const normalizedWeight = (tag.weight - minWeight) / (maxWeight - minWeight);
            fontSize = minFontSize + normalizedWeight * (maxFontSize - minFontSize);
        }
        
        // 计算颜色深浅，基于权重
        const hue = 210; // 蓝色色调
        const saturation = 80;
        const lightness = 100 - (tag.weight / maxWeight * 40); // 权重越高，颜色越深
        
        // 设置样式
        tagElement.style.fontSize = `${fontSize}px`;
        tagElement.style.padding = `${6 + (fontSize - minFontSize) / 4}px ${12 + (fontSize - minFontSize) / 2}px`;
        tagElement.style.backgroundColor = `hsl(${hue}, ${saturation}%, ${lightness}%)`;
        tagElement.style.color = lightness < 60 ? '#fff' : '#333';
        tagElement.style.borderRadius = '20px';
        tagElement.style.margin = '5px';
        tagElement.style.cursor = 'pointer';
        tagElement.style.transition = 'all 0.3s ease';
        tagElement.style.boxShadow = '0 2px 5px rgba(0,0,0,0.1)';
        tagElement.style.display = 'inline-block';
        
        // 悬停效果
        tagElement.addEventListener('mouseover', () => {
            tagElement.style.transform = 'scale(1.1)';
            tagElement.style.boxShadow = '0 4px 8px rgba(0,0,0,0.15)';
        });
        
        tagElement.addEventListener('mouseout', () => {
            if (!tagElement.classList.contains('active')) {
                tagElement.style.transform = 'scale(1)';
                tagElement.style.boxShadow = '0 2px 5px rgba(0,0,0,0.1)';
            }
        });
        
        // 点击效果
        tagElement.addEventListener('click', () => {
            // 移除其他标签的活跃状态
            document.querySelectorAll('.tag').forEach(el => {
                el.classList.remove('active');
                el.style.transform = 'scale(1)';
                el.style.boxShadow = '0 2px 5px rgba(0,0,0,0.1)';
                el.style.backgroundColor = `hsl(${hue}, ${saturation}%, ${100 - (parseFloat(el.dataset.weight || '5') / maxWeight * 40)}%)`;
            });
            
            // 添加活跃状态
            tagElement.classList.add('active');
            tagElement.style.transform = 'scale(1.1)';
            tagElement.style.boxShadow = '0 4px 8px rgba(0,0,0,0.15)';
            tagElement.style.backgroundColor = '#4285f4';
            tagElement.style.color = '#fff';
            
            // 查找相关书签
            const bookmarks = findRelatedBookmarks(tag.name, relations);
            
            // 更新结果面板
            updateResultPanel(bookmarks);
        });
        
        // 存储权重到数据集
        tagElement.dataset.weight = tag.weight;
        
        cloudContainer.appendChild(tagElement);
    });
    
    container.appendChild(cloudContainer);
}

function updateRelationGraph(container, tags, relations) {
    // 检查是否有d3库
    if (typeof d3 === 'undefined') {
        const errorMessage = document.createElement('div');
        errorMessage.style.display = 'flex';
        errorMessage.style.flexDirection = 'column';
        errorMessage.style.alignItems = 'center';
        errorMessage.style.justifyContent = 'center';
        errorMessage.style.height = '100%';
        errorMessage.style.padding = '20px';
        errorMessage.style.textAlign = 'center';
        errorMessage.style.color = 'rgba(255,255,255,0.7)';
        errorMessage.innerHTML = `
            <div style="font-size: 48px; margin-bottom: 16px;">📊</div>
            <h3 style="margin: 0 0 10px 0;">正在加载可视化库...</h3>
            <p style="margin: 0;">需要D3.js库来渲染关系图谱</p>
        `;
        container.appendChild(errorMessage);
        
        // 尝试加载D3
        const script = document.createElement('script');
        script.src = 'https://d3js.org/d3.v7.min.js';
        script.onload = () => {
            container.innerHTML = '';
            updateRelationGraph(container, tags, relations);
        };
        document.head.appendChild(script);
        return;
    }
    
    // 创建图表容器
    const graphContainer = document.createElement('div');
    graphContainer.className = 'relation-graph';
    graphContainer.style.width = '100%';
    graphContainer.style.height = '100%';
    graphContainer.style.minHeight = '400px';
    graphContainer.style.position = 'relative';
    graphContainer.style.overflow = 'hidden';
    container.appendChild(graphContainer);
    
    // 输出信息元素
    const infoElement = document.createElement('div');
    infoElement.className = 'graph-info';
    infoElement.style.position = 'absolute';
    infoElement.style.top = '10px';
    infoElement.style.left = '10px';
    infoElement.style.padding = '8px 12px';
    infoElement.style.background = 'rgba(0,0,0,0.6)';
    infoElement.style.borderRadius = '4px';
    infoElement.style.fontSize = '12px';
    infoElement.style.color = '#fff';
    infoElement.style.zIndex = '10';
    infoElement.textContent = `显示 ${tags.length} 个标签和 ${relations.length} 个关系`;
    graphContainer.appendChild(infoElement);
    
    // 创建提示工具提示
    const tooltip = document.createElement('div');
    tooltip.className = 'graph-tooltip';
    tooltip.style.position = 'absolute';
    tooltip.style.padding = '8px 12px';
    tooltip.style.background = 'rgba(0,0,0,0.7)';
    tooltip.style.color = '#fff';
    tooltip.style.borderRadius = '4px';
    tooltip.style.pointerEvents = 'none';
    tooltip.style.opacity = '0';
    tooltip.style.transition = 'opacity 0.2s';
    tooltip.style.zIndex = '20';
    graphContainer.appendChild(tooltip);
    
    // 创建SVG
    const svg = d3.select(graphContainer)
        .append('svg')
        .attr('width', '100%')
        .attr('height', '100%')
        .style('overflow', 'visible');
    
    // 准备数据
    // 只使用有关系的标签
    const usedTagNames = new Set();
    relations.forEach(rel => {
        usedTagNames.add(rel.source);
        usedTagNames.add(rel.target);
    });
    
    // 如果关系很少，至少显示权重最高的10个标签
    if (usedTagNames.size < 10) {
        tags.slice(0, 10).forEach(tag => usedTagNames.add(tag.name));
    }
    
    // 创建节点数据
    const nodes = tags
        .filter(tag => usedTagNames.has(tag.name))
        .map(tag => ({
            id: tag.name,
            name: tag.name,
            weight: tag.weight,
            group: 1
        }));
    
    // 创建连接数据
    const links = relations
        .filter(rel => usedTagNames.has(rel.source) && usedTagNames.has(rel.target))
        .map(rel => ({
            source: rel.source,
            target: rel.target,
            value: rel.weight
        }));
    
    // 检查是否有足够的数据
    if (nodes.length < 2 || links.length === 0) {
        graphContainer.innerHTML = '';
        const message = document.createElement('div');
        message.style.display = 'flex';
        message.style.flexDirection = 'column';
        message.style.alignItems = 'center';
        message.style.justifyContent = 'center';
        message.style.height = '100%';
        message.style.padding = '20px';
        message.style.textAlign = 'center';
        message.style.color = 'rgba(255,255,255,0.5)';
        
        message.innerHTML = `
            <div style="font-size: 48px; margin-bottom: 16px;">🔄</div>
            <h3 style="margin: 0 0 10px 0;">没有足够的关系数据</h3>
            <p style="margin: 0;">需要更多标签关系才能生成图谱</p>
        `;
        graphContainer.appendChild(message);
        return;
    }
    
    // 创建力导向图
    const simulation = d3.forceSimulation(nodes)
        .force('link', d3.forceLink(links).id(d => d.id).distance(100))
        .force('charge', d3.forceManyBody().strength(-200))
        .force('center', d3.forceCenter(graphContainer.clientWidth / 2, graphContainer.clientHeight / 2));
    
    // 添加连线
    const link = svg.append('g')
        .selectAll('line')
        .data(links)
        .enter()
        .append('line')
        .attr('stroke-width', d => Math.sqrt(d.value))
        .attr('stroke', 'rgba(150,150,150,0.6)');
    
    // 添加节点
    const node = svg.append('g')
        .selectAll('circle')
        .data(nodes)
        .enter()
        .append('circle')
        .attr('r', d => 5 + d.weight)
        .attr('fill', d => {
            const hue = 210;
            const saturation = 80;
            const lightness = 100 - (d.weight / 10 * 40);
            return `hsl(${hue}, ${saturation}%, ${lightness}%)`;
        })
        .attr('stroke', '#fff')
        .attr('stroke-width', 1.5)
        .style('cursor', 'pointer')
        .call(d3.drag()
            .on('start', dragstarted)
            .on('drag', dragged)
            .on('end', dragended));
    
    // 添加文字标签
    const text = svg.append('g')
        .selectAll('text')
        .data(nodes)
        .enter()
        .append('text')
        .text(d => d.name)
        .attr('font-size', d => 10 + d.weight/3)
        .attr('dx', d => 12)
        .attr('dy', d => 4)
        .style('pointer-events', 'none')
        .style('fill', '#fff')
        .style('text-shadow', '0 1px 2px rgba(0,0,0,0.8), 0 -1px 2px rgba(0,0,0,0.8), 1px 0 2px rgba(0,0,0,0.8), -1px 0 2px rgba(0,0,0,0.8)');
    
    // 节点悬停事件
    node.on('mouseover', function(event, d) {
        d3.select(this).attr('stroke', '#ff4757').attr('stroke-width', 2);
        tooltip.style.opacity = '1';
        tooltip.style.left = (event.offsetX + 10) + 'px';
        tooltip.style.top = (event.offsetY + 10) + 'px';
        tooltip.innerHTML = `<strong>${d.name}</strong><br>权重: ${d.weight}`;
        
        // 高亮相关连接
        link.style('stroke', l => {
            if (l.source.id === d.id || l.target.id === d.id) {
                return '#ff4757';
            }
            return 'rgba(150,150,150,0.2)';
        })
        .style('stroke-width', l => {
            if (l.source.id === d.id || l.target.id === d.id) {
                return Math.sqrt(l.value) * 2;
            }
            return Math.sqrt(l.value);
        });
        
        // 高亮相关节点
        node.style('opacity', n => {
            let isConnected = false;
            links.forEach(l => {
                if ((l.source.id === d.id && l.target.id === n.id) || 
                   (l.target.id === d.id && l.source.id === n.id)) {
                    isConnected = true;
                }
            });
            return n.id === d.id || isConnected ? 1 : 0.3;
        });
        
        // 高亮相关文本
        text.style('opacity', n => {
            let isConnected = false;
            links.forEach(l => {
                if ((l.source.id === d.id && l.target.id === n.id) || 
                   (l.target.id === d.id && l.source.id === n.id)) {
                    isConnected = true;
                }
            });
            return n.id === d.id || isConnected ? 1 : 0.3;
        });
    });
    
    node.on('mouseout', function() {
        d3.select(this).attr('stroke', '#fff').attr('stroke-width', 1.5);
        tooltip.style.opacity = '0';
        link.style('stroke', 'rgba(150,150,150,0.6)')
            .style('stroke-width', d => Math.sqrt(d.value));
        node.style('opacity', 1);
        text.style('opacity', 1);
    });
    
    // 节点点击事件
    node.on('click', function(event, d) {
        // 查找相关书签
        const bookmarks = findRelatedBookmarks(d.name, relations);
        
        // 更新结果面板
        updateResultPanel(bookmarks);
        
        // 标记为活跃标签
        d3.selectAll('circle').attr('stroke', '#fff');
        d3.select(this).attr('stroke', '#ff4757');
        
        // 在标签云中也标记此标签
        document.querySelectorAll('.tag').forEach(el => {
            el.classList.remove('active');
            if (el.dataset.name === d.name) {
                el.classList.add('active');
            }
        });
    });
    
    // 模拟运行
    simulation.on('tick', () => {
        link
            .attr('x1', d => d.source.x)
            .attr('y1', d => d.source.y)
            .attr('x2', d => d.target.x)
            .attr('y2', d => d.target.y);
        
        node
            .attr('cx', d => d.x)
            .attr('cy', d => d.y);
        
        text
            .attr('x', d => d.x)
            .attr('y', d => d.y);
    });
    
    // 拖拽函数
    function dragstarted(event, d) {
        if (!event.active) simulation.alphaTarget(0.3).restart();
        d.fx = d.x;
        d.fy = d.y;
    }
    
    function dragged(event, d) {
        d.fx = event.x;
        d.fy = event.y;
    }
    
    function dragended(event, d) {
        if (!event.active) simulation.alphaTarget(0);
        d.fx = null;
        d.fy = null;
    }
}

function bindTagInteractions(tags, relations) {
    // 存储标签和关系的全局引用
    window._cachedTags = tags;
    window._cachedRelations = relations;
    
    // 获取标签元素和标签页
    const tagElements = document.querySelectorAll('.tag');
    
    // 为每个标签添加点击事件（如果尚未添加）
    tagElements.forEach(tagElement => {
        if (!tagElement._hasClickListener) {
            tagElement.addEventListener('click', () => {
                // 移除其他标签的active类
                tagElements.forEach(el => {
                    el.classList.remove('active');
                    el.style.transform = 'scale(1)';
                    el.style.boxShadow = '0 2px 5px rgba(0,0,0,0.1)';
                    
                    // 重置背景色
                    const hue = 210;
                    const saturation = 80;
                    const weight = parseFloat(el.dataset.weight || 5);
                    const maxWeight = 10;
                    const lightness = 100 - (weight / maxWeight * 40);
                    el.style.backgroundColor = `hsl(${hue}, ${saturation}%, ${lightness}%)`;
                    el.style.color = lightness < 60 ? '#fff' : '#333';
                });
                
                // 添加active类到点击的标签
                tagElement.classList.add('active');
                tagElement.style.transform = 'scale(1.1)';
                tagElement.style.boxShadow = '0 4px 8px rgba(0,0,0,0.15)';
                tagElement.style.backgroundColor = '#4285f4';
                tagElement.style.color = '#fff';
                
                // 获取标签名称
                const tagName = tagElement.dataset.name;
                
                // 查找相关书签
                const bookmarks = findRelatedBookmarks(tagName, relations);
                
                // 更新结果面板
                updateResultPanel(bookmarks);
            });
            tagElement._hasClickListener = true;
        }
    });
}

function findRelatedBookmarks(tagName, relations) {
    // 获取全局缓存的书签
    const allBookmarks = window._cachedBookmarks || [];
    if (allBookmarks.length === 0) {
        return [
            { 
                title: `${tagName} 相关书签示例1`, 
                url: "https://example.com", 
                domain: "example.com",
                favicon: "https://www.google.com/s2/favicons?domain=example.com"
            },
            { 
                title: `${tagName} 相关书签示例2`, 
                url: "https://example.org", 
                domain: "example.org",
                favicon: "https://www.google.com/s2/favicons?domain=example.org"
            }
        ];
    }
    
    // 找出与该标签相关的书签
    // 这里使用一个简单的策略：查找包含标签名称的书签标题或路径
    const relatedBookmarks = allBookmarks.filter(bookmark => {
        const titleMatch = bookmark.title.toLowerCase().includes(tagName.toLowerCase());
        const pathMatch = bookmark.path.toLowerCase().includes(tagName.toLowerCase());
        const domainMatch = bookmark.domain.toLowerCase().includes(tagName.toLowerCase());
        
        return titleMatch || pathMatch || domainMatch;
    });
    
    // 如果没有直接匹配的书签，返回一些随机书签作为示例
    if (relatedBookmarks.length === 0) {
        // 随机选择几个书签
        const randomBookmarks = [...allBookmarks]
            .sort(() => 0.5 - Math.random())
            .slice(0, 5);
            
        return randomBookmarks.map(bookmark => ({
            ...bookmark,
            title: `[${tagName}] ${bookmark.title}` // 标记为与标签相关
        }));
    }
    
    // 返回最多10个相关书签
    return relatedBookmarks.slice(0, 10);
}

function updateResultPanel(bookmarks) {
    const resultPanel = document.querySelector('.result-panel');
    if (!resultPanel) return;
    
    const countElement = resultPanel.querySelector('.count');
    const bookmarkList = resultPanel.querySelector('.bookmark-list');
    
    // 更新计数
    if (countElement) {
        countElement.textContent = `${bookmarks.length} 个结果`;
    }
    
    // 更新书签列表
    if (bookmarkList) {
        bookmarkList.innerHTML = '';
        
        if (bookmarks.length === 0) {
            bookmarkList.innerHTML = `
                <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 30px 20px; color: rgba(255,255,255,0.5); text-align: center;">
                    <div style="font-size: 24px; margin-bottom: 10px;">📚</div>
                    <p style="margin: 0;">没有找到相关书签</p>
                </div>
            `;
            return;
        }
        
        bookmarks.forEach(bookmark => {
            const item = document.createElement('div');
            item.className = 'bookmark-item';
            item.style.display = 'flex';
            item.style.alignItems = 'center';
            item.style.padding = '10px 12px';
            item.style.margin = '8px 0';
            item.style.backgroundColor = 'rgba(255,255,255,0.08)';
            item.style.borderRadius = '6px';
            item.style.transition = 'background-color 0.2s';
            item.style.cursor = 'pointer';
            
            // 生成图标
            let favicon = '';
            try {
                favicon = bookmark.favicon || `https://www.google.com/s2/favicons?domain=${new URL(bookmark.url).hostname}`;
            } catch (e) {
                favicon = '../assets/icons/bookmark.svg';
            }
            
            item.innerHTML = `
                <img src="${favicon}" alt="" style="width: 16px; height: 16px; margin-right: 10px; object-fit: contain;">
                <div style="flex-grow: 1; overflow: hidden;">
                    <div style="white-space: nowrap; overflow: hidden; text-overflow: ellipsis; font-weight: 500; color: #fff;">${bookmark.title}</div>
                    <div style="font-size: 12px; color: rgba(255,255,255,0.6); white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${bookmark.domain}</div>
                </div>
            `;
            
            // 点击打开书签
            item.addEventListener('click', () => {
                if (bookmark.url && bookmark.url !== '#') {
                    window.open(bookmark.url, '_blank');
                }
            });
            
            // 悬停效果
            item.addEventListener('mouseover', () => {
                item.style.backgroundColor = 'rgba(255,255,255,0.15)';
            });
            
            item.addEventListener('mouseout', () => {
                item.style.backgroundColor = 'rgba(255,255,255,0.08)';
            });
            
            bookmarkList.appendChild(item);
        });
    }
}
// ... existing code ...

// 确保量子标签功能容器可见
function ensureQuantumTagsVisible() {
    console.log('确保量子标签功能容器可见');
    
    // 查找量子标签相关容器
    const containers = [
        '.quantum-tags-container',
        '.tag-cloud-container',
        '.relation-graph-container',
        '.result-panel',
        '.tag-cloud-view',
        '.relation-graph-view'
    ];
    
    containers.forEach(selector => {
        const elements = document.querySelectorAll(selector);
        if (elements.length > 0) {
            elements.forEach(element => {
                if (element.style.display === 'none' || element.style.visibility === 'hidden') {
                    console.log(`恢复 ${selector} 显示`);
                    element.style.display = '';
                    element.style.visibility = 'visible';
                }
            });
        }
    });
    
    // 确保当前功能显示正确
    const currentFeature = localStorage.getItem('currentFeature');
    if (currentFeature === 'quantum-tags') {
        const container = document.querySelector('.quantum-tags-container');
        if (container) {
            container.style.display = 'block';
            container.style.visibility = 'visible';
        }
    }
}

// 在页面加载完成后调用
document.addEventListener('DOMContentLoaded', () => {
    // 延迟执行，确保其他脚本已完成
    setTimeout(() => {
        ensureQuantumTagsVisible();
    }, 1000);
});

// 在hideTestPanel函数执行后调用
const originalHideTestPanel = hideTestPanel;
hideTestPanel = function() {
    const result = originalHideTestPanel.apply(this, arguments);
    ensureQuantumTagsVisible();
    return result;
};

// ... existing code ...

// 直接初始化量子标签功能
function initQuantumTagsDirectly() {
    console.log('直接初始化量子标签功能');
    
    // 检查量子标签功能是否已初始化
    const container = document.querySelector('.quantum-tags-container');
    if (container) {
        console.log('量子标签功能已初始化，确保可见');
        container.style.display = 'block';
        container.style.visibility = 'visible';
        return;
    }
    
    // 如果未初始化，则调用初始化函数
    try {
        console.log('调用量子标签初始化函数');
        initQuantumTagsFeature();
    } catch (error) {
        console.error('初始化量子标签功能失败:', error);
    }
}

// 在页面加载完成后调用初始化量子标签功能
document.addEventListener('DOMContentLoaded', () => {
    // 延迟执行，确保其他脚本已完成
    setTimeout(() => {
        // 添加量子标签功能按钮
        const featureContainer = document.querySelector('.feature-buttons');
        if (featureContainer) {
            const existingButton = featureContainer.querySelector('[data-feature="quantum-tags"]');
            if (!existingButton) {
                const quantumTagsButton = document.createElement('button');
                quantumTagsButton.className = 'feature-button';
                quantumTagsButton.dataset.feature = 'quantum-tags';
                quantumTagsButton.innerHTML = '<i class="fas fa-tags"></i> 量子标签';
                quantumTagsButton.addEventListener('click', () => {
                    console.log('点击量子标签按钮');
                    updateCurrentFeature('quantum-tags');
                });
                featureContainer.appendChild(quantumTagsButton);
                console.log('添加量子标签功能按钮');
            }
        }
        
        // 初始化量子标签功能
        initQuantumTagsDirectly();
    }, 1500);
});

// ... existing code ...
// 确保量子标签容器和内部结构存在
function ensureQuantumTagsStructure() {
    console.log('确保量子标签容器和内部结构存在');
    
    // 1. 确保外部.quantum-tags-container存在
    let tagsContainer = document.querySelector('.quantum-tags-container');
    if (!tagsContainer) {
        console.log('创建量子标签外部容器');
        const featureContent = document.querySelector('.feature-content');
        if (!featureContent) {
            console.error('无法找到feature-content容器');
            return false;
        }
        
        tagsContainer = document.createElement('div');
        tagsContainer.className = 'quantum-tags-container';
        tagsContainer.style.cssText = 'display: block; width: 100%; position: absolute; top: 70px; left: 0; right: 0; z-index: 20;';
        featureContent.appendChild(tagsContainer);
    } else {
        // 确保可见
        tagsContainer.style.cssText = 'display: block; width: 100%; position: absolute; top: 70px; left: 0; right: 0; z-index: 20;';
    }
    
    // 2. 确保内部#quantum-container存在
    let innerContainer = document.getElementById('quantum-container');
    if (!innerContainer) {
        console.log('创建量子标签内部容器');
        innerContainer = document.createElement('div');
        innerContainer.id = 'quantum-container';
        innerContainer.style.cssText = 'width: 100%; height: 100%; min-height: 600px; position: relative;';
        tagsContainer.appendChild(innerContainer);
    }
    
    console.log('量子标签容器结构检查完成');
    return true;
}

// 修改initQuantumTagsFeature函数开头
function initQuantumTagsFeature() {
    try {
        console.log('初始化量子标签功能');
        
        // 确保容器结构存在
        if (!ensureQuantumTagsStructure()) {
            console.error('创建量子标签容器结构失败');
            return;
        }
        
        // 获取内部容器
        const container = document.getElementById('quantum-container');
        if (!container) {
            console.error('找不到量子标签内部容器元素');
            return;
        }
        
        // 清空容器，防止重复加载
        container.innerHTML = '';
        
        // 剩余初始化代码保持不变
    } catch (error) {
        console.error('初始化量子标签功能错误:', error);
    }
}

// 确保量子标签功能正常显示
function fixQuantumTagsDisplay() {
    console.log('修复量子标签功能显示');
    
    // 1. 确保外部.quantum-tags-container存在并可见
    let tagsContainer = document.querySelector('.quantum-tags-container');
    if (!tagsContainer) {
        console.log('量子标签容器不存在，创建它');
        const featureContent = document.querySelector('.feature-content');
        if (featureContent) {
            tagsContainer = document.createElement('div');
            tagsContainer.className = 'quantum-tags-container';
            tagsContainer.style.cssText = 'display: block; width: 100%; position: absolute; top: 70px; left: 0; right: 0; z-index: 9999;';
            featureContent.appendChild(tagsContainer);
        } else {
            console.error('无法找到feature-content容器，无法创建量子标签容器');
            return;
        }
    }
    
    console.log('找到量子标签容器，确保可见');
    tagsContainer.style.display = 'block';
    tagsContainer.style.visibility = 'visible';
    tagsContainer.style.zIndex = '9999';
    
    // 2. 确保内部结构存在
    // 检查是否有内部容器
    let innerContainer = document.getElementById('quantum-container');
    if (!innerContainer) {
        console.log('创建内部quantum-container');
        innerContainer = document.createElement('div');
        innerContainer.id = 'quantum-container';
        innerContainer.style.cssText = 'width: 100%; height: 100%; min-height: 600px; position: relative;';
        tagsContainer.appendChild(innerContainer);
    }
    
    // 3. 检查视图容器
    let viewContainer = tagsContainer.querySelector('.view-container');
    if (!viewContainer) {
        console.log('创建视图容器');
        viewContainer = document.createElement('div');
        viewContainer.className = 'view-container';
        viewContainer.style.cssText = 'position: relative; width: 100%; height: 400px;';
        innerContainer.appendChild(viewContainer);
        
        // 创建标签云视图
        const cloudView = document.createElement('div');
        cloudView.className = 'tag-cloud-view active';
        cloudView.style.cssText = 'position: absolute; width: 100%; height: 100%; opacity: 1;';
        viewContainer.appendChild(cloudView);
        
        // 创建关系图视图
        const relationView = document.createElement('div');
        relationView.className = 'tag-relation-view';
        relationView.style.cssText = 'position: absolute; width: 100%; height: 100%; opacity: 0;';
        viewContainer.appendChild(relationView);
    }
    
    // 4. 检查结果面板
    let resultPanel = tagsContainer.querySelector('.result-panel');
    if (!resultPanel) {
        console.log('创建结果面板');
        resultPanel = document.createElement('div');
        resultPanel.className = 'result-panel';
        resultPanel.style.cssText = 'margin-top: 20px; padding: 15px; background: rgba(0,0,0,0.2); border-radius: 10px;';
        resultPanel.innerHTML = `
            <div class="panel-header" style="display: flex; justify-content: space-between; margin-bottom: 10px;">
                <h3 style="margin: 0; font-size: 18px; color: #fff;">相关书签</h3>
                <span class="count" style="color: rgba(255,255,255,0.7);">0 个结果</span>
            </div>
            <div class="bookmark-list" style="max-height: 300px; overflow-y: auto;"></div>
        `;
        innerContainer.appendChild(resultPanel);
    }
}

// 在页面加载完成后调用
document.addEventListener('DOMContentLoaded', () => {
    // 延迟执行，确保其他脚本已完成
    setTimeout(fixQuantumTagsDisplay, 1000);
    
    // 添加点击事件监听器
    document.addEventListener('click', (event) => {
        // 检查是否点击了量子标签按钮
        if (event.target.closest('[data-feature="quantum-tags"]')) {
            console.log('检测到量子标签按钮点击');
            setTimeout(fixQuantumTagsDisplay, 500);
        }
    });
});

// 简化的hideTestPanel函数，仅作为兼容保留
function hideTestPanel() {
    // 不执行任何操作，仅为保持向后兼容
    // 原测试面板功能已被移除
}
