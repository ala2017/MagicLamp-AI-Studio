/**
 * notification-helper.js
 * 通用通知辅助功能
 */

// 通知管理器
const NotificationManager = {
    // 初始化样式
    init() {
        // 检查是否已经添加了样式
        if (document.getElementById('notification-styles')) return;
        
        // 创建样式元素
        const style = document.createElement('style');
        style.id = 'notification-styles';
        style.textContent = `
            .custom-notification {
                position: fixed;
                bottom: 32px;
                left: 50%;
                transform: translateX(-50%);
                background: #fff;
                border-radius: 8px;
                box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
                padding: 16px;
                z-index: 9999;
                animation: slideIn 0.3s ease-out;
                border: 1px solid #e0e0e0;
                min-width: 300px;
                max-width: 90%;
            }

            .notification-content {
                display: flex;
                flex-direction: column;
                gap: 8px;
            }

            .notification-title {
                font-weight: bold;
                color: #333;
                font-size: 16px;
            }

            .notification-message {
                color: #666;
                font-size: 14px;
            }

            @keyframes slideIn {
                from {
                    transform: translate(-50%, 100%);
                    opacity: 0;
                }
                to {
                    transform: translate(-50%, 0);
                    opacity: 1;
                }
            }

            @keyframes slideOut {
                from {
                    transform: translate(-50%, 0);
                    opacity: 1;
                }
                to {
                    transform: translate(-50%, 100%);
                    opacity: 0;
                }
            }

            .custom-notification.fade-out {
                animation: slideOut 0.3s ease-in forwards;
            }
            
            /* 深色主题 */
            [data-theme="dark"] .custom-notification {
                background: #333;
                border-color: #444;
            }
            
            [data-theme="dark"] .notification-title {
                color: #fff;
            }
            
            [data-theme="dark"] .notification-message {
                color: #ccc;
            }
        `;
        document.head.appendChild(style);
    },
    
    // 显示通知
    show(title, message, type = 'info', duration = 5000) {
        // 初始化样式
        this.init();
        
        // 创建通知元素
        const notification = document.createElement('div');
        notification.className = 'custom-notification';
        
        // 设置通知内容
        notification.innerHTML = `
            <div class="notification-content">
                <div class="notification-title" style="color: ${this._getColorByType(type)}">${title}</div>
                <div class="notification-message">${message}</div>
            </div>
        `;
        
        // 添加到文档
        document.body.appendChild(notification);
        
        // 设置自动关闭并保存计时器引用
        notification._hideTimeout = setTimeout(() => {
            this.hide(notification);
        }, duration);
        
        return notification;
    },
    
    // 隐藏通知
    hide(notification) {
        notification.classList.add('fade-out');
        setTimeout(() => {
            if (document.body.contains(notification)) {
                document.body.removeChild(notification);
            }
        }, 300);
    },
    
    // 更新通知内容
    update(notification, title, message, type = 'info', duration = 5000) {
        // 清除可能存在的旧计时器
        if (notification._hideTimeout) {
            clearTimeout(notification._hideTimeout);
            notification._hideTimeout = null;
        }
        
        // 更新通知内容
        notification.querySelector('.notification-title').textContent = title;
        notification.querySelector('.notification-title').style.color = this._getColorByType(type);
        notification.querySelector('.notification-message').textContent = message;
        
        // 设置新的自动关闭计时器
        notification._hideTimeout = setTimeout(() => {
            this.hide(notification);
        }, duration);
    },
    
    // 根据类型获取颜色
    _getColorByType(type) {
        switch (type) {
            case 'success': return '#4CAF50';
            case 'error': return '#F44336';
            case 'warning': return '#FF9800';
            case 'info':
            default: return '#2196F3';
        }
    }
};

// 自动初始化
NotificationManager.init();