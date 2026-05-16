import React from 'react';
import styles from './styles/QuantumCloud.module.scss';

/**
 * 极简量子云图组件 - 用于测试按钮功能
 */
const QuantumCloud: React.FC = () => {
  return (
    <div className={styles.testContainer} style={{ 
      width: '100%', 
      height: '500px', 
      background: 'linear-gradient(135deg, #4285F4, #34A853)',
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
      <h2 style={{ marginBottom: '20px' }}>量子云图测试</h2>
      <p>如果您能看到这个内容，说明量子云图按钮工作正常</p>
      <div style={{ 
        width: '200px', 
        height: '200px', 
        background: 'rgba(255,255,255,0.2)', 
        borderRadius: '50%',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        marginTop: '30px'
      }}>
        测试节点
      </div>
    </div>
  );
};

export default QuantumCloud; 