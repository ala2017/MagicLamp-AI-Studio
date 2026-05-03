import React from 'react';
import { useNavigate } from 'react-router-dom';
import styles from './index.module.scss';

interface FeatureCardProps {
  title: string;
  description: string;
  icon: string;
  gradient: string;
  particles: string;
  path: string;
}

export const FeatureCard: React.FC<FeatureCardProps> = ({
  title,
  description,
  icon,
  gradient,
  particles,
  path
}) => {
  const navigate = useNavigate();

  return (
    <div 
      className={`${styles.card} ${styles[gradient]}`}
      onClick={() => navigate(path)}
    >
      <div className={styles.particleContainer}>
        <div className={`${styles.particles} ${styles[particles]}`} />
      </div>
      
      <div className={styles.icon}>
        <img src={`/assets/icons/${icon}.svg`} alt={title} />
      </div>
      
      <h3>{title}</h3>
      <p>{description}</p>
      
      <div className={styles.shine} />
    </div>
  );
}; 