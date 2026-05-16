// 检查控制相关
const checkControls = {
    check: document.querySelector('.check-container .btn-check'),
    stop: document.querySelector('.check-container .btn-stop'),
    resume: document.querySelector('.check-container .btn-resume'),
    restart: document.querySelector('.check-container .btn-restart')
};

// 检查链接相关DOM元素
const checkElements = {
    progressBar: document.querySelector('.check-container .progress-inner'),
    currentUrl: document.querySelector('.check-container .current-url'),
    completed: document.querySelector('.check-container .completed'),
    total: document.querySelector('.check-container .total'),
    errorCount: document.querySelector('.check-container .error-count'),
    results: document.querySelector('.check-container .check-results'),
    resultsList: document.querySelector('.check-results-list'),
    status: document.querySelector('.check-container .check-status')
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

// 获取浏览器API
const browser = chrome;

// 页面初始化函数
function initPage() {
    console.log('初始化链接检查页面...');
    
    // 初始化DOM元素引用
    // 重新获取所有DOM元素引用，确保它们是最新的
    const checkControlsList = document.querySelectorAll('.check-controls button');
    if (checkControlsList.length > 0) {
        checkControls.check = document.querySelector('.btn-check');
        checkControls.stop = document.querySelector('.btn-stop');
        checkControls.resume = document.querySelector('.btn-resume');
        checkControls.restart = document.querySelector('.btn-restart');
    } else {
        console.warn('未找到检查控制按钮');
    }
    
    checkElements.progressBar = document.querySelector('.progress-inner');
    checkElements.currentUrl = document.querySelector('.current-url');
    checkElements.completed = document.querySelector('.completed');
    checkElements.total = document.querySelector('.total');
    checkElements.errorCount = document.querySelector('.error-count');
    checkElements.results = document.querySelector('.check-results');
    checkElements.resultsList = document.querySelector('.check-results-list');
    checkElements.status = document.querySelector('.check-status');
    
    // 添加事件监听器
    addEventListeners();
    
    // 应用当前主题
    applyCurrentTheme();
    
    // 设置导航栏活动按钮
    setNavBarActiveButton();
    
    // 添加滚动检测
    addScrollDetection();
}

// 添加滚动检测
function addScrollDetection() {
    if (checkElements.results) {
        let scrollTimeout;
        checkElements.results.addEventListener('scroll', () => {
            if (!checkElements.results.classList.contains('scrolling')) {
                checkElements.results.classList.add('scrolling');
            }
            
            clearTimeout(scrollTimeout);
            
            scrollTimeout = setTimeout(() => {
                checkElements.results.classList.remove('scrolling');
            }, 300);
        });
    }
}

// 设置导航栏活动按钮
function setNavBarActiveButton() {
    // 获取导航栏组件
    const navBar = document.querySelector('nav-bar');
    if (navBar && navBar.shadowRoot) {
        // 获取检查链接按钮
        const checkBtn = navBar.shadowRoot.getElementById('checkBtn');
        if (checkBtn) {
            // 移除其他按钮的活动状态
            const buttons = navBar.shadowRoot.querySelectorAll('.btn');
            buttons.forEach(btn => btn.classList.remove('active'));
            
            // 设置检查链接按钮为活动状态
            checkBtn.classList.add('active');
        }
    }
}

// 添加事件监听器
function addEventListeners() {
    // 检查按钮事件
    if (checkControls.check) {
        checkControls.check.addEventListener('click', startLinkCheck);
    }
    
    // 停止按钮事件
    if (checkControls.stop) {
        checkControls.stop.addEventListener('click', () => {
            isPaused = true;
            updateControlButtons('paused');
            checkElements.status.textContent = '已暂停';
            checkElements.status.className = 'check-status warning';
        });
    }
    
    // 恢复按钮事件
    if (checkControls.resume) {
        checkControls.resume.addEventListener('click', () => {
            isPaused = false;
            updateControlButtons('checking');
            checkElements.status.textContent = '正在检查...';
            checkElements.status.className = 'check-status info';
            continueCheck();
        });
    }
    
    // 重新开始按钮事件
    if (checkControls.restart) {
        checkControls.restart.addEventListener('click', () => {
            // 重置状态
            isChecking = false;
            isPaused = false;
            checkProgress = {
                completed: [],
                remaining: [],
                errors: 0,
                total: 0
            };
            
            // 清空结果
            checkElements.resultsList.innerHTML = '';
            
            // 重置UI
            checkElements.progressBar.style.width = '0%';
            checkElements.currentUrl.textContent = '-';
            checkElements.completed.textContent = '0';
            checkElements.total.textContent = '0';
            checkElements.errorCount.textContent = '0';
            
            // 更新按钮状态
            updateControlButtons('ready');
            
            // 更新状态文本
            checkElements.status.textContent = '准备就绪';
            checkElements.status.className = 'check-status';
            
            // 显示空状态
            showEmptyState();
        });
    }
}

// 显示空状态
function showEmptyState() {
    if (checkElements.resultsList) {
        checkElements.resultsList.innerHTML = `
            <div class="no-issues-message">
                <div class="success-icon">✓</div>
                <p>点击"检查链接"按钮开始检查您的书签链接。检查完成后，有问题的链接将显示在这里。</p>
            </div>
        `;
    }
}

// 应用当前主题
function applyCurrentTheme() {
    const theme = localStorage.getItem('theme') || 'dark';
    document.documentElement.setAttribute('data-theme', theme);
    document.body.setAttribute('data-theme', theme);
}

// 更新控制按钮状态
function updateControlButtons(state) {
    switch(state) {
        case 'ready':
            checkControls.check.disabled = false;
            checkControls.stop.disabled = true;
            checkControls.resume.disabled = true;
            checkControls.restart.disabled = true;
            break;
        case 'checking':
            checkControls.check.disabled = true;
            checkControls.stop.disabled = false;
            checkControls.resume.disabled = true;
            checkControls.restart.disabled = false;
            break;
        case 'paused':
            checkControls.check.disabled = true;
            checkControls.stop.disabled = true;
            checkControls.resume.disabled = false;
            checkControls.restart.disabled = false;
            break;
        case 'completed':
            checkControls.check.disabled = false;
            checkControls.stop.disabled = true;
            checkControls.resume.disabled = true;
            checkControls.restart.disabled = false;
            break;
    }
}

// 获取HTTP状态码对应的文本
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

// continueCheck函数现在只负责恢复检查
function continueCheck() {
    if (!isChecking) {
        console.log('无法恢复检查，因为检查尚未开始');
        return;
    }
    
    if (!isPaused) {
        console.log('检查未暂停，无需恢复');
        return;
    }
    
    console.log('恢复检查');
    isPaused = false;
    updateControlButtons('checking');
    
    // 通过切换isPaused标志，startLinkCheck中的检查循环将会继续执行
    const statusElement = document.querySelector('.check-status');
    if (statusElement) {
        statusElement.textContent = '检查已恢复';
        statusElement.className = 'check-status info';
    }
}

// 开始检查链接
async function startLinkCheck() {
    console.log('开始检查链接...');
    
    if (!checkElements.results) {
        console.error('检查链接所需的DOM元素未找到');
        return;
    }
    
    // 重置状态
    isChecking = true;
    isPaused = false;
    
    // 更新状态显示
    const statusElement = document.querySelector('.check-status');
    if (statusElement) {
        statusElement.textContent = '正在准备检查...';
        statusElement.className = 'check-status info';
    }
    
    // 清空结果列表
    // 确保结果容器存在
    if (checkElements.results) {
        // 重新创建结果列表元素
        const oldResultsList = document.querySelector('.check-results-list');
        if (oldResultsList) {
            oldResultsList.innerHTML = ''; // 清空现有结果
        } else {
            // 创建新的结果列表
            const newResultsList = document.createElement('div');
            newResultsList.className = 'check-results-list';
            checkElements.results.appendChild(newResultsList);
            checkElements.resultsList = newResultsList;
        }
    }
    
    // 重置进度条和计数器
    if (checkElements.progressBar) {
        checkElements.progressBar.style.width = '0';
    }
    
    if (checkElements.completed) {
        checkElements.completed.textContent = '0';
    }
    
    if (checkElements.errorCount) {
        checkElements.errorCount.textContent = '0';
    }
    
    // 显示准备信息
    if (checkElements.currentUrl) {
        checkElements.currentUrl.textContent = '正在获取书签...';
    }
    
    // 更新检查控制按钮
    updateControlButtons('checking');
    
    // 重置进度
    checkProgress = {
        completed: [],
        remaining: [],
        errors: 0,
        total: 0
    };
    
    // 获取所有书签并开始检查
    try {
        chrome.bookmarks.getTree(async (nodes) => {
            if (chrome.runtime.lastError) {
                console.error('获取书签时出错:', chrome.runtime.lastError);
                if (statusElement) {
                    statusElement.textContent = '获取书签失败: ' + chrome.runtime.lastError.message;
                    statusElement.className = 'check-status error';
                }
                isChecking = false;
                updateControlButtons('ready');
                return;
            }
            
            const allBookmarks = [];
        
        // 遍历书签树
        function traverse(node) {
            if (node.url) {
                    allBookmarks.push(node);
            }
            if (node.children) {
                node.children.forEach(traverse);
            }
        }
        
        nodes.forEach(traverse);
        
        // 更新总数
            const total = allBookmarks.length;
        if (checkElements.total) {
            checkElements.total.textContent = total.toString();
        }
        
            if (statusElement) {
                statusElement.textContent = `开始检查 ${total} 个书签`;
            }
            
            // 重置进度
            checkProgress = {
                completed: [],
                remaining: allBookmarks,
                errors: 0,
                total
            };
            
            // 并发检查，但限制并发数
            const concurrency = 5;
            const chunks = [];
            
            // 分块处理，每次处理concurrency个
            for (let i = 0; i < allBookmarks.length; i += concurrency) {
                chunks.push(allBookmarks.slice(i, i + concurrency));
            }
            
            let totalChecked = 0;
            
            // 逐块处理
            for (const chunk of chunks) {
                if (!isChecking) break; // 如果用户取消了检查
                
                // 并行检查当前块
                const results = await Promise.all(
                    chunk.map(bookmark => checkLink(bookmark.url)
                        .then(result => {
                            totalChecked++;
                            
                            // 更新进度
                            if (statusElement) {
                                const errorPercentage = totalChecked > 0 ? 
                                    ((checkProgress.errors / totalChecked) * 100).toFixed(1) : 0;
                                statusElement.textContent = `已检查: ${totalChecked}/${total} · 问题链接: ${checkProgress.errors} (${errorPercentage}%)`;
                            }
                            
                            // 更新进度条
                            if (checkElements.progressBar && total > 0) {
                                const progress = (totalChecked / total) * 100;
                                checkElements.progressBar.style.width = `${progress}%`;
                            }
                            
                            // 更新当前URL显示
                            if (checkElements.currentUrl) {
                                checkElements.currentUrl.textContent = bookmark.url.substring(0, 50) + 
                                    (bookmark.url.length > 50 ? '...' : '');
                            }
                            
                            // 更新完成数量
                            if (checkElements.completed) {
                                checkElements.completed.textContent = totalChecked.toString();
                            }
                            
                            // 处理结果
                            if (!result.url) {
                                console.warn('结果中URL丢失，恢复为书签原始URL');
                                result.url = bookmark.url; // 确保结果包含URL
                            }
                            result.bookmarkId = bookmark.id;
                            result.title = bookmark.title;
                            checkProgress.completed.push(bookmark);
                            
                            // 调用UI更新函数
                            updateLinkCheckUI(result);
                            
                            return result;
                        })
                    )
                );
                
                // 暂停检查
                if (isPaused) {
                    if (statusElement) {
                        statusElement.textContent = '检查已暂停';
                        statusElement.className = 'check-status warning';
                    }
                    
                    // 等待恢复
                    await new Promise(resolve => {
                        const checkPause = () => {
                            if (!isPaused || !isChecking) {
                                resolve();
                            } else {
                                setTimeout(checkPause, 500);
                            }
                        };
                        checkPause();
                    });
                    
                    // 如果已停止检查，直接退出
                    if (!isChecking) break;
                    
                    // 恢复检查
                    if (statusElement) {
                        statusElement.textContent = '检查已恢复';
                        statusElement.className = 'check-status info';
                    }
                }
            }
            
            // 检查完成
            if (isChecking) {
                isChecking = false;
            updateControlButtons('completed');
                
                if (statusElement) {
                    // 更新最终状态
                    const errorPercentage = total > 0 ? ((checkProgress.errors / total) * 100).toFixed(1) : 0;
                    if (checkProgress.errors > 0) {
                        statusElement.className = 'check-status warning';
                        statusElement.textContent = `检查完成: 发现 ${checkProgress.errors} 个问题链接 (${errorPercentage}%)`;
                    } else {
                        statusElement.className = 'check-status success';
                        statusElement.textContent = '检查完成: 所有链接正常';
                        
                        // 显示"没有问题"的消息
                        const resultsList = checkElements.resultsList;
                        if (resultsList) {
                            const noIssuesMsg = document.createElement('div');
                            noIssuesMsg.className = 'no-issues-message';
                            noIssuesMsg.innerHTML = `
                                <div class="success-icon">✓</div>
                                <p>太好了！没有发现问题书签。</p>
                                <p>所有 ${total} 个书签都是有效的。</p>
                            `;
                            resultsList.appendChild(noIssuesMsg);
                        }
                    }
                }
                
                if (checkElements.currentUrl) {
                    checkElements.currentUrl.textContent = '检查完成!';
                }
            }
        });
    } catch (error) {
        console.error('启动检查时出错:', error);
        if (statusElement) {
            statusElement.textContent = '启动检查失败: ' + error.message;
            statusElement.className = 'check-status error';
        }
        isChecking = false;
        updateControlButtons('ready');
    }
}

// 更新链接检查UI
function updateLinkCheckUI(result) {
    if (!checkElements.resultsList) return;
    
    // 创建结果项
    const resultItem = document.createElement('div');
    resultItem.className = 'result-item';
    resultItem.dataset.id = result.id;
    
    // 获取状态文本和类名
    const statusInfo = getStatusText(result.status);
    
    // 创建URL部分
    const urlElement = document.createElement('div');
    urlElement.className = 'result-url';
    
    // 添加书签标题
    if (result.title) {
        const titleElement = document.createElement('div');
        titleElement.className = 'bookmark-title';
        titleElement.textContent = result.title;
        urlElement.appendChild(titleElement);
    }
    
    // 添加链接
    const linkElement = document.createElement('a');
    linkElement.href = result.url;
    linkElement.target = '_blank';
    linkElement.rel = 'noopener noreferrer';
    
    // 显示URL，最多显示60个字符
    const urlDisplay = result.url.length > 60 ? result.url.substring(0, 57) + '...' : result.url;
    linkElement.textContent = urlDisplay;
    urlElement.appendChild(linkElement);
    
    // 添加域名信息
    try {
        const domain = new URL(result.url).hostname;
        const domainInfo = document.createElement('span');
        domainInfo.className = 'domain-info';
        domainInfo.textContent = domain;
        urlElement.appendChild(domainInfo);
    } catch (e) {
        console.error('无法解析URL:', result.url);
    }
    
    // 创建状态部分
    const statusElement = document.createElement('div');
    statusElement.className = `result-status ${statusInfo.className}`;
    statusElement.innerHTML = `<span>${statusInfo.text}</span>`;
    
    // 创建操作部分
    const actionsElement = document.createElement('div');
    actionsElement.className = 'result-actions';
    
    // 添加删除按钮
    const deleteButton = document.createElement('button');
    deleteButton.className = 'btn-delete';
    deleteButton.innerHTML = `
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z" fill="currentColor"/>
        </svg>
        删除
    `;
    deleteButton.dataset.id = result.id;
    deleteButton.addEventListener('click', function() {
        deleteBookmark(result.id, result.title || urlDisplay, this.closest('.result-item'));
    });
    
    actionsElement.appendChild(deleteButton);
    
    // 组装结果项
    resultItem.appendChild(urlElement);
    resultItem.appendChild(statusElement);
    resultItem.appendChild(actionsElement);
    
    // 添加到结果列表
    checkElements.resultsList.appendChild(resultItem);
    
    // 添加淡入动画
    setTimeout(() => {
        resultItem.style.opacity = '1';
    }, 10);
}

// 页面加载时初始化
document.addEventListener('DOMContentLoaded', () => {
    initPage();
    showEmptyState();
}); 