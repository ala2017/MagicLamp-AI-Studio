/**
 * 量子标签组件加载器
 * 用于在非React环境中加载和渲染QuantumTag组件
 */

(function() {
    // 定义全局渲染函数
    window.renderQuantumTag = function(container, React, ReactDOM) {
        console.log('准备渲染量子标签组件');
        
        try {
            // 定义一个简化版的QuantumTag组件
            const QuantumTag = function() {
                // 使用React hooks
                const [viewMode, setViewMode] = React.useState('cloud');
                const [selectedTags, setSelectedTags] = React.useState([]);
                const [isLoading, setIsLoading] = React.useState(false);
                const [error, setError] = React.useState(null);
                const [errorType, setErrorType] = React.useState(null);
                
                // 获取模型配置
                const modelConfig = {
                    apiEndpoint: localStorage.getItem('ai_api_endpoint') || 'https://api.openai.com/v1/chat/completions',
                    apiKey: localStorage.getItem('ai_api_key') || '',
                    model: localStorage.getItem('ai_model') || 'gpt-3.5-turbo'
                };
                
                // 检查API配置
                React.useEffect(() => {
                    if (!modelConfig.apiKey) {
                        setError('您需要先配置API密钥才能使用量子标签功能。请前往模型设置页面配置API密钥。');
                        setErrorType('api_key');
                    }
                }, []);
                
                // 跳转到模型设置
                const goToModelSettings = () => {
                    try {
                        console.log('尝试切换到模型设置');
                        const customEvent = new CustomEvent('switchToModelSettings', {
                            detail: { feature: 'model-selection' }
                        });
                        document.dispatchEvent(customEvent);
                    } catch (error) {
                        console.error('跳转到模型设置失败:', error);
                    }
                };
                
                // 刷新数据
                const handleRefresh = () => {
                    console.log('刷新功能被调用');
                    NotificationManager.show('功能提示', '刷新功能尚未实现', 'warning', 3000);
                };
                
                // 根据错误类型渲染不同的错误提示
                const renderErrorContent = () => {
                    if (errorType === 'api_key') {
                        return React.createElement('div', { className: 'error-container' },
                            React.createElement('div', { className: 'error-icon' }, '🔑'),
                            React.createElement('div', { className: 'error-title' }, 'API密钥未配置'),
                            React.createElement('div', { className: 'error-message' }, error),
                            React.createElement('button', { 
                                className: 'primary-button',
                                onClick: goToModelSettings
                            }, '前往模型设置'),
                            React.createElement('button', { 
                                className: 'secondary-button',
                                onClick: handleRefresh
                            }, '重试')
                        );
                    } else if (errorType === 'api_error') {
                        return React.createElement('div', { className: 'error-container' },
                            React.createElement('div', { className: 'error-icon' }, '⚠️'),
                            React.createElement('div', { className: 'error-title' }, 'API调用失败'),
                            React.createElement('div', { className: 'error-message' }, error),
                            React.createElement('button', { 
                                className: 'primary-button',
                                onClick: goToModelSettings
                            }, '检查模型设置'),
                            React.createElement('button', { 
                                className: 'secondary-button',
                                onClick: handleRefresh
                            }, '重试')
                        );
                    } else {
                        return React.createElement('div', { className: 'error-container' },
                            React.createElement('div', { className: 'error-icon' }, '❌'),
                            React.createElement('div', { className: 'error-title' }, '发生错误'),
                            React.createElement('div', { className: 'error-message' }, error),
                            React.createElement('button', { 
                                className: 'primary-button',
                                onClick: handleRefresh
                            }, '重试')
                        );
                    }
                };
                
                // 渲染空状态
                const renderEmptyState = () => {
                    return React.createElement('div', { className: 'empty-state' },
                        React.createElement('div', { className: 'empty-icon' }, viewMode === 'cloud' ? '📚' : '🔍'),
                        React.createElement('div', { className: 'empty-text' }, 
                            viewMode === 'cloud' ? '没有找到标签数据' : '没有找到关系数据'
                        ),
                        React.createElement('button', { 
                            className: 'action-button',
                            onClick: handleRefresh
                        }, '分析书签')
                    );
                };
                
                // 渲染主UI
                return React.createElement('div', { className: 'quantum-container' },
                    // 顶部切换标签
                    React.createElement('div', { className: 'view-tabs' },
                        React.createElement('div', { 
                            className: viewMode === 'cloud' ? 'tab-item active' : 'tab-item',
                            onClick: () => setViewMode('cloud')
                        }, '标签云'),
                        React.createElement('div', { 
                            className: viewMode === 'relation' ? 'tab-item active' : 'tab-item',
                            onClick: () => setViewMode('relation')
                        }, '关系图谱'),
                        
                        // 刷新按钮
                        React.createElement('div', { 
                            className: 'refresh-button',
                            onClick: handleRefresh,
                            title: '刷新数据'
                        }, 
                            React.createElement('svg', { 
                                viewBox: '0 0 24 24',
                                width: '16',
                                height: '16'
                            },
                                React.createElement('path', { 
                                    fill: 'currentColor',
                                    d: 'M17.65,6.35C16.2,4.9 14.21,4 12,4A8,8 0 0,0 4,12A8,8 0 0,0 12,20C15.73,20 18.84,17.45 19.73,14H17.65C16.83,16.33 14.61,18 12,18A6,6 0 0,1 6,12A6,6 0 0,1 12,6C13.66,6 15.14,6.69 16.22,7.78L13,11H20V4L17.65,6.35Z'
                                })
                            )
                        ),
                        
                        // 模型设置按钮
                        React.createElement('div', { 
                            className: 'settings-button',
                            onClick: goToModelSettings,
                            title: '模型设置'
                        }, 
                            React.createElement('svg', { 
                                viewBox: '0 0 24 24',
                                width: '16',
                                height: '16'
                            },
                                React.createElement('path', { 
                                    fill: 'currentColor',
                                    d: 'M12,15.5A3.5,3.5 0 0,1 8.5,12A3.5,3.5 0 0,1 12,8.5A3.5,3.5 0 0,1 15.5,12A3.5,3.5 0 0,1 12,15.5M19.43,12.97C19.47,12.65 19.5,12.33 19.5,12C19.5,11.67 19.47,11.34 19.43,11L21.54,9.37C21.73,9.22 21.78,8.95 21.66,8.73L19.66,5.27C19.54,5.05 19.27,4.96 19.05,5.05L16.56,6.05C16.04,5.66 15.5,5.32 14.87,5.07L14.5,2.42C14.46,2.18 14.25,2 14,2H10C9.75,2 9.54,2.18 9.5,2.42L9.13,5.07C8.5,5.32 7.96,5.66 7.44,6.05L4.95,5.05C4.73,4.96 4.46,5.05 4.34,5.27L2.34,8.73C2.21,8.95 2.27,9.22 2.46,9.37L4.57,11C4.53,11.34 4.5,11.67 4.5,12C4.5,12.33 4.53,12.65 4.57,12.97L2.46,14.63C2.27,14.78 2.21,15.05 2.34,15.27L4.34,18.73C4.46,18.95 4.73,19.03 4.95,18.95L7.44,17.94C7.96,18.34 8.5,18.68 9.13,18.93L9.5,21.58C9.54,21.82 9.75,22 10,22H14C14.25,22 14.46,21.82 14.5,21.58L14.87,18.93C15.5,18.67 16.04,18.34 16.56,17.94L19.05,18.95C19.27,19.03 19.54,18.95 19.66,18.73L21.66,15.27C21.78,15.05 21.73,14.78 21.54,14.63L19.43,12.97Z'
                                })
                            )
                        )
                    ),
                    
                    // 视图内容区域
                    React.createElement('div', { className: 'view-container' },
                        isLoading ? 
                            // 加载状态
                            React.createElement('div', { className: 'loading-indicator' },
                                React.createElement('div', { className: 'spinner' }),
                                React.createElement('div', { className: 'loading-text' }, '加载中...')
                            ) 
                        : error ? 
                            // 错误状态
                            renderErrorContent()
                        : 
                            // 空状态 - 实际项目中这里会显示真正的标签云或关系图
                            React.createElement(React.Fragment, null,
                                // 标签云视图
                                React.createElement('div', { 
                                    className: viewMode === 'cloud' ? 'tag-cloud-view active' : 'tag-cloud-view'
                                }, renderEmptyState()),
                                
                                // 关系图谱视图
                                React.createElement('div', { 
                                    className: viewMode === 'relation' ? 'tag-relation-view active' : 'tag-relation-view'
                                }, renderEmptyState())
                            )
                    )
                );
            };
            
            // 添加样式
            const style = document.createElement('style');
            style.textContent = `
                .quantum-container {
                    display: flex;
                    flex-direction: column;
                    height: 100%;
                    width: 100%;
                    padding: 20px;
                    background: #222;
                    border-radius: 12px;
                    color: #fff;
                }
                
                .view-tabs {
                    display: flex;
                    margin-bottom: 20px;
                    border-radius: 8px;
                    overflow: hidden;
                    background: rgba(0, 0, 0, 0.2);
                }
                
                .tab-item {
                    padding: 12px 20px;
                    cursor: pointer;
                    text-align: center;
                    flex: 1;
                    transition: all 0.3s ease;
                    font-weight: 500;
                    color: rgba(255, 255, 255, 0.7);
                }
                
                .tab-item:hover {
                    color: rgba(255, 255, 255, 0.9);
                    background: rgba(255, 255, 255, 0.05);
                }
                
                .tab-item.active {
                    background: linear-gradient(135deg, #4F8FFE, #18C8FF);
                    color: white;
                }
                
                .view-container {
                    position: relative;
                    flex: 1;
                    background: rgba(0, 0, 0, 0.1);
                    border-radius: 8px;
                    min-height: 300px;
                    overflow: hidden;
                }
                
                .tag-cloud-view,
                .tag-relation-view {
                    position: absolute;
                    width: 100%;
                    height: 100%;
                    opacity: 0;
                    pointer-events: none;
                    transition: opacity 0.3s ease;
                }
                
                .tag-cloud-view.active,
                .tag-relation-view.active {
                    opacity: 1;
                    pointer-events: auto;
                }
                
                .loading-indicator {
                    position: absolute;
                    top: 0;
                    left: 0;
                    width: 100%;
                    height: 100%;
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    justify-content: center;
                    background: rgba(0, 0, 0, 0.2);
                }
                
                .spinner {
                    width: 40px;
                    height: 40px;
                    border: 3px solid rgba(255, 255, 255, 0.1);
                    border-radius: 50%;
                    border-top-color: #4F8FFE;
                    animation: spin 1s ease-in-out infinite;
                    margin-bottom: 10px;
                }
                
                @keyframes spin {
                    to { transform: rotate(360deg); }
                }
                
                .refresh-button,
                .settings-button {
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    width: 36px;
                    height: 36px;
                    margin-left: 8px;
                    border-radius: 50%;
                    cursor: pointer;
                    transition: background-color 0.3s ease;
                }
                
                .refresh-button:hover,
                .settings-button:hover {
                    background-color: rgba(255, 255, 255, 0.1);
                }
                
                .error-container {
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    justify-content: center;
                    padding: 2rem;
                    background-color: rgba(0, 0, 0, 0.2);
                    border-radius: 8px;
                    text-align: center;
                    max-width: 500px;
                    margin: 0 auto;
                }
                
                .error-icon {
                    font-size: 48px;
                    margin-bottom: 1rem;
                }
                
                .error-title {
                    font-size: 20px;
                    font-weight: bold;
                    margin-bottom: 0.5rem;
                    color: #ff5252;
                }
                
                .error-message {
                    margin-bottom: 1.5rem;
                    line-height: 1.5;
                }
                
                .primary-button,
                .secondary-button,
                .action-button {
                    padding: 10px 16px;
                    border-radius: 4px;
                    border: none;
                    font-size: 14px;
                    cursor: pointer;
                    transition: all 0.3s ease;
                    margin: 5px;
                }
                
                .primary-button {
                    background-color: #4263EB;
                    color: white;
                }
                
                .primary-button:hover {
                    background-color: #3b58d9;
                    transform: translateY(-2px);
                }
                
                .secondary-button {
                    background-color: transparent;
                    border: 1px solid #4263EB;
                    color: #4263EB;
                }
                
                .secondary-button:hover {
                    background-color: rgba(66, 99, 235, 0.1);
                    transform: translateY(-2px);
                }
                
                .action-button {
                    background-color: #4263EB;
                    color: white;
                    margin-top: 1rem;
                }
                
                .action-button:hover {
                    background-color: #3b58d9;
                    transform: translateY(-2px);
                }
                
                .empty-state {
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    justify-content: center;
                    height: 100%;
                }
                
                .empty-icon {
                    font-size: 48px;
                    margin-bottom: 1rem;
                }
                
                .empty-text {
                    margin-bottom: 1rem;
                    font-size: 16px;
                    color: rgba(255, 255, 255, 0.7);
                }
            `;
            document.head.appendChild(style);
            
            // 创建一个根元素并渲染组件
            console.log('开始渲染QuantumTag组件');
            const root = ReactDOM.createRoot(container);
            root.render(
                React.createElement(
                    React.StrictMode,
                    null,
                    React.createElement(QuantumTag, null)
                )
            );
            
            console.log('QuantumTag组件渲染完成');
        } catch (error) {
            console.error('渲染QuantumTag组件时发生错误:', error);
            container.innerHTML = `<div style="color: red; padding: 20px;">渲染量子标签组件时发生错误: ${error.message}</div>`;
        }
    };
    
    console.log('量子标签加载器已初始化');
})(); 