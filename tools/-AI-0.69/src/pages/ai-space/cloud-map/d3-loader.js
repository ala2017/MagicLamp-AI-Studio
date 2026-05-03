// D3.js加载器
window.d3Loaded = false;

// 加载D3.js的函数
function loadD3() {
    return new Promise((resolve, reject) => {
        // 首先尝试加载本地文件
        const script = document.createElement('script');
        script.src = '/src/shared/libs/d3.min.js';
        script.onload = () => {
            window.d3Loaded = true;
            resolve();
        };
        script.onerror = () => {
            // 如果本地加载失败，尝试从CDN加载
            const cdnScript = document.createElement('script');
            cdnScript.src = 'https://cdn.jsdelivr.net/npm/d3@7.8.5/dist/d3.min.js';
            cdnScript.onload = () => {
                window.d3Loaded = true;
                resolve();
            };
            cdnScript.onerror = () => {
                reject(new Error('无法加载D3.js，请检查网络连接'));
            };
            document.body.appendChild(cdnScript);
        };
        document.body.appendChild(script);
    });
}

// 显示错误信息
function showLoadingError(error) {
    const loadingOverlay = document.getElementById('loading-overlay');
    if (loadingOverlay) {
        loadingOverlay.style.display = 'flex';
        const errorContent = document.createElement('div');
        errorContent.style.textAlign = 'center';
        
        const title = document.createElement('h2');
        title.textContent = '加载失败';
        errorContent.appendChild(title);
        
        const message = document.createElement('p');
        message.textContent = error.message;
        errorContent.appendChild(message);
        
        const retryButton = document.createElement('button');
        retryButton.textContent = '重试';
        retryButton.addEventListener('click', () => {
            window.location.reload();
        });
        errorContent.appendChild(retryButton);
        
        loadingOverlay.innerHTML = '';
        loadingOverlay.appendChild(errorContent);
    }
}

// 页面加载完成后加载D3.js
window.addEventListener('load', () => {
    loadD3()
        .then(() => {
            console.log('D3.js加载成功');
        })
        .catch(error => {
            console.error('D3.js加载失败:', error);
            showLoadingError(error);
        });
}); 