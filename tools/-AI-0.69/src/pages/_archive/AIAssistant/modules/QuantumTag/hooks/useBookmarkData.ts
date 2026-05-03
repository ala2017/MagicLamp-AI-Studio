/**
 * 书签数据Hook
 * 提供书签数据获取、缓存和分析功能
 */
import { useState, useEffect, useCallback } from 'react';
import { 
  getBookmarks, 
  filterValidBookmarks, 
  batchBookmarks,
  Bookmark 
} from '../services/bookmarkService';
import { 
  batchAnalyzeBookmarks, 
  AnalysisResult 
} from '../services/aiAnalysisService';
import { 
  saveAnalysisResult, 
  loadAnalysisResult, 
  clearAnalysisCache, 
  isValidCache 
} from '../utils/cacheManager';
import { findRelatedBookmarks } from '../utils/tagHelper';

export interface UseBookmarkDataResult {
  bookmarks: Bookmark[];
  tagData: AnalysisResult | null;
  isLoading: boolean;
  progress: number;
  error: string | null;
  errorType: 'api_key' | 'api_error' | 'bookmark' | 'other' | null;
  getRelatedBookmarks: (tagId: string) => Bookmark[];
  refreshData: () => Promise<void>;
}

export interface ModelConfig {
  apiEndpoint: string;
  apiKey: string;
  model: string;
}

/**
 * 验证API配置是否有效
 */
const isValidApiConfig = (config: ModelConfig): boolean => {
  return !!config.apiKey && !!config.apiEndpoint && !!config.model;
};

/**
 * 书签数据Hook
 */
export const useBookmarkData = (modelConfig: ModelConfig): UseBookmarkDataResult => {
  const [bookmarks, setBookmarks] = useState<Bookmark[]>([]);
  const [tagData, setTagData] = useState<AnalysisResult | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [progress, setProgress] = useState<number>(0);
  const [error, setError] = useState<string | null>(null);
  const [errorType, setErrorType] = useState<'api_key' | 'api_error' | 'bookmark' | 'other' | null>(null);
  
  // 标签-书签映射缓存
  const [tagBookmarkMap, setTagBookmarkMap] = useState<Map<string, string[]>>(new Map());
  
  /**
   * 初始化数据加载
   */
  useEffect(() => {
    loadData();
  }, []);
  
  /**
   * 加载数据
   */
  const loadData = async () => {
    setIsLoading(true);
    setError(null);
    setErrorType(null);
    setProgress(0);
    
    try {
      // 先检查缓存
      if (isValidCache()) {
        const cachedResult = loadAnalysisResult();
        if (cachedResult) {
          // 加载书签数据
          const bookmarkData = await getBookmarks();
          const validBookmarks = filterValidBookmarks(bookmarkData);
          
          setBookmarks(validBookmarks);
          setTagData(cachedResult);
          return;
        }
      }
      
      // 如果缓存无效或不存在，执行分析流程
      await analyzeBookmarks();
    } catch (err) {
      setError('加载数据失败: ' + (err instanceof Error ? err.message : String(err)));
      setErrorType('other');
    } finally {
      setIsLoading(false);
    }
  };
  
  /**
   * 分析书签
   */
  const analyzeBookmarks = async () => {
    try {
      // 获取书签数据
      setProgress(0.1);
      const bookmarkData = await getBookmarks();
      
      // 过滤有效书签
      const validBookmarks = filterValidBookmarks(bookmarkData);
      setBookmarks(validBookmarks);
      
      // 如果没有有效书签，返回
      if (validBookmarks.length === 0) {
        setError('没有找到有效的书签。请确保您的浏览器中已添加书签。');
        setErrorType('bookmark');
        return;
      }
      
      // 验证API配置是否有效
      if (!isValidApiConfig(modelConfig)) {
        setError('API配置无效。请前往"模型设置"页面配置您的AI模型API密钥和端点。');
        setErrorType('api_key');
        return;
      }
      
      setProgress(0.2);
      
      // 分批处理书签
      const batchSize = 100; // 每批处理100个书签
      const batches = batchBookmarks(validBookmarks, batchSize);
      
      // 进行批量分析
      const result = await batchAnalyzeBookmarks(
        batches,
        modelConfig.apiEndpoint,
        modelConfig.apiKey,
        modelConfig.model,
        (batchProgress) => {
          // 20%-90%的进度用于批处理
          setProgress(0.2 + batchProgress * 0.7);
        }
      ).catch(err => {
        if (err.message && (
          err.message.includes('API key') || 
          err.message.includes('Authentication') ||
          err.message.includes('authorization') ||
          err.message.includes('401') ||
          err.message.includes('403')
        )) {
          setErrorType('api_key');
          throw new Error('API密钥无效或未配置。请前往"模型设置"页面更新您的API密钥。');
        } else {
          setErrorType('api_error');
          throw err;
        }
      });
      
      // 检查结果是否有效
      if (!result || !result.tags || result.tags.length === 0) {
        setError('AI分析未返回任何标签。这可能是API配置问题或服务器响应错误。');
        setErrorType('api_error');
        return;
      }
      
      // 保存结果到缓存
      saveAnalysisResult(result);
      setTagData(result);
      
      // 完成
      setProgress(1);
    } catch (err) {
      let errorMsg = '分析书签失败: ' + (err instanceof Error ? err.message : String(err));
      setError(errorMsg);
      
      if (!errorType) {
        setErrorType('other');
      }
      
      throw err;
    }
  };
  
  /**
   * 强制刷新数据
   */
  const refreshData = useCallback(async () => {
    // 清除缓存
    clearAnalysisCache();
    
    // 重新加载数据
    await loadData();
  }, []);
  
  /**
   * 获取与标签相关的书签
   */
  const getRelatedBookmarks = useCallback((tagId: string): Bookmark[] => {
    if (!tagData || !bookmarks.length) {
      return [];
    }
    
    return findRelatedBookmarks(tagId, bookmarks, tagBookmarkMap);
  }, [bookmarks, tagData, tagBookmarkMap]);
  
  return {
    bookmarks,
    tagData,
    isLoading,
    progress,
    error,
    errorType,
    getRelatedBookmarks,
    refreshData
  };
}; 