import React from 'react';
import styles from './index.module.scss';

interface StatsPanelProps {
  stats: Array<{
    label: string;
    value: string;
  }>;
}

export const StatsPanel: React.FC<StatsPanelProps> = ({ stats }) => {
  return (
    <div className={styles.panel}>
      {stats.map((stat, index) => (
        <div key={index} className={styles.stat}>
          <div className={styles.value}>{stat.value}</div>
          <div className={styles.label}>{stat.label}</div>
        </div>
      ))}
    </div>
  );
}; 