// 量子管理器 - AI辅助功能的核心控制中心
class QuantumManager {
    constructor() {
        this.initialized = false;
        this.activeView = null;
        this.bookmarkData = null;
        this.visualizationInstance = null;
        this.selectedModel = 'quantum-v1'; // 默认模型
    }

    // 初始化量子管理器
    init() {
        if (this.initialized) return true;
        
        console.log('量子管理器初始化...');
        
        // 获取或创建容器元素
        this.container = document.querySelector('.quantum-cloud-container');
        if (!this.container) {
            console.warn('量子云图容器未找到，将创建一个新容器');
            
            // 尝试获取父容器
            const featureContent = document.querySelector('.feature-content');
            if (!featureContent) {
                console.error('找不到.feature-content容器，无法初始化');
                return false;
            }
            
            // 创建新的量子云图容器
            this.container = document.createElement('div');
            this.container.className = 'quantum-cloud-container';
            featureContent.appendChild(this.container);
        }
        
        // 初始化左侧按钮
        this.initButtons();
        
        // 注册各模块处理函数
        this.handlers = {
            'quantum-cloud': this.showQuantumCloud.bind(this),
            'digital-alchemy': this.showDigitalAlchemy.bind(this),
            'smart-aggregation': this.showSmartAggregation.bind(this),
            'model-selection': this.showModelSelection.bind(this)
        };
        
        this.initialized = true;
        return true;
    }
    
    // 初始化左侧按钮而不是卡片
    initButtons() {
        const buttons = document.querySelectorAll('.feature-button');
        
        buttons.forEach(button => {
            const feature = button.getAttribute('data-feature');
            if (feature && this.handlers[feature]) {
                button.addEventListener('click', () => {
                    this.activateFeature(feature);
                });
            }
        });
        
        // 设置默认激活按钮
        const defaultButton = document.querySelector('.feature-button[data-feature="quantum-cloud"]');
        if (defaultButton) {
            defaultButton.classList.add('active');
        }
    }
    
    // 激活特定功能
    activateFeature(feature) {
        if (!this.handlers[feature]) {
            console.error(`未找到功能处理程序: ${feature}`);
            return;
        }
        
        // 更新UI状态
        this.updateButtonState(feature);
        
        // 处理模型选择特殊情况
        if (feature === 'model-selection') {
            // 模型选择使用单独的容器，不使用主容器
            document.querySelector('.quantum-cloud-container').style.display = 'none';
            document.querySelector('.model-selection-container')?.style.display = 'block';
        } else {
            // 其他功能使用主容器
            document.querySelector('.quantum-cloud-container').style.display = 'block';
            document.querySelector('.model-selection-container')?.style.display = 'none';
            
            // 调用对应功能处理函数
            this.handlers[feature]();
        }
        
        // 更新当前激活视图
        this.activeView = feature;
    }
    
    // 更新按钮状态
    updateButtonState(activeFeature) {
        const buttons = document.querySelectorAll('.feature-button');
        buttons.forEach(button => {
            const feature = button.getAttribute('data-feature');
            button.classList.toggle('active', feature === activeFeature);
        });
    }
    
    // 量子云图功能 - 默认功能
    async showQuantumCloud() {
        console.log('显示量子云图...');
        
        // 清空容器
        this.clearContainer();
        
        // 创建云图容器
        const cloudContainer = document.createElement('div');
        cloudContainer.className = 'quantum-visualization';
        this.container.appendChild(cloudContainer);
        
        // 加载量子云图可视化
        if (!this.visualizationInstance) {
            // 导入可视化模块
            const QuantumCloudVisualization = await this.importVisualization();
            this.visualizationInstance = new QuantumCloudVisualization(cloudContainer);
        }
        
        // 如果没有书签数据，先加载书签
        if (!this.bookmarkData) {
            await this.loadBookmarks();
        }
        
        // 更新标题中的书签数量
        const descriptionElement = document.querySelector('.ai-description');
        if (descriptionElement && this.bookmarkData) {
            descriptionElement.textContent = `已加载 ${this.bookmarkData.length} 个书签节点`;
        }
        
        // 渲染云图
        this.visualizationInstance.render(this.bookmarkData);
    }
    
    // 数字炼金石功能 - 框架保留
    showDigitalAlchemy() {
        console.log('显示数字炼金石...');
        
        // 清空容器
        this.clearContainer();
        
        // 创建炼金石UI
        const alchemyContainer = document.createElement('div');
        alchemyContainer.className = 'digital-alchemy-container';
        
        alchemyContainer.innerHTML = `
            <div class="feature-placeholder">
                <h2>数字炼金石</h2>
                <p>此功能正在开发中，敬请期待...</p>
                <div class="feature-icon">⚗️</div>
            </div>
        `;
        
        this.container.appendChild(alchemyContainer);
    }
    
    // 智能聚合功能 - 框架保留
    showSmartAggregation() {
        console.log('显示智能聚合...');
        
        // 清空容器
        this.clearContainer();
        
        // 创建智能聚合UI
        const aggregationContainer = document.createElement('div');
        aggregationContainer.className = 'smart-aggregation-container';
        
        aggregationContainer.innerHTML = `
            <div class="feature-placeholder">
                <h2>智能聚合</h2>
                <p>此功能正在开发中，敬请期待...</p>
                <div class="feature-icon">🔄</div>
            </div>
        `;
        
        this.container.appendChild(aggregationContainer);
    }
    
    // 添加展示模型选择的方法
    showModelSelection() {
        console.log('显示模型选择...');
        
        // 清空容器
        this.clearContainer();
        
        // 显示模型选择容器
        const modelContainer = document.querySelector('.model-selection-container');
        if (modelContainer) {
            modelContainer.style.display = 'block';
        }
    }
    
