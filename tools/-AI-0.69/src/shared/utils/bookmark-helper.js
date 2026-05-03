/**
 * 书签助手工具类
 * 提供书签相关的通用功能
 */

// 添加调试日志函数
function helperLogDebug(message, data) {
    console.log(`[BookmarkHelper] ${message}`, data || '');
}

// 检测浏览器类型
const helperIsEdge = navigator.userAgent.includes('Edg');
const helperBrowser = helperIsEdge ? chrome : chrome;  // Edge使用chrome命名空间

/**
 * 获取所有书签
 * @param {Function} callback 回调函数，参数为书签数组
 */
function getAllBookmarks(callback) {
    helperLogDebug('获取所有书签');
    
    try {
        helperBrowser.bookmarks.getTree((bookmarkTreeNodes) => {
            const bookmarks = [];
            
            // 递归遍历书签树
            function processNode(node) {
                if (node.url) {
                    bookmarks.push({
                        id: node.id,
                        title: node.title,
                        url: node.url,
                        dateAdded: node.dateAdded
                    });
                }
                
                if (node.children) {
                    node.children.forEach(processNode);
                }
            }
            
            bookmarkTreeNodes.forEach(processNode);
            
            helperLogDebug(`获取到 ${bookmarks.length} 个书签`);
            callback(bookmarks);
        });
    } catch (error) {
        console.error('获取书签时出错:', error);
        callback([]);
    }
}

/**
 * 获取书签树
 * @param {Function} callback 回调函数，参数为书签树
 */
function getBookmarkTree(callback) {
    helperLogDebug('获取书签树');
    
    if (!checkChromeAPI()) {
        console.warn('Chrome API不可用，使用模拟数据');
        // 使用模拟数据
        const mockBookmarkTree = [{
            id: '1',
            title: '书签栏',
            type: 'folder',
            children: [
                {
                    id: '2',
                    title: '常用网站',
                    type: 'folder',
                    children: [
                        {
                            id: '3',
                            title: 'Google',
                            type: 'bookmark',
                            url: 'https://www.google.com'
                        },
                        {
                            id: '4',
                            title: 'GitHub',
                            type: 'bookmark',
                            url: 'https://github.com'
                        }
                    ]
                },
                {
                    id: '5',
                    title: '学习资源',
                    type: 'folder',
                    children: [
                        {
                            id: '6',
                            title: 'MDN Web Docs',
                            type: 'bookmark',
                            url: 'https://developer.mozilla.org'
                        }
                    ]
                }
            ]
        }];
        callback(mockBookmarkTree);
        return;
    }
    
    try {
        helperBrowser.bookmarks.getTree((bookmarkTreeNodes) => {
            // 处理书签树，添加type属性
            function processNode(node) {
                // 添加type属性
                node.type = node.url ? 'bookmark' : 'folder';
                
                // 递归处理子节点
                if (node.children) {
                    node.children.forEach(processNode);
                }
                
                return node;
            }
            
            // 处理整个书签树
            const processedTree = bookmarkTreeNodes.map(processNode);
            
            helperLogDebug('书签树获取成功', processedTree);
            callback(processedTree);
        });
    } catch (error) {
        console.error('获取书签树时出错:', error);
        callback([]);
    }
}

/**
 * 获取书签文件夹
 * @param {Function} callback 回调函数，参数为文件夹数组
 */
function getBookmarkFolders(callback) {
    helperLogDebug('获取书签文件夹');
    
    try {
        helperBrowser.bookmarks.getTree((bookmarkTreeNodes) => {
            const folders = [];
            
            // 递归遍历书签树
            function processNode(node, path = '') {
                if (node.children) {
                    const currentPath = path ? `${path} / ${node.title}` : node.title;
                    
                    if (node.id !== '0' && node.id !== '1') {  // 排除根节点
                        folders.push({
                            id: node.id,
                            title: node.title,
                            path: currentPath
                        });
                    }
                    
                    node.children.forEach(child => processNode(child, currentPath));
                }
            }
            
            bookmarkTreeNodes.forEach(node => processNode(node));
            
            helperLogDebug(`获取到 ${folders.length} 个书签文件夹`);
            callback(folders);
        });
    } catch (error) {
        console.error('获取书签文件夹时出错:', error);
        callback([]);
    }
}

/**
 * 创建书签
 * @param {Object} bookmark 书签对象
 * @param {Function} callback 回调函数
 */
function createBookmark(bookmark, callback) {
    helperLogDebug('创建书签', bookmark);
    
    try {
        helperBrowser.bookmarks.create(bookmark, (newBookmark) => {
            helperLogDebug('书签创建成功', newBookmark);
            if (callback) {
                callback(newBookmark);
            }
        });
    } catch (error) {
        console.error('创建书签时出错:', error);
        if (callback) {
            callback(null);
        }
    }
}

/**
 * 更新书签
 * @param {String} id 书签ID
 * @param {Object} changes 更改内容
 * @param {Function} callback 回调函数
 */
function updateBookmark(id, changes, callback) {
    helperLogDebug('更新书签', { id, changes });
    
    try {
        helperBrowser.bookmarks.update(id, changes, (updatedBookmark) => {
            helperLogDebug('书签更新成功', updatedBookmark);
            if (callback) {
                callback(updatedBookmark);
            }
        });
    } catch (error) {
        console.error('更新书签时出错:', error);
        if (callback) {
            callback(null);
        }
    }
}

/**
 * 删除书签
 * @param {String} id 书签ID
 * @param {Function} callback 回调函数
 */
function removeBookmark(id, callback) {
    helperLogDebug('删除书签', id);
    
    try {
        helperBrowser.bookmarks.remove(id, () => {
            helperLogDebug('书签删除成功');
            if (callback) {
                callback(true);
            }
        });
    } catch (error) {
        console.error('删除书签时出错:', error);
        if (callback) {
            callback(false);
        }
    }
}

/**
 * 获取书签访问历史
 * @param {String} url 书签URL
 * @param {Function} callback 回调函数
 */
function getBookmarkHistory(url, callback) {
    helperLogDebug('获取书签访问历史', url);
    
    try {
        helperBrowser.history.getVisits({ url }, (visitItems) => {
            helperLogDebug(`获取到 ${visitItems.length} 条访问记录`);
            callback(visitItems);
        });
    } catch (error) {
        console.error('获取书签访问历史时出错:', error);
        callback([]);
    }
}

// 检查Chrome API是否可用
function checkChromeAPI() {
    if (typeof chrome !== 'undefined' && chrome.bookmarks) {
        helperLogDebug('Chrome API 可用');
        return true;
    } else {
        console.error('Chrome API 不可用!');
        return false;
    }
}

// 书签助手工具
window.BookmarkHelper = {
    getAllBookmarks,
    getBookmarkTree,
    getBookmarkFolders,
    createBookmark,
    updateBookmark,
    removeBookmark,
    getBookmarkHistory,
    checkChromeAPI
};

// 在加载时检查API可用性
document.addEventListener('DOMContentLoaded', () => {
    helperLogDebug('BookmarkHelper 已加载');
    checkChromeAPI();
}); 