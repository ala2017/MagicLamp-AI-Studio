/**
 * 缓存管理工具
 * 处理分析结果的本地存储和读取
 */
import { AnalysisResult } from '../services/aiAnalysisService';

// 缓存键名
const CACHE_KEY = 'quantum_tag_analysis_result';
const CACHE_TIMESTAMP_KEY = 'quantum_tag_analysis_timestamp';
const CACHE_VERSION_KEY = 'quantum_tag_analysis_version';

// 缓存版本，更新时需要递增
const CURRENT_VERSION = 1;

// 缓存有效期 (毫秒)
const CACHE_TTL = 7 * 24 * 60 * 60 * 1000; // 一周

/**
 * 保存分析结果到本地存储
 */
export const saveAnalysisResult = (result: AnalysisResult): void => {
  try {
    // 保存分析结果
    localStorage.setItem(CACHE_KEY, JSON.stringify(result));
    
    // 保存时间戳
    localStorage.setItem(CACHE_TIMESTAMP_KEY, Date.now().toString());
    
    // 保存版本号
    localStorage.setItem(CACHE_VERSION_KEY, CURRENT_VERSION.toString());
    
    console.log('分析结果已缓存');
  } catch (error) {
    console.error('保存分析结果失败:', error);
  }
};

/**
 * 从本地存储加载分析结果
 * 如果缓存过期或版本不匹配返回null
 */
export const loadAnalysisResult = (): AnalysisResult | null => {
  try {
    // 检查版本
    const version = parseInt(localStorage.getItem(CACHE_VERSION_KEY) || '0');
    if (version !== CURRENT_VERSION) {
      console.log('缓存版本不匹配，需要重新分析');
      return null;
    }
    
    // 检查缓存时间戳
    const timestamp = parseInt(localStorage.getItem(CACHE_TIMESTAMP_KEY) || '0');
    const now = Date.now();
    
    if (now - timestamp > CACHE_TTL) {
      console.log('缓存已过期，需要重新分析');
      return null;
    }
    
    // 获取缓存数据
    const cachedData = localStorage.getItem(CACHE_KEY);
    if (!cachedData) {
      return null;
    }
    
    // 解析数据
    const result = JSON.parse(cachedData) as AnalysisResult;
    
    // 验证数据结构
    if (!result || !Array.isArray(result.tags) || !Array.isArray(result.relations)) {
      console.warn('缓存数据结构无效');
      return null;
    }
    
    console.log('从缓存加载了分析结果');
    return result;
  } catch (error) {
    console.error('加载分析结果失败:', error);
    return null;
  }
};

/**
 * 清除缓存
 */
export const clearAnalysisCache = (): void => {
  try {
    localStorage.removeItem(CACHE_KEY);
    localStorage.removeItem(CACHE_TIMESTAMP_KEY);
    localStorage.removeItem(CACHE_VERSION_KEY);
    console.log('分析缓存已清除');
  } catch (error) {
    console.error('清除缓存失败:', error);
  }
};

/**
 * 检查缓存是否有效
 */
export const isValidCache = (): boolean => {
  try {
    // 检查版本
    const version = parseInt(localStorage.getItem(CACHE_VERSION_KEY) || '0');
    if (version !== CURRENT_VERSION) {
      return false;
    }
    
    // 检查缓存时间戳
    const timestamp = parseInt(localStorage.getItem(CACHE_TIMESTAMP_KEY) || '0');
    const now = Date.now();
    
    if (now - timestamp > CACHE_TTL) {
      return false;
    }
    
    // 检查是否有数据
    const cachedData = localStorage.getItem(CACHE_KEY);
    return !!cachedData;
  } catch (error) {
    return false;
  }
}; 