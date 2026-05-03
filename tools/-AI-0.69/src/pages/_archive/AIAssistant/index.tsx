import React, { useState, lazy, Suspense, useEffect, useRef } from 'react';
import { RobotOutlined, ExperimentOutlined, ClusterOutlined, SettingOutlined, CloudOutlined } from '@ant-design/icons';
import styles from './styles/AIAssistant.module.scss';
import { NotificationManager } from 'react-notifications';

// 懒加载所有模块组件
const QuantumTag = lazy(() => import('./modules/QuantumTag'));
const QuantumCloud = lazy(() => import('./modules/QuantumCloud'));
const ModelSettings = lazy(() => import('./modules/ModelSettings'));

// 定义所有功能
const features = [
  {
    title: '量子云图',
    description: '多维度智能标签系统，构建您的知识量子云图',
    icon: <CloudOutlined />,
    key: 'cloud'
  },
  {
    title: '量子标签',
    description: '多维度超维标签系统，构建您的知识量子云图',
    icon: <RobotOutlined />,
    key: 'quantum'
  },
  {
    title: '数字炼金石',
    description: '深度解析行为数据，提炼您的知识兴趣',
    icon: <ExperimentOutlined />,
    key: 'alchemy'
  },
  {
    title: '智能聚合',
    description: '自动分类整理，构建知识关联网络',
    icon: <ClusterOutlined />,
    key: 'cluster'
  },
  {
    title: '模型设置',
    description: '配置AI模型和服务提供商',
    icon: <SettingOutlined />,
    key: 'settings'
  },
  {
    title: '标签管理',
    description: '超维标签管理系统，提供标签云与关系图谱',
    icon: <RobotOutlined />,
    key: 'tagManagement'
  }
];

const stats = [
  { label: '已处理书签', value: '1,234' },
  { label: '量子标签', value: '89' },
  { label: '兴趣主题', value: '12' },
  { label: '效率提升', value: '78%' }
];

