// 缓存管理器类
class CacheManager {
    static CACHE_KEY_PREFIX = 'shenDeng_';
    static HISTORY_CACHE_KEY = 'homePageHistory';
    static FAVICON_CACHE_KEY = 'homePageFavicons';
    static CACHE_EXPIRY = 24 * 60 * 60 * 1000; // 24小时的毫秒数

    // 保存数据到缓存
    static setCache(key, data) {
        try {
            const cacheData = {
                timestamp: Date.now(),
                data: data
            };
            localStorage.setItem(this.CACHE_KEY_PREFIX + key, JSON.stringify(cacheData));
            return true;
        } catch (error) {
            console.error('缓存数据保存失败:', error);
            return false;
        }
    }

    // 从缓存获取数据
    static getCache(key) {
        try {
            const cacheJson = localStorage.getItem(this.CACHE_KEY_PREFIX + key);
            if (!cacheJson) return null;

            const cache = JSON.parse(cacheJson);
            const now = Date.now();

            // 检查缓存是否过期
            if (now - cache.timestamp > this.CACHE_EXPIRY) {
                this.removeCache(key);
                return null;
            }

            return cache.data;
        } catch (error) {
            console.error('获取缓存数据失败:', error);
            return null;
        }
    }

    // 移除缓存
    static removeCache(key) {
        try {
            localStorage.removeItem(this.CACHE_KEY_PREFIX + key);
            return true;
        } catch (error) {
            console.error('移除缓存失败:', error);
            return false;
        }
    }

    // 保存历史记录缓存
    static setHistoryCache(historyData) {
        return this.setCache(this.HISTORY_CACHE_KEY, historyData);
    }

    // 获取历史记录缓存
    static getHistoryCache() {
        return this.getCache(this.HISTORY_CACHE_KEY);
    }

    // 保存图标缓存
    static setFaviconCache(faviconData) {
        return this.setCache(this.FAVICON_CACHE_KEY, faviconData);
    }

    // 获取图标缓存
    static getFaviconCache() {
        return this.getCache(this.FAVICON_CACHE_KEY);
    }

    // 清理所有缓存
    static clearAllCache() {
        try {
            Object.keys(localStorage)
                .filter(key => key.startsWith(this.CACHE_KEY_PREFIX))
                .forEach(key => localStorage.removeItem(key));
            return true;
        } catch (error) {
            console.error('清理缓存失败:', error);
            return false;
        }
    }
}

// 导出缓存管理器
window.CacheManager = CacheManager; 