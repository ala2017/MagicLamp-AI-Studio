// 检测浏览器类型
const isMicrosoftEdge = navigator.userAgent.includes('Edg');
const browserAPI = isMicrosoftEdge ? chrome : chrome;  // Edge使用chrome命名空间

// 查找重复状态
let isSearching = false;
let searchProgress = {
    completed: [],
    remaining: [],
    total: 0,
    groups: []
};

// 获取DOM元素
const duplicateElements = {
    progressBar: document.querySelector('.progress-inner'),
    currentUrl: document.querySelector('.current-url'),
    completed: document.querySelector('.completed'),
    total: document.querySelector('.total'),
    groupCount: document.querySelector('.group-count'),
    duplicateCount: document.querySelector('.duplicate-count'),
    results: document.querySelector('.duplicate-results')
};

// 控制按钮
const duplicateControls = {
    stop: document.querySelector('.btn-stop'),
    restart: document.querySelector('.btn-restart'),
    batch: document.querySelector('.btn-batch')
};

// 更新按钮状态
function updateDuplicateButtons(state) {
    duplicateControls.stop.disabled = !state.isSearching;
    duplicateControls.restart.disabled = state.isSearching;
    duplicateControls.batch.disabled = !searchProgress.groups.length;
}

// 添加事件监听器
function setupEventListeners() {
    duplicateControls.restart.addEventListener('click', findDuplicates);
    duplicateControls.stop.addEventListener('click', () => {
        isSearching = false;
        updateDuplicateButtons({ isSearching });
        duplicateElements.currentUrl.textContent = '查找已终止';
    });
    
    duplicateControls.batch.addEventListener('click', showBatchMenu);
    
    // 批量处理菜单外部点击关闭
    document.addEventListener('click', (e) => {
        const batchMenu = document.querySelector('.batch-menu');
        if (batchMenu && batchMenu.classList.contains('show') && 
            !batchMenu.contains(e.target) && 
            !duplicateControls.batch.contains(e.target)) {
            batchMenu.classList.remove('show');
        }
    });
}

// 显示批量处理菜单
function showBatchMenu() {
    let batchMenu = document.querySelector('.batch-menu');
    
    if (!batchMenu) {
        batchMenu = document.createElement('div');
        batchMenu.className = 'batch-menu';
        
        const keepNewestItem = document.createElement('div');
        keepNewestItem.className = 'batch-menu-item';
        keepNewestItem.textContent = '保留最新添加的';
        keepNewestItem.addEventListener('click', () => {
            batchProcess('newest');
            batchMenu.classList.remove('show');
        });
        
        const keepOldestItem = document.createElement('div');
        keepOldestItem.className = 'batch-menu-item';
        keepOldestItem.textContent = '保留最早添加的';
        keepOldestItem.addEventListener('click', () => {
            batchProcess('oldest');
            batchMenu.classList.remove('show');
        });
        
        batchMenu.appendChild(keepNewestItem);
        batchMenu.appendChild(keepOldestItem);
        
        duplicateControls.batch.parentNode.appendChild(batchMenu);
    }
    
    batchMenu.classList.toggle('show');
}

// 批量处理重复书签
function batchProcess(criteria) {
    if (isSearching) return;
    
    const groups = searchProgress.groups;
    if (!groups.length) return;
    
    groups.forEach(group => {
        // 复制数组以便排序不影响原数组
        const sortedItems = [...group];
        
        // 根据条件排序
        if (criteria === 'newest') {
            sortedItems.sort((a, b) => b.dateAdded - a.dateAdded);
        } else if (criteria === 'oldest') {
            sortedItems.sort((a, b) => a.dateAdded - b.dateAdded);
        }
        
        // 保留第一个项目，删除其他所有项目
        for (let i = 1; i < sortedItems.length; i++) {
            const bookmarkToRemove = sortedItems[i];
            browserAPI.bookmarks.remove(bookmarkToRemove.id);
        }
    });
    
    // 重新查找（清空已删除的项目）
    findDuplicates();
}

// 创建重复组元素
function createDuplicateGroup(items, index) {
    const group = document.createElement('div');
    group.className = 'duplicate-group';
    
    const header = document.createElement('div');
    header.className = 'group-header';
    
    const title = document.createElement('div');
    title.className = 'group-title';
    title.textContent = `组 ${index + 1}: ${items[0].url}`;
    
    header.appendChild(title);
    group.appendChild(header);
    
    const itemsList = document.createElement('div');
    itemsList.className = 'duplicate-items';
    
    items.forEach(bookmark => {
        const item = createDuplicateItem(bookmark);
        itemsList.appendChild(item);
    });
    
    group.appendChild(itemsList);
    return group;
}

