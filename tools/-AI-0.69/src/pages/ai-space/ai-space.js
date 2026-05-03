// 等待DOM加载完成
document.addEventListener('DOMContentLoaded', function() {
    console.log('AI辅助功能页面加载完成');
    
    // 初始化页面
    initPage();
    
    // 添加事件监听器
    addEventListeners();
    
    // 加载书签统计数据
    loadBookmarkStats();
    
    // 添加侧边栏导航功能
    setupSidebarNavigation();
    
    // 初始化量子云图
    initCloudMap();
});

/**
 * 初始化页面
 */
function initPage() {
    console.log('初始化AI辅助功能页面');
    
    // 检查当前主题并应用
    applyCurrentTheme();
}

/**
 * 添加事件监听器
 */
function addEventListeners() {
    // 导航按钮事件
    document.getElementById('homeBtn').addEventListener('click', () => {
        window.location.href = '/src/pages/home/home.html';
    });
    
    document.getElementById('checkBtn').addEventListener('click', () => {
        window.location.href = '/src/pages/bookmark-check/link-check.html';
    });
    
    document.getElementById('duplicateBtn').addEventListener('click', () => {
        window.location.href = '/src/pages/duplicate-finder/duplicate.html';
    });
    
    // 主题切换
    document.getElementById('themeToggle').addEventListener('click', toggleTheme);
    
    // 随机书签
    document.getElementById('randomBookmark').addEventListener('click', openRandomBookmark);
    
    // 随机书签按钮动画
    const randomBtn = document.getElementById('randomBookmark');
    randomBtn.addEventListener('mouseover', () => {
        randomBtn.style.animation = 'none';
        randomBtn.offsetHeight; // 触发重绘
        randomBtn.style.animation = 'diceRoll 2s ease-in-out infinite';
    });
}

/**
 * 设置侧边栏导航功能
 */
function setupSidebarNavigation() {
    // 获取所有侧边栏按钮
    const sidebarButtons = document.querySelectorAll('.sidebar-item');
    const contentContainers = document.querySelectorAll('.content-container');
    
    // 为每个按钮添加点击事件
    sidebarButtons.forEach(button => {
        button.addEventListener('click', () => {
            // 移除所有按钮的active类
            sidebarButtons.forEach(btn => btn.classList.remove('active'));
            
            // 为当前点击的按钮添加active类
            button.classList.add('active');
            
            // 隐藏所有内容容器
            contentContainers.forEach(container => {
                container.classList.add('hidden');
            });
            
            // 显示对应的内容容器
            const contentId = button.id.replace('Btn', 'Content');
            const contentContainer = document.getElementById(contentId);
            
            if (contentContainer) {
                contentContainer.classList.remove('hidden');
                
                // 如果是模型设置按钮，加载模型设置页面
                if (button.id === 'modelConfigBtn') {
                    loadModelSettings();
                }
                
                // 如果是量子云图按钮，加载量子云图
                if (button.id === 'cloudMapBtn') {
                    loadCloudMapPreview();
                }
            }
        });
    });
    
    // 添加功能页面跳转
    document.getElementById('cloudMapBtn').addEventListener('dblclick', () => {
        window.location.href = '/src/pages/ai-space/cloud-map/cloud-map.html';
    });
    
    document.getElementById('hyperTagsBtn').addEventListener('dblclick', () => {
        window.location.href = '/src/pages/ai-space/hyper-tags/hyper-tags.html';
    });
    
    document.getElementById('dataAnalysisBtn').addEventListener('dblclick', () => {
        window.location.href = '/src/pages/ai-space/data-analysis/analysis.html';
    });
    
    document.getElementById('autoClusterBtn').addEventListener('dblclick', () => {
        window.location.href = '/src/pages/ai-space/auto-cluster/cluster.html';
    });
}

/**
 * 加载书签统计数据
 */
function loadBookmarkStats() {
    console.log('加载书签统计数据');
    
    // 使用Chrome书签API获取书签数据
    chrome.bookmarks.getTree(function(bookmarkTreeNodes) {
        // 计算书签和文件夹数量
        const counts = countBookmarksAndFolders(bookmarkTreeNodes[0]);
        
        // 更新UI显示
        document.getElementById('totalBookmarks').textContent = counts.bookmarks;
        document.getElementById('totalFolders').textContent = counts.folders;
        
        console.log(`统计完成: ${counts.bookmarks}个书签, ${counts.folders}个文件夹`);
    });
}

/**
 * 递归计算书签和文件夹数量
 * @param {Object} node - 书签树节点
 * @returns {Object} 包含书签和文件夹数量的对象
 */
