import React, { useState } from 'react';
import styles from '../styles/ResultPanel.module.scss';
import { Bookmark } from '../services/bookmarkService';

interface ResultPanelProps {
  bookmarks: Bookmark[];
}

/**
 * 结果面板组件
 * 显示与选中标签相关的书签
 */
const ResultPanel: React.FC<ResultPanelProps> = ({ bookmarks }) => {
  // 排序方式
  const [sortBy, setSortBy] = useState<'relevance' | 'title' | 'date'>('relevance');
  
  // 当前页码
  const [currentPage, setCurrentPage] = useState<number>(1);
  
  // 每页显示数量
  const pageSize = 5;
  
  // 排序书签
  const sortedBookmarks = React.useMemo(() => {
    if (!bookmarks.length) return [];
    
    return [...bookmarks].sort((a, b) => {
      switch (sortBy) {
        case 'title':
          return a.title.localeCompare(b.title);
        case 'date':
          return (b.dateAdded || 0) - (a.dateAdded || 0);
        case 'relevance':
        default:
          return 0; // 默认顺序
      }
    });
  }, [bookmarks, sortBy]);
  
  // 计算分页数据
  const totalPages = Math.ceil(sortedBookmarks.length / pageSize);
  const paginatedBookmarks = sortedBookmarks.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize
  );
  
  // 打开书签
  const openBookmark = (url: string) => {
    window.open(url, '_blank');
  };
  
  // 切换排序方式
  const handleSortChange = (type: 'relevance' | 'title' | 'date') => {
    setSortBy(type);
    setCurrentPage(1); // 重置到第一页
  };
  
  // 分页导航
  const handlePageChange = (page: number) => {
    setCurrentPage(page);
  };
  
  // 获取书签图标
  const getFavicon = (url: string) => {
    try {
      return `https://www.google.com/s2/favicons?domain=${new URL(url).hostname}`;
    } catch (e) {
      return '../assets/icons/bookmark.svg';
    }
  };

  return (
    <div className={styles.resultPanel}>
      <div className={styles.panelHeader}>
        <h3>相关书签</h3>
        <span className={styles.count}>{bookmarks.length} 个结果</span>
      </div>
      
      {bookmarks.length > 0 && (
        <div className={styles.controls}>
          <div className={styles.sortControls}>
            <span>排序: </span>
            <button 
              className={`${styles.sortButton} ${sortBy === 'relevance' ? styles.active : ''}`}
              onClick={() => handleSortChange('relevance')}
            >
              相关性
            </button>
            <button 
              className={`${styles.sortButton} ${sortBy === 'title' ? styles.active : ''}`}
              onClick={() => handleSortChange('title')}
            >
              标题
            </button>
            <button 
              className={`${styles.sortButton} ${sortBy === 'date' ? styles.active : ''}`}
              onClick={() => handleSortChange('date')}
            >
              日期
            </button>
          </div>
        </div>
      )}
      
      <div className={styles.bookmarkList}>
        {paginatedBookmarks.length === 0 ? (
          <div className={styles.emptyState}>
            {bookmarks.length === 0 ? '选择标签查看相关书签' : '没有匹配的书签'}
          </div>
        ) : (
          paginatedBookmarks.map(bookmark => (
            <div 
              key={bookmark.id} 
              className={styles.bookmarkItem}
              onClick={() => openBookmark(bookmark.url)}
            >
              <div className={styles.favicon}>
                <img 
                  src={getFavicon(bookmark.url)} 
                  alt="favicon"
                  onError={(e) => {(e.target as HTMLImageElement).src = '../assets/icons/bookmark.svg'}}
                />
              </div>
              <div className={styles.bookmarkInfo}>
                <div className={styles.title}>{bookmark.title}</div>
                <div className={styles.url}>{bookmark.url}</div>
                {bookmark.path && (
                  <div className={styles.path}>
                    <span className={styles.pathLabel}>路径:</span> {bookmark.path}
                  </div>
                )}
              </div>
            </div>
          ))
        )}
      </div>
      
      {/* 分页控制 */}
      {totalPages > 1 && (
        <div className={styles.pagination}>
          <button 
            className={styles.pageButton}
            disabled={currentPage === 1}
            onClick={() => handlePageChange(currentPage - 1)}
          >
            上一页
          </button>
          
          <span className={styles.pageInfo}>
            {currentPage} / {totalPages}
          </span>
          
          <button 
            className={styles.pageButton}
            disabled={currentPage === totalPages}
            onClick={() => handlePageChange(currentPage + 1)}
          >
            下一页
          </button>
        </div>
      )}
    </div>
  );
};

export default ResultPanel;