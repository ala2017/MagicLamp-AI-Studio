/**
 * 标签处理工具函数
 * 处理标签数据相关操作
 */
import { Tag, Relation, AnalysisResult } from '../services/aiAnalysisService';
import { Bookmark } from '../services/bookmarkService';

/**
 * 根据标签ID查找相关书签
 * 当前简单实现，未来可扩展为使用AI找出最相关的书签
 */
export const findRelatedBookmarks = (
  tagId: string,
  allBookmarks: Bookmark[],
  tagBookmarkMap: Map<string, string[]>
): Bookmark[] => {
  // 如果有标签-书签映射，直接使用
  if (tagBookmarkMap.has(tagId)) {
    const bookmarkIds = tagBookmarkMap.get(tagId) || [];
    return allBookmarks.filter(bookmark => bookmarkIds.includes(bookmark.id));
  }
  
  // 如果没有映射，基于标签匹配书签标题或URL
  const tag = tagId.toLowerCase();
  return allBookmarks.filter(bookmark => 
    bookmark.title.toLowerCase().includes(tag) || 
    bookmark.url.toLowerCase().includes(tag) ||
    (bookmark.path && bookmark.path.toLowerCase().includes(tag))
  );
};

/**
 * 计算标签布局位置
 * 根据权重、碰撞避免进行布局
 */
export const calculateTagPositions = (
  tags: Tag[],
  containerWidth: number,
  containerHeight: number
): {[key: string]: {x: number, y: number}} => {
  const positions: {[key: string]: {x: number, y: number}} = {};
  const centerX = containerWidth / 2;
  const centerY = containerHeight / 2;
  
  // 根据权重排序标签
  const sortedTags = [...tags].sort((a, b) => b.weight - a.weight);
  
  // 已放置的标签区域
  const placedAreas: Array<{x: number, y: number, width: number, height: number}> = [];
  
  // 首先放置中心标签
  if (sortedTags.length > 0) {
    const mainTag = sortedTags[0];
    positions[mainTag.id] = { x: centerX, y: centerY };
    
    // 标签尺寸估算 (fontSize + padding)
    const fontSize = 14 + mainTag.weight * 2;
    const tagWidth = mainTag.label.length * fontSize * 0.6;
    const tagHeight = fontSize * 2;
    
    placedAreas.push({
      x: centerX - tagWidth / 2,
      y: centerY - tagHeight / 2,
      width: tagWidth,
      height: tagHeight
    });
  }
  
  // 放置其余标签
  for (let i = 1; i < sortedTags.length; i++) {
    const tag = sortedTags[i];
    const fontSize = 14 + tag.weight * 2;
    const tagWidth = tag.label.length * fontSize * 0.6;
    const tagHeight = fontSize * 2;
    
    // 尝试多个位置，选择最佳位置
    let bestPosition = { x: 0, y: 0 };
    let minDistance = Infinity;
    let attempts = 0;
    const maxAttempts = 50;
    
    while (attempts < maxAttempts) {
      // 计算放置角度，使标签分布均匀
      const angle = (Math.PI * 2 * i / sortedTags.length) + (attempts * 0.2);
      // 距离随权重和尝试次数变化
      const distance = 150 + (10 - tag.weight) * 15 + attempts * 10;
      
      const x = centerX + Math.cos(angle) * distance;
      const y = centerY + Math.sin(angle) * distance;
      
      // 检查是否与已放置标签重叠
      let overlap = false;
      for (const area of placedAreas) {
        if (
          x - tagWidth / 2 < area.x + area.width &&
          x + tagWidth / 2 > area.x &&
          y - tagHeight / 2 < area.y + area.height &&
          y + tagHeight / 2 > area.y
        ) {
          overlap = true;
          break;
        }
      }
      
      // 检查是否在容器内
      const inBounds = 
        x - tagWidth / 2 > 0 &&
        x + tagWidth / 2 < containerWidth &&
        y - tagHeight / 2 > 0 &&
        y + tagHeight / 2 < containerHeight;
      
      if (!overlap && inBounds) {
        // 计算到中心的距离
        const distToCentre = Math.sqrt(Math.pow(x - centerX, 2) + Math.pow(y - centerY, 2));
        
        // 如果更接近中心，更新最佳位置
        if (distToCentre < minDistance) {
          minDistance = distToCentre;
          bestPosition = { x, y };
        }
      }
      
      attempts++;
    }
    
    // 设置最佳位置
    positions[tag.id] = bestPosition;
    
    // 记录已放置区域
    placedAreas.push({
      x: bestPosition.x - tagWidth / 2,
      y: bestPosition.y - tagHeight / 2,
      width: tagWidth,
      height: tagHeight
    });
  }
  
  return positions;
};

/**
 * 找出标签关系中最相关的标签
 */
export const findRelatedTags = (
  tagId: string,
  relations: Relation[]
): string[] => {
  const relatedTags: string[] = [];
  
  // 查找所有与该标签有关系的其他标签
  relations.forEach(relation => {
    if (relation.source === tagId && !relatedTags.includes(relation.target)) {
      relatedTags.push(relation.target);
    }
    if (relation.target === tagId && !relatedTags.includes(relation.source)) {
      relatedTags.push(relation.source);
    }
  });
  
  return relatedTags;
};

/**
 * 计算标签颜色，基于权重
 */
export const getTagColor = (weight: number, isDarkTheme: boolean = false): string => {
  if (isDarkTheme) {
    // 深色主题: 蓝色渐变
    const hue = 220;
    const saturation = 80 + (weight * 2);
    const lightness = 40 + (weight * 3);
    return `hsl(${hue}, ${saturation}%, ${lightness}%)`;
  } else {
    // 浅色主题: 蓝色渐变
    const hue = 220;
    const saturation = 70 + (weight * 3);
    const lightness = 70 - (weight * 3);
    return `hsl(${hue}, ${saturation}%, ${lightness}%)`;
  }
}; 