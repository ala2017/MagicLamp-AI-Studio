/**
 * debug-helper.js
 * 通用调试辅助功能
 */

// 调试功能
(function() {
    // 显示调试信息
    const debugInfo = document.getElementById('debug-info');
    if (!debugInfo) return;
    
    // 按下Ctrl+Shift+D显示调试面板
    document.addEventListener('keydown', function(e) {
        if (e.ctrlKey && e.shiftKey && e.key === 'D') {
            debugInfo.style.display = debugInfo.style.display === 'none' ? 'block' : 'none';
        }
    });
    
    // 重写console.log以在调试面板中显示
    const originalLog = console.log;
    console.log = function() {
        // 调用原始的console.log
        originalLog.apply(console, arguments);
        
        // 在调试面板中显示
        const message = Array.from(arguments).map(arg => {
            if (typeof arg === 'object') {
                return JSON.stringify(arg);
            }
            return arg;
        }).join(' ');
        
        const logLine = document.createElement('div');
        logLine.textContent = message;
        debugInfo.appendChild(logLine);
        
        // 保持滚动到底部
        debugInfo.scrollTop = debugInfo.scrollHeight;
    };
    
    // 重写console.error以在调试面板中显示
    const originalError = console.error;
    console.error = function() {
        // 调用原始的console.error
        originalError.apply(console, arguments);
        
        // 在调试面板中显示
        const message = Array.from(arguments).map(arg => {
            if (typeof arg === 'object') {
                return JSON.stringify(arg);
            }
            return arg;
        }).join(' ');
        
        const logLine = document.createElement('div');
        logLine.textContent = '错误: ' + message;
        logLine.style.color = '#ff5252';
        debugInfo.appendChild(logLine);
        
        // 保持滚动到底部
        debugInfo.scrollTop = debugInfo.scrollHeight;
    };
})(); 