function countBookmarksAndFolders(node) {
    let bookmarks = 0;
    let folders = 0;
    
    // 如果节点有子节点，则为文件夹
    if (node.children) {
        folders++;
        
        // 递归处理子节点
        node.children.forEach(child => {
            const counts = countBookmarksAndFolders(child);
            bookmarks += counts.bookmarks;
            folders += counts.folders;
        });
    } else if (node.url) {
        // 如果节点有URL，则为书签
        bookmarks++;
    }
    
    return { bookmarks, folders };
}

/**
 * 切换主题
 */
function toggleTheme() {
    console.log('切换主题');
    
    // 获取当前主题
    const currentTheme = document.documentElement.getAttribute('data-theme') || 'dark';
    
    // 切换主题
    const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
    
    // 更新HTML元素的data-theme属性
    document.documentElement.setAttribute('data-theme', newTheme);
    
    // 更新body元素的data-theme属性，确保CSS选择器能正确匹配
    document.body.setAttribute('data-theme', newTheme);
    
    // 保存主题设置
    chrome.storage.sync.set({ theme: newTheme }, function() {
        console.log(`主题已切换为: ${newTheme}`);
    });
    
    // 更新图标颜色
    updateIconColors(newTheme);
}

/**
 * 应用当前主题
 */
function applyCurrentTheme() {
    // 从存储中获取主题设置
    chrome.storage.sync.get('theme', function(data) {
        const theme = data.theme || 'dark';
        
        // 更新HTML元素的data-theme属性
        document.documentElement.setAttribute('data-theme', theme);
        
        // 更新body元素的data-theme属性，确保CSS选择器能正确匹配
        document.body.setAttribute('data-theme', theme);
        
        console.log(`应用主题: ${theme}`);
        
        // 更新图标颜色
        updateIconColors(theme);
    });
}

/**
 * 更新图标颜色
 * @param {string} theme - 当前主题
 */
function updateIconColors(theme) {
    // 由于我们使用了CSS变量和currentColor，
    // 图标颜色会自动随主题变化，不需要额外的JavaScript代码
    console.log(`图标颜色已更新为${theme}主题`);
}

/**
 * 打开随机书签
 */
function openRandomBookmark() {
    console.log('打开随机书签');
    
    chrome.bookmarks.getTree(function(bookmarkTreeNodes) {
        // 获取所有书签
        const allBookmarks = getAllBookmarks(bookmarkTreeNodes[0]);
        
        if (allBookmarks.length > 0) {
            // 随机选择一个书签
            const randomIndex = Math.floor(Math.random() * allBookmarks.length);
            const randomBookmark = allBookmarks[randomIndex];
            
            // 在新标签页中打开书签
            chrome.tabs.create({ url: randomBookmark.url });
            console.log(`打开随机书签: ${randomBookmark.title}`);
        } else {
            console.log('没有找到书签');
        }
    });
}

/**
 * 递归获取所有书签
 * @param {Object} node - 书签树节点
 * @returns {Array} 书签数组
 */
function getAllBookmarks(node) {
    let bookmarks = [];
    
    if (node.children) {
        // 递归处理子节点
        node.children.forEach(child => {
            bookmarks = bookmarks.concat(getAllBookmarks(child));
        });
    } else if (node.url) {
        // 如果节点有URL，则为书签
        bookmarks.push(node);
    }
    
    return bookmarks;
}

