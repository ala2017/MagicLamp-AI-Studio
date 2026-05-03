import React from 'react';
import styles from './index.module.scss';

interface HistoryItem {
  icon: string;
  title: string;
  description: string;
  time: string;
  type: 'quantum' | 'alchemy';
}

export const HistoryList: React.FC = () => {
  const historyItems: HistoryItem[] = [
    {
      icon: 'quantum',
      title: '量子标签生成完成',
      description: '为42个书签创建了量子关联',
      time: '2分钟前',
      type: 'quantum'
    },
    {
      icon: 'alchemy',
      title: '兴趣图谱更新',
      description: '发现3个新的知识主题',
      time: '1小时前',
      type: 'alchemy'
    },
    {
      icon: 'quantum',
      title: '标签云优化',
      description: '重组了12个关联标签',
      time: '3小时前',
      type: 'quantum'
    }
  ];

  return (
    <div className={styles.container}>
      <h2 className={styles.title}>最近操作记录</h2>
      <div className={styles.list}>
        {historyItems.map((item, index) => (
          <div key={index} className={`${styles.item} ${styles[item.type]}`}>
            <div className={styles.iconWrapper}>
              <img 
                src={`/assets/icons/${item.icon}.svg`} 
                alt="" 
                className={styles.icon} 
              />
            </div>
            <div className={styles.content}>
              <div className={styles.itemTitle}>{item.title}</div>
              <div className={styles.description}>{item.description}</div>
            </div>
            <div className={styles.time}>{item.time}</div>
            <div className={styles.glow} />
          </div>
        ))}
      </div>
    </div>
  );
}; 