// 创建重复项元素
function createDuplicateItem(bookmark) {
    const item = document.createElement('div');
    item.className = 'duplicate-item';
    item.dataset.id = bookmark.id;
    
    const info = document.createElement('div');
    info.className = 'item-info';
    
    const title = document.createElement('div');
    title.className = 'item-title';
    title.textContent = bookmark.title || '未命名书签';
    info.appendChild(title);
    
    const path = document.createElement('div');
    path.className = 'item-path';
    path.textContent = bookmark.path || '(根目录)';
    info.appendChild(path);
    
    const meta = document.createElement('div');
    meta.className = 'item-meta';
    
    const date = document.createElement('span');
    date.textContent = `添加时间: ${formatDate(bookmark.dateAdded)}`;
    meta.appendChild(date);
    
    if (bookmark.visits !== undefined) {
        const visits = document.createElement('span');
        visits.textContent = `访问次数: ${bookmark.visits || 0}`;
        meta.appendChild(visits);
    }
    
    if (bookmark.lastVisit) {
        const lastVisit = document.createElement('span');
        lastVisit.textContent = `上次访问: ${formatDate(bookmark.lastVisit)}`;
        meta.appendChild(lastVisit);
    }
    
    info.appendChild(meta);
    item.appendChild(info);
    
    const actions = document.createElement('div');
    actions.className = 'item-actions';
    
    const deleteBtn = document.createElement('button');
    deleteBtn.className = 'delete-btn';
    deleteBtn.textContent = '删除';
    deleteBtn.addEventListener('click', () => {
        // 添加删除动画
        item.classList.add('deleting');
        
        // 动画结束后删除书签
        setTimeout(() => {
            browserAPI.bookmarks.remove(bookmark.id, () => {
                // 更新UI
                const group = item.closest('.duplicate-group');
                item.remove();
                
                // 如果组内没有更多项目，移除整个组
                if (group && group.querySelector('.duplicate-item') === null) {
                    group.remove();
                    
                    // 更新组数量
                    const groupCount = document.querySelector('.group-count');
                    groupCount.textContent = parseInt(groupCount.textContent) - 1;
                }
                
                // 更新重复项数量
                const duplicateCount = document.querySelector('.duplicate-count');
                duplicateCount.textContent = parseInt(duplicateCount.textContent) - 1;
            });
        }, 300);
    });
    
    actions.appendChild(deleteBtn);
    item.appendChild(actions);
    
    return item;
}

// 查找重复书签
async function findDuplicates() {
    if (isSearching) return;
    
    isSearching = true;
    updateDuplicateButtons({ isSearching });
    
    // 清空结果
    duplicateElements.results.innerHTML = '';
    duplicateElements.progressBar.style.width = '0';
    duplicateElements.currentUrl.textContent = '正在获取书签...';
    
    // 获取所有书签
    try {
        const bookmarks = await new Promise(resolve => browserAPI.bookmarks.getTree(resolve));
        const allBookmarks = [];
        
        // 获取历史记录，扩大搜索范围
        const history = await new Promise(resolve => browserAPI.history.search({
            text: '',  // 搜索所有URL
            startTime: 0,  // 从最早的记录开始
            maxResults: 100000,  // 增加获取数量
            endTime: Date.now()  // 到当前时间
        }, resolve));

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
            const key = bookmark.url.toLowerCase(); // 使用原始URL的小写形式，与原版保持一致
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
        if (duplicateGroups.length === 0) {
            const emptyMessage = document.createElement('div');
            emptyMessage.className = 'empty-message';
            emptyMessage.textContent = '未找到重复书签';
            duplicateElements.results.appendChild(emptyMessage);
        } else {
            duplicateGroups.forEach((group, index) => {
                const groupElement = createDuplicateGroup(group, index);
                duplicateElements.results.appendChild(groupElement);
            });
        }
        
        // 完成查找
        isSearching = false;
        duplicateElements.currentUrl.textContent = '查找完成';
        duplicateElements.progressBar.style.width = '100%';
        updateDuplicateButtons({ isSearching });
    } catch (error) {
        console.error('查找重复书签时出错:', error);
        duplicateElements.currentUrl.textContent = '查找时出错: ' + error.message;
        isSearching = false;
        updateDuplicateButtons({ isSearching });
    }
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

// 格式化日期
function formatDate(timestamp) {
    if (!timestamp) return '未知';
    
    const date = new Date(timestamp);
    const now = new Date();
    const diffDays = Math.floor((now - date) / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) {
        return '今天 ' + date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
    } else if (diffDays === 1) {
        return '昨天 ' + date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
    } else if (diffDays < 7) {
        return diffDays + '天前';
    } else {
        return date.toLocaleDateString('zh-CN', { 
            year: 'numeric', 
            month: '2-digit', 
            day: '2-digit' 
        });
    }
}

// 初始化页面
function initPage() {
    console.log('初始化查找重复页面');
    setupEventListeners();
    
    // 自动开始查找
    findDuplicates();
}

// 页面加载时初始化
document.addEventListener('DOMContentLoaded', initPage); 