// 加载模型设置页面
function loadModelSettings() {
    console.log('开始加载模型设置页面');
    const modelSettingsContent = document.getElementById('modelConfigContent');
    
    // 如果内容还没有加载过
    if (!modelSettingsContent.dataset.loaded) {
        try {
            // 加载模型设置页面
            fetch('/src/pages/ai-space/model-config/model-settings.html')
                .then(response => {
                    if (!response.ok) {
                        throw new Error(`HTTP error! status: ${response.status}`);
                    }
                    return response.text();
                })
                .then(html => {
                    // 设置HTML内容
                    modelSettingsContent.innerHTML = html;
                    modelSettingsContent.dataset.loaded = 'true';
                    console.log('模型设置HTML加载完成');
                    
                    // 确保加载模型设置的CSS
                    if (!document.querySelector('link[href="/src/pages/ai-space/model-config/model-settings.css"]')) {
                        const link = document.createElement('link');
                        link.rel = 'stylesheet';
                        link.href = '/src/pages/ai-space/model-config/model-settings.css';
                        document.head.appendChild(link);
                        console.log('模型设置CSS加载完成');
                    }
                    
                    // 加载模型设置的JS
                    if (!window.APIService) {
                        const script = document.createElement('script');
                        script.src = '/src/pages/ai-space/model-config/model-settings.js';
                        script.onerror = (error) => {
                            console.error('模型设置脚本加载失败:', error);
                            NotificationManager.show(
                                '加载失败',
                                '模型设置脚本加载失败，请刷新页面重试',
                                'error',
                                5000
                            );
                        };
                        document.body.appendChild(script);
                        
                        // 等待脚本加载完成
                        script.onload = () => {
                            console.log('模型设置脚本加载完成');
                            // 手动初始化，以防DOMContentLoaded事件已经触发
                            if (window.initialize && typeof window.initialize === 'function') {
                                console.log('手动初始化模型设置');
                                window.initialize();
                            }
                        };
                    }
                })
                .catch(error => {
                    console.error('加载模型设置页面失败:', error);
                    modelSettingsContent.innerHTML = `
                        <div class="error-message">
                            <h3>加载模型设置失败</h3>
                            <p>${error.message}</p>
                            <button onclick="loadModelSettings()">重试</button>
                        </div>
                    `;
                });
        } catch (error) {
            console.error('加载模型设置页面出错:', error);
            modelSettingsContent.innerHTML = `
                <div class="error-message">
                    <h3>加载模型设置出错</h3>
                    <p>${error.message}</p>
                    <button onclick="loadModelSettings()">重试</button>
                </div>
            `;
        }
    }
}

// 初始化模型标签页
function initModelTabs() {
    const modelSettingsContent = document.getElementById('modelConfigContent');
    const providerTabs = modelSettingsContent.querySelectorAll('.model-tab');
    
    // 确保所有标签都有正确的样式
    providerTabs.forEach(tab => {
        // 移除所有标签页的active类
        tab.classList.remove('active');
        
        // 为第一个标签添加active类
        if (tab.getAttribute('data-provider') === 'siliconio') {
            tab.classList.add('active');
        }
        
        // 重新绑定点击事件
        tab.addEventListener('click', () => {
            // 移除所有标签页的active类
            providerTabs.forEach(t => t.classList.remove('active'));
            // 为当前标签页添加active类
            tab.classList.add('active');
            
            // 获取服务商ID
            const provider = tab.getAttribute('data-provider');
            
            // 隐藏所有内容区域
            const contents = modelSettingsContent.querySelectorAll('.model-tab-content');
            contents.forEach(content => content.classList.remove('active'));
            
            // 显示对应的内容区域
            const content = modelSettingsContent.querySelector(`#${provider}-content`);
            if (content) {
                content.classList.add('active');
            }
        });
    });
    
    // 确保内容区域显示正确
    const contents = modelSettingsContent.querySelectorAll('.model-tab-content');
    contents.forEach(content => content.classList.remove('active'));
    const firstContent = modelSettingsContent.querySelector('#siliconio-content');
    if (firstContent) {
        firstContent.classList.add('active');
    }
}

/**
 * 初始化量子云图
 */
function initCloudMap() {
    console.log('初始化量子云图');
    
    // 创建量子云图预览容器
    const cloudMapContainer = document.getElementById('cloud-map-container');
    if (!cloudMapContainer) return;
    
    // 创建iframe加载量子云图
    const iframe = document.createElement('iframe');
    iframe.src = '/src/pages/ai-space/cloud-map/cloud-map.html';
    iframe.className = 'cloud-map-iframe';
    iframe.style.width = '100%';
    iframe.style.height = '100%'; // 使用100%高度填充容器
    iframe.style.border = 'none';
    iframe.style.borderRadius = '10px';
    iframe.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.1)';
    
    cloudMapContainer.appendChild(iframe);
}

/**
 * 加载量子云图预览
 */
function loadCloudMapPreview() {
    console.log('加载量子云图预览');
    
    // 获取内容容器
    const cloudMapContainer = document.getElementById('cloud-map-container');
    if (!cloudMapContainer) return;
    
    // 如果iframe已存在，不需要重新加载
    if (cloudMapContainer.querySelector('iframe')) return;
    
    // 创建iframe加载量子云图
    const iframe = document.createElement('iframe');
    iframe.src = '/src/pages/ai-space/cloud-map/cloud-map.html';
    iframe.className = 'cloud-map-iframe';
    iframe.style.width = '100%';
    iframe.style.height = '100%'; // 使用100%高度填充容器
    iframe.style.border = 'none';
    iframe.style.borderRadius = '10px';
    iframe.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.1)';
    
    cloudMapContainer.appendChild(iframe);
} 