    // 调用AI模型处理书签
    async callAIModelForBookmarks(bookmarks) {
        // 这里应该是真实的API调用
        // 为演示目的，生成模拟数据
        
        console.log(`使用模型 ${this.selectedModel} 处理 ${bookmarks.length} 个书签`);
        
        // 模拟API延迟
        await new Promise(resolve => setTimeout(resolve, 1500));
        
        // 生成模拟结果
        return bookmarks.map(bookmark => {
            // 根据域名生成不同建议
            const domain = this.extractDomain(bookmark.url);
            let category, tags;
            
            if (domain.includes('github')) {
                category = '技术/开发/代码库';
                tags = ['开发', 'GitHub', '代码'];
            } else if (domain.includes('youtube')) {
                category = '娱乐/视频/学习';
                tags = ['视频', '教程', '娱乐'];
            } else if (domain.includes('docs') || domain.includes('documentation')) {
                category = '学习/文档/技术';
                tags = ['文档', '参考', '学习'];
            } else if (domain.includes('news') || domain.includes('bbc') || domain.includes('cnn')) {
                category = '新闻/媒体/时事';
                tags = ['新闻', '时事', '媒体'];
            } else {
                // 随机生成其他类别
                const categories = [
                    '工具/实用/参考',
                    '社交/网络/沟通',
                    '购物/电商/消费',
                    '金融/投资/理财',
                    '健康/生活/饮食'
                ];
                
                const tagSets = [
                    ['工具', '实用', '效率'],
                    ['社交', '沟通', '网络'],
                    ['购物', '比价', '电商'],
                    ['投资', '理财', '金融'],
                    ['健康', '生活', '饮食']
                ];
                
                const index = Math.floor(Math.random() * categories.length);
                category = categories[index];
                tags = tagSets[index];
            }
            
            return {
                title: bookmark.title,
                url: bookmark.url,
                domain: domain,
                suggestedPath: category,
                tags: tags.slice(0, 3) // 最多3个标签
            };
        });
    }
    
    // 从URL中提取域名
    extractDomain(url) {
        try {
            const urlObj = new URL(url);
            return urlObj.hostname;
        } catch (e) {
            return url;
        }
    }
    
    // 加载书签数据
    async loadBookmarks() {
        return new Promise((resolve) => {
            browser.bookmarks.getTree(bookmarkTree => {
                this.bookmarkData = this.flattenBookmarks(bookmarkTree);
                console.log(`已加载 ${this.bookmarkData.length} 个书签`);
                resolve(this.bookmarkData);
            });
        });
    }
    
    // 将书签树扁平化为数组
    flattenBookmarks(nodes) {
        let bookmarks = [];
        
        const processNode = (node) => {
            if (node.url) {
                bookmarks.push(node);
            }
            
            if (node.children) {
                node.children.forEach(processNode);
            }
        };
        
        nodes.forEach(processNode);
        return bookmarks;
    }
    
    // 动态导入可视化模块
    async importVisualization() {
        // 在真实项目中，这里应该是动态import
        // 为简化，直接返回一个模拟的可视化类
        return class QuantumCloudVisualization {
            constructor(container) {
                this.container = container;
                this.initialized = false;
                console.log('量子云图可视化初始化');
            }
            
            async render(data) {
                if (!this.initialized) {
                    await this.init();
                }
                
                console.log(`渲染量子云图，数据量: ${data.length}`);
                this.renderForceGraph(data);
            }
            
            async init() {
                console.log('初始化D3可视化');
                // 在真实代码中，这里需要加载D3.js
                this.initialized = true;
            }
            
            renderForceGraph(data) {
                // 这里应为D3.js实现的力导向图
                // 简化为基本HTML展示
                this.container.innerHTML = `
                    <div class="visualization-info">
                        <h3>量子书签关系图</h3>
                        <p>已加载 ${data.length} 个书签节点</p>
                    </div>
                    <div class="force-graph-placeholder">
                        <div class="nodes-preview">
                            ${this.generateNodePreview(data)}
                        </div>
                    </div>
                `;
            }
            
            generateNodePreview(data) {
                // 生成一些示例节点
                return data.slice(0, 20).map(bookmark => {
                    const domain = bookmark.url ? new URL(bookmark.url).hostname : 'unknown';
                    return `<div class="preview-node" title="${bookmark.title}">${domain}</div>`;
                }).join('');
            }
        };
    }
    
    // 显示通知
    showNotification(message, type = 'info') {
        const notification = document.createElement('div');
        notification.className = `notification ${type}`;
        notification.textContent = message;
        
        document.body.appendChild(notification);
        
        // 自动消失
        setTimeout(() => {
            notification.classList.add('fade-out');
            setTimeout(() => {
                document.body.removeChild(notification);
            }, 500);
        }, 3000);
    }
    
    // 清空容器
    clearContainer() {
        if (this.container) {
            this.container.innerHTML = '';
        }
    }
    
    // 显示量子功能
    show() {
        if (!this.initialized) {
            this.init();
        }
        
        // 确保量子云图立即显示
        this.showQuantumCloud();
        
        // 确保model-selection容器隐藏
        const modelContainer = document.querySelector('.model-selection-container');
        if (modelContainer) {
            modelContainer.style.display = 'none';
        }
    }
    
    // 更改选定的模型
    setModel(modelName) {
        this.selectedModel = modelName;
        console.log(`模型已切换为: ${modelName}`);
    }
}

// 创建单例实例
const QuantumManager = new QuantumManager();

// 导出单例到全局对象，确保它是可访问的
window.QuantumManager = QuantumManager; 