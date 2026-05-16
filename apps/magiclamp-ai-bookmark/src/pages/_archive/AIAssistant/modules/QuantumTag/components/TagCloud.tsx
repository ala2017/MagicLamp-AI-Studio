import React, { useEffect, useRef, useState } from 'react';
import styles from '../styles/TagCloud.module.scss';
import { calculateTagPositions, getTagColor } from '../utils/tagHelper';
import { Tag } from '../services/aiAnalysisService';

interface TagCloudProps {
  tags: Tag[];
  selectedTags: string[];
  onTagClick: (tagId: string) => void;
}

/**
 * 标签云组件
 * 使用优化的布局算法实现标签云效果
 */
const TagCloud: React.FC<TagCloudProps> = ({ tags, selectedTags, onTagClick }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [positions, setPositions] = useState<{[key: string]: {x: number, y: number}}>({});
  const [containerSize, setContainerSize] = useState<{width: number, height: number}>({
    width: 800,
    height: 500
  });
  
  // 监听容器大小变化
  useEffect(() => {
    if (!containerRef.current) return;
    
    const updateSize = () => {
      if (containerRef.current) {
        const { clientWidth, clientHeight } = containerRef.current;
        setContainerSize({
          width: clientWidth,
          height: clientHeight
        });
      }
    };
    
    // 初始化大小
    updateSize();
    
    // 添加resize监听
    const resizeObserver = new ResizeObserver(updateSize);
    resizeObserver.observe(containerRef.current);
    
    return () => {
      if (containerRef.current) {
        resizeObserver.unobserve(containerRef.current);
      }
    };
  }, []);
  
  // 当容器大小或标签变化时，重新计算布局
  useEffect(() => {
    if (!containerRef.current || !tags.length) return;
    
    // 使用优化的布局算法
    const newPositions = calculateTagPositions(
      tags,
      containerSize.width,
      containerSize.height
    );
    
    setPositions(newPositions);
  }, [tags, containerSize]);
  
  // 标签动画效果
  const getTagStyle = (tag: Tag) => {
    const pos = positions[tag.id] || { x: 0, y: 0 };
    const fontSize = 14 + tag.weight * 2;
    const isSelected = selectedTags.includes(tag.id);
    
    // 使用基于权重的颜色
    const backgroundColor = isSelected 
      ? '#4263EB' 
      : 'rgba(66, 99, 235, 0.1)';
      
    const color = isSelected 
      ? 'white' 
      : getTagColor(tag.weight);
    
    // 添加一些随机动画效果
    const animationDuration = 3 + Math.random() * 4; // 3-7秒
    const animationDelay = Math.random() * 2; // 0-2秒
    
    return {
      left: `${pos.x}px`,
      top: `${pos.y}px`,
      fontSize: `${fontSize}px`,
      backgroundColor,
      color,
      transform: isSelected ? 'scale(1.1)' : 'scale(1)',
      animationDuration: `${animationDuration}s`,
      animationDelay: `${animationDelay}s`
    };
  };

  return (
    <div className={styles.tagCloudContainer} ref={containerRef}>
      <div className={styles.tags}>
        {tags.map(tag => (
          <div
            key={tag.id}
            className={`${styles.tag} ${selectedTags.includes(tag.id) ? styles.active : ''}`}
            onClick={() => onTagClick(tag.id)}
            style={getTagStyle(tag)}
          >
            {tag.label}
          </div>
        ))}
      </div>
    </div>
  );
};

export default TagCloud; 