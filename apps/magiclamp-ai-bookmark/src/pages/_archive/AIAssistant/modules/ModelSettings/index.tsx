import React from 'react';
import styles from './styles/ModelSettings.module.scss';

/**
 * 极简模型设置组件 - 用于测试按钮功能
 */
const ModelSettings: React.FC = () => {
  return (
    <div className={styles.testContainer} style={{ 
      width: '100%', 
      height: '500px', 
      background: 'linear-gradient(135deg, #EA4335, #FBBC05)',
      borderRadius: '12px',
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'center',
      alignItems: 'center',
      color: 'white',
      fontSize: '24px',
      fontWeight: 'bold',
      textAlign: 'center',
      padding: '20px'
    }}>
      <h2 style={{ marginBottom: '20px' }}>模型设置测试</h2>
      <p>如果您能看到这个内容，说明模型设置按钮工作正常</p>
      <div style={{ 
        marginTop: '30px',
        display: 'flex',
        flexDirection: 'column',
        gap: '15px',
        width: '300px'
      }}>
        <div style={{
          padding: '15px',
          background: 'rgba(255,255,255,0.2)',
          borderRadius: '8px',
          display: 'flex',
          justifyContent: 'center'
        }}>
          测试设置选项
        </div>
        <div style={{
          padding: '15px',
          background: 'rgba(255,255,255,0.2)',
          borderRadius: '8px',
          display: 'flex',
          justifyContent: 'center'
        }}>
          测试设置选项
        </div>
      </div>
    </div>
  );
};

export default ModelSettings; 