const AIAssistant: React.FC = () => {
  console.log('AIAssistant组件加载');
  
  // 使用useRef保存当前选择的功能，确保在组件重渲染之间保持值
  const selectedFeatureRef = useRef<string>('');
  // 使用实际的状态来保存当前选中的功能，以触发正确的重渲染
  const [selectedFeature, setSelectedFeature] = useState<string>('');

  // 组件加载时添加调试信息
  useEffect(() => {
    console.log('AIAssistant组件已挂载');
    console.log('当前选中功能:', selectedFeature);
    
    // 在控制台强调刷新信息
    console.log('%c请确保刷新页面以看到最新更改！', 'background: red; color: white; padding: 4px; font-size: 16px;');
  }, [selectedFeature]);

  // 功能选择处理函数
  const selectFeature = (key: string) => {
    console.log('选择功能:', key);
    selectedFeatureRef.current = key;
    setSelectedFeature(key);
    
    // 添加控制台调试信息
    console.log(`已选择功能: ${key}`);
    NotificationManager.show('功能选择', `已选择功能: ${key}`, 'info', 3000);
  };

  // 返回主页
  const goHome = () => {
    console.log('返回主页');
    selectedFeatureRef.current = '';
    setSelectedFeature('');
    
    // 添加控制台调试信息
    console.log('已返回主页');
    NotificationManager.show('导航', '已返回主页', 'info', 3000);
  };

  // 渲染功能内容
  const renderContent = () => {
    console.log('渲染内容, 当前功能:', selectedFeature);
    
    // 如果没有选中功能，显示主页
    if (!selectedFeature) {
      return (
        <>
          {/* 功能卡片网格 */}
          <div className={styles.featureGrid}>
            {features.map(feature => (
              <div
                key={feature.key}
                className={styles.featureCard}
                onClick={() => selectFeature(feature.key)}
              >
                <div className={styles.featureCardHeader}>
                  <div className={styles.featureCardIcon}>
                    {feature.icon}
                  </div>
                  <h3 className={styles.featureCardTitle}>{feature.title}</h3>
                </div>
                <p className={styles.featureCardDescription}>
                  {feature.description}
                </p>
              </div>
            ))}
          </div>

          {/* 统计数据网格 */}
          <div className={styles.statsGrid}>
            {stats.map((stat, index) => (
              <div key={index} className={styles.statCard}>
                <div className={styles.statValue}>{stat.value}</div>
                <div className={styles.statLabel}>{stat.label}</div>
              </div>
            ))}
          </div>
        </>
      );
    }
    
    // 显示选中的功能内容
    return (
      <div className={styles.featureContent}>
        <div style={{ marginBottom: '20px' }}>
          <button 
            onClick={goHome}
            style={{ 
              padding: '8px 16px', 
              background: '#333', 
              border: 'none', 
              borderRadius: '4px', 
              color: 'white', 
              cursor: 'pointer',
              fontSize: '16px',
              fontWeight: 'bold'
            }}
          >
            返回主页
          </button>
        </div>
        
        <Suspense fallback={<div className={styles.loading}>加载中...</div>}>
          {selectedFeature === 'cloud' && (
            <div style={{ border: '2px solid blue', padding: '20px', borderRadius: '8px' }}>
              <h2>量子云图</h2>
              <QuantumCloud />
            </div>
          )}
          {selectedFeature === 'quantum' && (
            <div style={{ border: '2px solid green', padding: '20px', borderRadius: '8px' }}>
              <h2>量子标签</h2>
              <QuantumTag />
            </div>
          )}
          {selectedFeature === 'settings' && (
            <div style={{ border: '2px solid orange', padding: '20px', borderRadius: '8px' }}>
              <h2>模型设置</h2>
              <ModelSettings />
            </div>
          )}
          {selectedFeature === 'alchemy' && <div className={styles.placeholder}>数字炼金石功能正在开发中...</div>}
          {selectedFeature === 'cluster' && <div className={styles.placeholder}>智能聚合功能正在开发中...</div>}
          {selectedFeature === 'tagManagement' && <div className={styles.placeholder}>标签管理功能正在开发中...</div>}
        </Suspense>
      </div>
    );
  };

  return (
    <div className={styles.aiAssistantContainer}>
      {/* 紧急测试按钮 - 样式更加明显 */}
      <div style={{
        position: 'fixed',
        top: '10px',
        right: '10px',
        zIndex: 9999,
        background: '#ff0000',
        padding: '15px',
        borderRadius: '8px',
        color: 'white',
        fontWeight: 'bold',
        boxShadow: '0 0 20px rgba(255, 0, 0, 0.5)',
        border: '3px solid white'
      }}>
        <div style={{ fontSize: '18px', marginBottom: '5px' }}>紧急测试面板</div>
        <div style={{ fontSize: '16px' }}>当前功能: {selectedFeature || '主页'}</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '10px' }}>
          <button 
            onClick={() => selectFeature('cloud')}
            style={{ 
              padding: '8px', 
              background: '#2196f3', 
              border: 'none', 
              borderRadius: '4px', 
              color: 'white', 
              cursor: 'pointer',
              fontWeight: 'bold',
              fontSize: '14px'
            }}
          >
            测试量子云图
          </button>
          <button 
            onClick={() => selectFeature('quantum')}
            style={{ 
              padding: '8px', 
              background: '#4caf50', 
              border: 'none', 
              borderRadius: '4px', 
              color: 'white', 
              cursor: 'pointer',
              fontWeight: 'bold',
              fontSize: '14px'
            }}
          >
            测试量子标签
          </button>
          <button 
            onClick={() => selectFeature('settings')}
            style={{ 
              padding: '8px', 
              background: '#ff9800', 
              border: 'none', 
              borderRadius: '4px', 
              color: 'white', 
              cursor: 'pointer',
              fontWeight: 'bold',
              fontSize: '14px'
            }}
          >
            测试模型设置
          </button>
          <button 
            onClick={() => selectFeature('tagManagement')}
            style={{ 
              padding: '8px', 
              background: '#ff9800', 
              border: 'none', 
              borderRadius: '4px', 
              color: 'white', 
              cursor: 'pointer',
              fontWeight: 'bold',
              fontSize: '14px'
            }}
          >
            测试标签管理
          </button>
          <button 
            onClick={goHome}
            style={{ 
              padding: '8px', 
              background: '#000000', 
              border: '2px solid white', 
              borderRadius: '4px', 
              color: 'white', 
              cursor: 'pointer',
              fontWeight: 'bold',
              fontSize: '14px',
              marginTop: '5px'
            }}
          >
            返回主页
          </button>
        </div>
      </div>

      {/* 左侧导航 */}
      <nav className={styles.sideNav}>
        {/* 所有功能按钮 */}
        {features.map(feature => (
          <button
            key={feature.key}
            className={`${styles.featureButton} ${selectedFeature === feature.key ? styles.active : ''}`}
            onClick={() => selectFeature(feature.key)}
          >
            <span className={styles.featureButtonIcon}>{feature.icon}</span>
            <span className={styles.featureButtonText}>{feature.title}</span>
          </button>
        ))}
      </nav>

      {/* 主要内容区域 */}
      <main className={styles.mainContent}>
        <header className={styles.header}>
          <h1>AI辅助空间</h1>
          <p>让AI为您的知识管理注入智慧能量</p>
        </header>

        {/* 功能内容区域 */}
        {renderContent()}
      </main>
    </div>
  );
};

export default AIAssistant; 