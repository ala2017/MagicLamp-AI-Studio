import React, { useState, useEffect } from 'react';
import styles from './styles/QuantumTag.module.scss';
import TagCloud from './components/TagCloud';
import RelationGraph from './components/RelationGraph';
import ResultPanel from './components/ResultPanel';
import { useBookmarkData, ModelConfig } from './hooks/useBookmarkData';
import { findRelatedTags } from './utils/tagHelper';
import { clearAnalysisCache } from './utils/cacheManager';

/**
 * 量子标签模块主组件
 * 实现标签云和关系图谱两种可视化方式
 */
const QuantumTag: React.FC = () => {
  // 视图模式: 'cloud' 或 'relation'
  const [viewMode, setViewMode] = useState<'cloud' | 'relation'>('cloud');
  
  // 选中的标签
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  
  // 相关书签
  const [relatedBookmarks, setRelatedBookmarks] = useState<any[]>([]);
  
  // 从ModelSettings模块获取模型配置
  // 这里假设已经在全局状态中存储了模型配置
  const modelConfig: ModelConfig = {
    apiEndpoint: localStorage.getItem('ai_api_endpoint') || 'https://api.openai.com/v1/chat/completions',
    apiKey: localStorage.getItem('ai_api_key') || '',
    model: localStorage.getItem('ai_model') || 'gpt-3.5-turbo'
  };
  
  // 使用自定义Hook获取书签数据
  const { 
    bookmarks, 
    tagData, 
    isLoading, 
    progress, 
    error, 
    errorType,
    getRelatedBookmarks,
    refreshData
  } = useBookmarkData(modelConfig);
  
  // 处理标签点击
  const handleTagClick = (tagId: string) => {
    // 如果已选中则移除，否则添加
    setSelectedTags(prev => {
      if (prev.includes(tagId)) {
        return prev.filter(t => t !== tagId);
      } else {
        // 如果是单击操作，替换当前选中
        if (prev.length === 1) {
          return [tagId];
        }
        // 添加到选中列表
        return [...prev, tagId];
      }
    });
  };
  
  // 当选中标签变化时，更新相关书签
  useEffect(() => {
    if (selectedTags.length === 0) {
      setRelatedBookmarks([]);
      return;
    }
    
    // 获取所有选中标签相关的书签
    let allRelatedBookmarks: any[] = [];
    
    selectedTags.forEach(tagId => {
      const bookmarksForTag = getRelatedBookmarks(tagId);
      allRelatedBookmarks = [...allRelatedBookmarks, ...bookmarksForTag];
    });
    
    // 去重
    const uniqueBookmarks = Array.from(
      new Map(allRelatedBookmarks.map(item => [item.id, item])).values()
    );
    
    setRelatedBookmarks(uniqueBookmarks);
  }, [selectedTags, getRelatedBookmarks]);
  
  // 刷新数据
  const handleRefresh = async () => {
    // 清除选中标签
    setSelectedTags([]);
    setRelatedBookmarks([]);
    
    // 刷新数据
    await refreshData();
  };
  
  // 使用window.location跳转到模型设置页面，而不是使用navigate
  const goToModelSettings = () => {
    // 判断是否是Chrome扩展环境
    if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.id) {
      // 在Chrome扩展中，无法直接使用/路径，使用点击事件通知主应用
      try {
        console.log('通知主应用切换到模型设置');
        const customEvent = new CustomEvent('switchToModelSettings', {
          detail: { feature: 'model-selection' }
        });
        document.dispatchEvent(customEvent);
      } catch (error) {
        console.error('跳转到模型设置失败:', error);
        // 尝试直接打开设置面板
        const modelSettingsButton = document.querySelector('[data-feature="model-selection"]');
        if (modelSettingsButton instanceof HTMLElement) {
          modelSettingsButton.click();
        }
      }
    } else {
      // 普通Web环境
      window.location.href = '/ai-assistant/model-settings';
    }
  };
  
  // 计算进度百分比
  const progressPercentage = Math.round(progress * 100);
  
  // 根据错误类型渲染不同的错误提示
  const renderErrorContent = () => {
    if (errorType === 'api_key') {
      return (
        <div className={styles.errorContainer}>
          <div className={styles.errorIcon}>🔑</div>
          <div className={styles.errorTitle}>API密钥未配置</div>
          <div className={styles.errorMessage}>{error}</div>
          <button className={styles.primaryButton} onClick={goToModelSettings}>
            前往模型设置
          </button>
          <button className={styles.secondaryButton} onClick={handleRefresh}>
            重试
          </button>
        </div>
      );
    } else if (errorType === 'api_error') {
      return (
        <div className={styles.errorContainer}>
          <div className={styles.errorIcon}>⚠️</div>
          <div className={styles.errorTitle}>API调用失败</div>
          <div className={styles.errorMessage}>{error}</div>
          <button className={styles.primaryButton} onClick={goToModelSettings}>
            检查模型设置
          </button>
          <button className={styles.secondaryButton} onClick={handleRefresh}>
            重试
          </button>
        </div>
      );
    } else if (errorType === 'bookmark') {
      return (
        <div className={styles.errorContainer}>
          <div className={styles.errorIcon}>📚</div>
          <div className={styles.errorTitle}>书签数据问题</div>
          <div className={styles.errorMessage}>{error}</div>
          <button className={styles.primaryButton} onClick={handleRefresh}>
            重试
          </button>
        </div>
      );
    } else {
      return (
        <div className={styles.errorContainer}>
          <div className={styles.errorIcon}>❌</div>
          <div className={styles.errorTitle}>发生错误</div>
          <div className={styles.errorMessage}>{error}</div>
          <button className={styles.primaryButton} onClick={handleRefresh}>
            重试
          </button>
        </div>
      );
    }
  };

  return (
    <div className={styles.quantumContainer}>
      {/* 视图切换标签页 */}
      <div className={styles.viewTabs}>
        <div 
          className={`${styles.tabItem} ${viewMode === 'cloud' ? styles.active : ''}`} 
          onClick={() => setViewMode('cloud')}
        >
          标签云
        </div>
        <div 
          className={`${styles.tabItem} ${viewMode === 'relation' ? styles.active : ''}`} 
          onClick={() => setViewMode('relation')}
        >
          关系图谱
        </div>
        
        {/* 刷新按钮 */}
        <div className={styles.refreshButton} onClick={handleRefresh} title="刷新数据">
          <svg viewBox="0 0 24 24" width="16" height="16">
            <path fill="currentColor" d="M17.65,6.35C16.2,4.9 14.21,4 12,4A8,8 0 0,0 4,12A8,8 0 0,0 12,20C15.73,20 18.84,17.45 19.73,14H17.65C16.83,16.33 14.61,18 12,18A6,6 0 0,1 6,12A6,6 0 0,1 12,6C13.66,6 15.14,6.69 16.22,7.78L13,11H20V4L17.65,6.35Z" />
          </svg>
        </div>
        
        {/* 模型设置按钮 */}
        <div className={styles.settingsButton} onClick={goToModelSettings} title="模型设置">
          <svg viewBox="0 0 24 24" width="16" height="16">
            <path fill="currentColor" d="M12,15.5A3.5,3.5 0 0,1 8.5,12A3.5,3.5 0 0,1 12,8.5A3.5,3.5 0 0,1 15.5,12A3.5,3.5 0 0,1 12,15.5M19.43,12.97C19.47,12.65 19.5,12.33 19.5,12C19.5,11.67 19.47,11.34 19.43,11L21.54,9.37C21.73,9.22 21.78,8.95 21.66,8.73L19.66,5.27C19.54,5.05 19.27,4.96 19.05,5.05L16.56,6.05C16.04,5.66 15.5,5.32 14.87,5.07L14.5,2.42C14.46,2.18 14.25,2 14,2H10C9.75,2 9.54,2.18 9.5,2.42L9.13,5.07C8.5,5.32 7.96,5.66 7.44,6.05L4.95,5.05C4.73,4.96 4.46,5.05 4.34,5.27L2.34,8.73C2.21,8.95 2.27,9.22 2.46,9.37L4.57,11C4.53,11.34 4.5,11.67 4.5,12C4.5,12.33 4.53,12.65 4.57,12.97L2.46,14.63C2.27,14.78 2.21,15.05 2.34,15.27L4.34,18.73C4.46,18.95 4.73,19.03 4.95,18.95L7.44,17.94C7.96,18.34 8.5,18.68 9.13,18.93L9.5,21.58C9.54,21.82 9.75,22 10,22H14C14.25,22 14.46,21.82 14.5,21.58L14.87,18.93C15.5,18.67 16.04,18.34 16.56,17.94L19.05,18.95C19.27,19.03 19.54,18.95 19.66,18.73L21.66,15.27C21.78,15.05 21.73,14.78 21.54,14.63L19.43,12.97Z" />
          </svg>
        </div>
      </div>
      
      {/* 视图容器 */}
      <div className={styles.viewContainer}>
        {isLoading ? (
          <div className={styles.loadingIndicator}>
            <div className={styles.spinner}></div>
            <div className={styles.loadingText}>
              {progressPercentage < 100 
                ? `分析中... ${progressPercentage}%` 
                : '加载中...'}
            </div>
            {error && <div className={styles.errorMessage}>{error}</div>}
          </div>
        ) : error ? (
          renderErrorContent()
        ) : (
          <>
            {/* 标签云视图 */}
            <div className={`${styles.tagCloudView} ${viewMode === 'cloud' ? styles.active : ''}`}>
              {tagData && tagData.tags.length > 0 ? (
                <TagCloud 
                  tags={tagData.tags} 
                  selectedTags={selectedTags}
                  onTagClick={handleTagClick}
                />
              ) : (
                <div className={styles.emptyState}>
                  <div className={styles.emptyIcon}>📚</div>
                  <div className={styles.emptyText}>
                    没有找到标签数据
                  </div>
                  <button className={styles.actionButton} onClick={handleRefresh}>
                    分析书签
                  </button>
                </div>
              )}
            </div>
            
            {/* 关系图谱视图 */}
            <div className={`${styles.tagRelationView} ${viewMode === 'relation' ? styles.active : ''}`}>
              {tagData && tagData.tags.length > 0 ? (
                <RelationGraph 
                  tags={tagData.tags}
                  relations={tagData.relations}
                  selectedTags={selectedTags}
                  onTagClick={handleTagClick}
                />
              ) : (
                <div className={styles.emptyState}>
                  <div className={styles.emptyIcon}>🔍</div>
                  <div className={styles.emptyText}>
                    没有找到关系数据
                  </div>
                  <button className={styles.actionButton} onClick={handleRefresh}>
                    分析书签
                  </button>
                </div>
              )}
            </div>
          </>
        )}
      </div>
      
      {/* 结果面板 */}
      <ResultPanel bookmarks={relatedBookmarks} />
    </div>
  );
};

export default QuantumTag; 