/**
 * 模型设置页面脚本
 * 负责处理模型设置页面的交互逻辑
 * 参考: ../../../_archive/index.js:1534-1880
 */

// ====================== 1. 配置模块 ======================
const ModelConfig = {
    // 服务商配置
    providers: {
        siliconio: {
            name: '硅基流动',
            apiUrl: 'https://api.siliconflow.cn/v1/chat/completions',
            modelsUrl: 'https://api.siliconflow.cn/v1/models',
            defaultModel: 'deepseek-ai/DeepSeek-V3',
            models: [],
            logo: '/src/assets/providers/siliconio-logo.png'
        },
        deepseek: {
            name: 'DeepSeek',
            apiUrl: 'https://api.deepseek.com/v1/chat/completions',
            modelsUrl: 'https://api.deepseek.com/v1/models',
            defaultModel: 'deepseek-chat',
            models: [],
            logo: '/src/assets/providers/deepseek-logo.png'
        },
        openai: {
            name: 'OpenAI',
            apiUrl: 'https://api.openai.com/v1/chat/completions',
            modelsUrl: 'https://api.openai.com/v1/models',
            defaultModel: 'gpt-4',
            models: [],
            logo: '/src/assets/providers/openai-logo.png'
        },
        gemini: {
            name: 'Gemini',
            apiUrl: 'https://generativelanguage.googleapis.com',
            defaultModel: 'gemini-pro',
            models: [],
            logo: '/src/assets/providers/gemini-logo.png'
        }
    },
    
    // 存储键
    storageKeys: {
        settings: 'modelSettings',
        currentProvider: 'currentModelProvider'
    },
    
    // 通知配置
    notification: {
        duration: 5000,
        fadeOutDuration: 300
    }
};

// ====================== 2. 日志模块 ======================
const Logger = {
    debug: (message, ...args) => {
        console.debug(`[DEBUG] ${message}`, ...args);
    },
    info: (message, ...args) => {
        console.info(`[INFO] ${message}`, ...args);
    },
    error: (message, ...args) => {
        console.error(`[ERROR] ${message}`, ...args);
    },
    warn: (message, ...args) => {
        console.warn(`[WARN] ${message}`, ...args);
    }
};

// ====================== 3. 模型设置管理器 ======================
const ModelSettingsManager = {
    // 初始化设置
    initSettings() {
        // 初始化设置数据
        this.settings = {
            currentProvider: 'siliconio',
            providers: {}
        };
        
        // 加载设置
        this.loadSettings();
    },
    
    // 加载设置
    loadSettings() {
        try {
            const savedSettings = localStorage.getItem('modelSettings');
            if (savedSettings) {
                this.settings = JSON.parse(savedSettings);
                Logger.info('已加载模型设置', this.settings);
            } else {
                Logger.info('未找到保存的模型设置，使用默认设置');
            }
        } catch (error) {
            Logger.error('加载模型设置失败', error);
            // 使用默认设置
            this.settings = {
                currentProvider: 'siliconio',
                providers: {}
            };
        }
    },
    
    // 保存设置
    saveSettings() {
        try {
            localStorage.setItem('modelSettings', JSON.stringify(this.settings));
            Logger.info('已保存模型设置', this.settings);
        } catch (error) {
            Logger.error('保存模型设置失败', error);
        }
    },
    
    // 获取当前服务商
    getCurrentProvider() {
        return this.settings.currentProvider || 'siliconio';
    },
    
    // 设置当前服务商
    setCurrentProvider(providerId) {
        this.settings.currentProvider = providerId;
        this.saveSettings();
    },
    
    // 获取服务商设置
    getProviderSettings(providerId) {
        if (!this.settings.providers[providerId]) {
            this.settings.providers[providerId] = {};
        }
        return this.settings.providers[providerId];
    },
    
    // 更新服务商设置
    updateProviderSettings(providerId, settings) {
        if (!this.settings.providers[providerId]) {
            this.settings.providers[providerId] = {};
        }
        
        this.settings.providers[providerId] = {
            ...this.settings.providers[providerId],
            ...settings
        };
        
        this.saveSettings();
    },
    
    // 测试API连接
    async testAPIConnection(provider, apiKey) {
        // 显示测试中通知
        const notification = NotificationManager.show(
            '正在测试连接...',
            '请稍候，正在验证API密钥',
            'info',
            30000 // 较长的超时时间，以防测试需要较长时间
        );

        try {
            // 验证API密钥不为空
            if (!apiKey || apiKey.trim() === '') {
                // 更新通知为警告
                NotificationManager.update(
                    notification,
                    '验证失败',
                    'API密钥不能为空',
                    'warning',
                    5000 // 警告显示5秒
                );
                throw ErrorHandler.createError('API密钥不能为空', 'warning');
            }

            let result;
            switch (provider) {
                case 'siliconio':
                    result = await this._testSiliconioAPI(apiKey);
                    break;
                case 'deepseek':
                    result = await this._testDeepseekAPI(apiKey);
                    break;
                case 'openai':
                    result = await this._testOpenAIAPI(apiKey);
                    break;
                case 'gemini':
                    result = await this._testGeminiAPI(apiKey);
                    break;
                default:
                    throw new Error('不支持的服务商');
            }
            
            // 更新通知为成功
            NotificationManager.update(
                notification,
                '连接成功',
                `${ModelConfig.providers[provider].name} API连接测试通过`,
                'success',
                3000 // 成功显示3秒
            );
            
            return result;
        } catch (error) {
            // 更新通知为错误
            NotificationManager.update(
                notification,
                '连接失败',
                error.error || error.message || '未知错误',
                'error',
                5000 // 错误显示5秒
            );
            
            throw error;
        }
    },

    // 测试硅基流动 API
    async _testSiliconioAPI(apiKey) {
        return new Promise(async (resolve, reject) => {
            try {
                // 记录请求信息
                Logger.info('测试硅基流动API连接', {
                    url: ModelConfig.providers.siliconio.apiUrl,
                    model: ModelConfig.providers.siliconio.defaultModel
                });
                
                // 验证API密钥
                if (!apiKey || apiKey.trim() === '') {
                    Logger.error('API密钥为空');
                    reject(ErrorHandler.createError('API密钥不能为空', 'warning'));
                    return;
                }
                
                // 清理API密钥（移除可能的空格和Bearer前缀）
                let cleanApiKey = apiKey.trim();
                if (cleanApiKey.toLowerCase().startsWith('bearer ')) {
                    cleanApiKey = cleanApiKey.substring(7).trim();
                }
                
                // 记录API密钥格式（不包含完整密钥）
                Logger.info('API密钥格式', {
                    startsWith: cleanApiKey.substring(0, 5),
                    length: cleanApiKey.length
                });
                
                // 验证API密钥格式
                if (!cleanApiKey.startsWith('sk-')) {
                    Logger.error('API密钥格式错误', { format: cleanApiKey.substring(0, 3) + '...' });
                    reject(ErrorHandler.createError('API密钥格式错误，硅基流动API密钥应以sk-开头', 'warning'));
                    return;
                }
                
                // 构建请求数据 - 严格按照硅基流动API文档格式
                const requestData = {
                    model: ModelConfig.providers.siliconio.defaultModel,
                    messages: [
                        { role: 'user', content: '你好，这是一个API连接测试' }
                    ],
                    stream: false,
                    max_tokens: 10,
                    temperature: 0.7,
                    top_p: 0.7,
                    top_k: 50,
                    frequency_penalty: 0.5,
                    n: 1,
                    response_format: {
                        type: "text"
                    }
                };
                
                // 记录请求数据
                Logger.info('请求数据', requestData);
                
                const result = await new Promise((resolveTest, rejectTest) => {
                    this._makeApiRequest({
                        url: ModelConfig.providers.siliconio.apiUrl,
                        apiKey: cleanApiKey,
                        headers: {
                            'Content-Type': 'application/json'
                        },
                        data: requestData,
                        onSuccess: (data) => {
                            Logger.info('硅基流动API连接成功', data);
                            resolveTest({
                                success: true,
                                data: data
                            });
                        },
                        onError: (error) => {
                            Logger.error('硅基流动API连接失败', error);
                            rejectTest(error);
                        }
                    });
                });

                // API测试成功后，获取模型列表
                try {
                    await this._fetchSiliconioModels(apiKey);
                } catch (modelError) {
                    Logger.warn('获取模型列表失败，但API测试已成功:', modelError);
                    // 即使获取模型列表失败，也不影响API测试的结果
                }

                resolve(result);
            } catch (error) {
                reject(error);
            }
        });
    },

    // 测试 DeepSeek API
    async _testDeepseekAPI(apiKey) {
        return new Promise((resolve, reject) => {
            // 记录请求信息
            Logger.info('测试DeepSeek API连接', {
                url: ModelConfig.providers.deepseek.apiUrl,
                model: ModelConfig.providers.deepseek.defaultModel
            });
            
            // 验证API密钥
            if (!apiKey || apiKey.trim() === '') {
                Logger.error('API密钥为空');
                reject(ErrorHandler.createError('API密钥不能为空', 'warning'));
                return;
            }
            
            // 清理API密钥（移除可能的空格和Bearer前缀）
            let cleanApiKey = apiKey.trim();
            if (cleanApiKey.toLowerCase().startsWith('bearer ')) {
                cleanApiKey = cleanApiKey.substring(7).trim();
            }
            
            // 记录API密钥格式（不包含完整密钥）
            Logger.info('API密钥格式', {
                startsWith: cleanApiKey.substring(0, 5),
                length: cleanApiKey.length
            });
            
            // 构建请求数据
            const requestData = {
                model: ModelConfig.providers.deepseek.defaultModel,
                messages: [
                    { role: 'user', content: '你好，这是一个API连接测试' }
                ],
                max_tokens: 10
            };
            
            // 记录请求数据
            Logger.info('请求数据', requestData);
            
            this._makeApiRequest({
                url: ModelConfig.providers.deepseek.apiUrl,
                apiKey: cleanApiKey, // 使用清理后的API密钥
                data: requestData,
                onSuccess: async (data) => {
                    Logger.info('DeepSeek API连接成功', data);
                    
                    // API测试成功后，获取模型列表
                    try {
                        await this._fetchDeepseekModels(apiKey);
                    } catch (modelError) {
                        Logger.warn('获取模型列表失败，但API测试已成功:', modelError);
                        // 即使获取模型列表失败，也不影响API测试的结果
                    }
                    
                    resolve({
                        success: true,
                        data: data
                    });
                },
                onError: (error) => {
                    Logger.error('DeepSeek API连接失败', error);
                    
                    // 特殊处理401错误
                    if (error.error && error.error.includes('401')) {
                        reject(ErrorHandler.createError('API密钥无效，请确保输入了正确的DeepSeek API密钥', 'error'));
                    } else if (error.details && typeof error.details === 'string' && error.details.includes('invalid')) {
                        reject(ErrorHandler.createError('API密钥无效，请检查密钥格式是否正确', 'error'));
                    } else if (error.status === 415) {
                        reject(ErrorHandler.createError('Content-Type错误，请确保API请求格式正确', 'error'));
                    } else {
                        reject(ErrorHandler.handleApiError(error, 'DeepSeek'));
                    }
                }
            });
        });
    },

    // 测试 OpenAI API
    async _testOpenAIAPI(apiKey) {
        return new Promise((resolve, reject) => {
            this._makeApiRequest({
                url: ModelConfig.providers.openai.apiUrl,
                apiKey: apiKey,
                data: {
                    model: ModelConfig.providers.openai.defaultModel,
                    messages: [
                        { role: 'user', content: '你好，这是一个API连接测试' }
                    ],
                    max_tokens: 10
                },
                onSuccess: async (data) => {
                    Logger.info('OpenAI API连接成功', data);
                    
                    // API测试成功后，获取模型列表
                    try {
                        await this._fetchOpenAIModels(apiKey);
                    } catch (modelError) {
                        Logger.warn('获取模型列表失败，但API测试已成功:', modelError);
                        // 即使获取模型列表失败，也不影响API测试的结果
                    }
                    
                    resolve({
                        success: true,
                        data: data
                    });
                },
                onError: (error) => {
                    reject(ErrorHandler.handleApiError(error, 'OpenAI'));
                }
            });
        });
    },

    // 测试 Gemini API
    async _testGeminiAPI(apiKey) {
        return new Promise((resolve, reject) => {
            const model = ModelConfig.providers.gemini.defaultModel;
            
            // 构建正确的 API URL
            const url = `${ModelConfig.providers.gemini.apiUrl}/v1/models/${model}:generateContent`;
            
            Logger.info('测试Gemini API连接', {
                url: url,
                model: model
            });
            
            this._makeApiRequest({
                url: url,
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                data: {
                    contents: [{
                        parts: [{
                            text: "你好，这是一个API连接测试"
                        }]
                    }]
                },
                params: {
                    key: apiKey
                },
                onSuccess: async (data) => {
                    Logger.info('Gemini API连接成功', data);
                    
                    // API测试成功后，获取模型列表
                    try {
                        await this._fetchGeminiModels(apiKey);
                    } catch (modelError) {
                        Logger.warn('获取模型列表失败，但API测试已成功:', modelError);
                        // 即使获取模型列表失败，也不影响API测试的结果
                    }
                    
                    resolve({
                        success: true,
                        data: data
                    });
                },
                onError: (error) => {
                    Logger.error('Gemini API连接失败', error);
                    
                    // 特殊处理 Gemini API 的错误
                    if (error.status === 404) {
                        reject(ErrorHandler.createError('API端点不存在，请确认使用了正确的 Gemini API 版本', 'error'));
                    } else if (error.status === 400) {
                        reject(ErrorHandler.createError('请求格式错误，请检查API参数', 'error'));
                    } else {
                        reject(ErrorHandler.handleApiError(error, 'Gemini'));
                    }
                }
            });
        });
    },

    // 获取硅基流动模型列表
    async _fetchSiliconioModels(apiKey) {
        return new Promise((resolve, reject) => {
            Logger.info('获取硅基流动模型列表');
            
            // 验证API密钥
            if (!apiKey || apiKey.trim() === '') {
                Logger.error('API密钥为空');
                reject(ErrorHandler.createError('API密钥不能为空', 'warning'));
                return;
            }
            
            // 清理API密钥
            let cleanApiKey = apiKey.trim();
            if (cleanApiKey.toLowerCase().startsWith('bearer ')) {
                cleanApiKey = cleanApiKey.substring(7).trim();
            }
            
            this._makeApiRequest({
                url: ModelConfig.providers.siliconio.modelsUrl,
                method: 'GET',
                apiKey: cleanApiKey,
                onSuccess: (data) => {
                    try {
                        // 处理返回的模型数据
                        if (Array.isArray(data.data)) {
                            const models = data.data
                                .filter(model => model.id) // 确保模型有ID
                                .map(model => ({
                                    id: model.id,
                                    name: model.name || model.id // 如果没有name就使用id
                                }));
                            
                            // 更新ModelConfig中的模型列表
                            ModelConfig.providers.siliconio.models = models;
                            
                            // 更新UI中的模型选择下拉框
                            const modelSelect = document.querySelector('#siliconio-model');
                            if (modelSelect) {
                                // 保存当前选中的值
                                const currentValue = modelSelect.value;
                                
                                // 清空现有选项
                                modelSelect.innerHTML = '';
                                
                                // 添加新选项
                                models.forEach(model => {
                                    const option = document.createElement('option');
                                    option.value = model.id;
                                    option.textContent = model.name;
                                    modelSelect.appendChild(option);
                                });
                                
                                // 尝试恢复之前选中的值，如果不存在则使用默认模型
                                if (models.some(m => m.id === currentValue)) {
                                    modelSelect.value = currentValue;
                                } else {
                                    modelSelect.value = ModelConfig.providers.siliconio.defaultModel;
                                }
                            }
                            
                            Logger.info('硅基流动模型列表获取成功', models);
                            resolve(models);
                        } else {
                            throw new Error('Invalid models data format');
                        }
                    } catch (error) {
                        Logger.error('处理模型列表数据失败:', error);
                        reject(ErrorHandler.createError('处理模型列表失败: ' + error.message));
                    }
                },
                onError: (error) => {
                    Logger.error('获取硅基流动模型列表失败:', error);
                    reject(ErrorHandler.handleApiError(error, '硅基流动'));
                }
            });
        });
    },

    // 获取 Gemini 模型列表
    async _fetchGeminiModels(apiKey) {
        return new Promise((resolve, reject) => {
            Logger.info('获取Gemini模型列表');
            
            // 验证API密钥
            if (!apiKey || apiKey.trim() === '') {
                Logger.error('API密钥为空');
                reject(ErrorHandler.createError('API密钥不能为空', 'warning'));
                return;
            }
            
            this._makeApiRequest({
                url: `${ModelConfig.providers.gemini.apiUrl}/v1/models`,
                method: 'GET',
                params: {
                    key: apiKey
                },
                onSuccess: (data) => {
                    try {
                        if (Array.isArray(data.models)) {
                            const models = data.models
                                .filter(model => model.name && model.name.includes('gemini-')) // 只保留 gemini 模型
                                .map(model => ({
                                    id: model.name.split('/').pop(), // 从完整路径中提取模型名称
                                    name: model.displayName || model.name.split('/').pop(),
                                    supportedGenerationMethods: model.supportedGenerationMethods || []
                                }))
                                .filter(model => model.supportedGenerationMethods.includes('generateContent')); // 只保留支持 generateContent 的模型
                            
                            // 更新ModelConfig中的模型列表
                            ModelConfig.providers.gemini.models = models;
                            
                            // 更新UI中的模型选择下拉框
                            const modelSelect = document.querySelector('#gemini-model');
                            if (modelSelect) {
                                // 保存当前选中的值
                                const currentValue = modelSelect.value;
                                
                                // 清空现有选项
                                modelSelect.innerHTML = '';
                                
                                // 添加新选项
                                models.forEach(model => {
                                    const option = document.createElement('option');
                                    option.value = model.id;
                                    option.textContent = model.name;
                                    modelSelect.appendChild(option);
                                });
                                
                                // 尝试恢复之前选中的值，如果不存在则使用默认模型
                                if (models.some(m => m.id === currentValue)) {
                                    modelSelect.value = currentValue;
                                } else {
                                    modelSelect.value = ModelConfig.providers.gemini.defaultModel;
                                }
                            }
                            
                            Logger.info('Gemini模型列表获取成功', models);
                            resolve(models);
                        } else {
                            throw new Error('Invalid models data format');
                        }
                    } catch (error) {
                        Logger.error('处理模型列表数据失败:', error);
                        reject(ErrorHandler.createError('处理模型列表失败: ' + error.message));
                    }
                },
                onError: (error) => {
                    Logger.error('获取Gemini模型列表失败:', error);
                    reject(ErrorHandler.handleApiError(error, 'Gemini'));
                }
            });
        });
    },

    // 获取 DeepSeek 模型列表
    async _fetchDeepseekModels(apiKey) {
        return new Promise((resolve, reject) => {
            Logger.info('获取DeepSeek模型列表');
            
            // 验证API密钥
            if (!apiKey || apiKey.trim() === '') {
                Logger.error('API密钥为空');
                reject(ErrorHandler.createError('API密钥不能为空', 'warning'));
                return;
            }
            
            // 清理API密钥
            let cleanApiKey = apiKey.trim();
            if (cleanApiKey.toLowerCase().startsWith('bearer ')) {
                cleanApiKey = cleanApiKey.substring(7).trim();
            }
            
            this._makeApiRequest({
                url: ModelConfig.providers.deepseek.modelsUrl,
                method: 'GET',
                apiKey: cleanApiKey,
                onSuccess: (data) => {
                    try {
                        if (Array.isArray(data.data)) {
                            const models = data.data
                                .filter(model => model.id && model.id.startsWith('deepseek-')) // 只保留 deepseek 模型
                                .map(model => ({
                                    id: model.id,
                                    name: model.name || model.id
                                }));
                            
                            // 更新ModelConfig中的模型列表
                            ModelConfig.providers.deepseek.models = models;
                            
                            // 更新UI中的模型选择下拉框
                            const modelSelect = document.querySelector('#deepseek-model');
                            if (modelSelect) {
                                // 保存当前选中的值
                                const currentValue = modelSelect.value;
                                
                                // 清空现有选项
                                modelSelect.innerHTML = '';
                                
                                // 添加新选项
                                models.forEach(model => {
                                    const option = document.createElement('option');
                                    option.value = model.id;
                                    option.textContent = model.name;
                                    modelSelect.appendChild(option);
                                });
                                
                                // 尝试恢复之前选中的值，如果不存在则使用默认模型
                                if (models.some(m => m.id === currentValue)) {
                                    modelSelect.value = currentValue;
                                } else {
                                    modelSelect.value = ModelConfig.providers.deepseek.defaultModel;
                                }
                            }
                            
                            Logger.info('DeepSeek模型列表获取成功', models);
                            resolve(models);
                        } else {
                            throw new Error('Invalid models data format');
                        }
                    } catch (error) {
                        Logger.error('处理模型列表数据失败:', error);
                        reject(ErrorHandler.createError('处理模型列表失败: ' + error.message));
                    }
                },
                onError: (error) => {
                    Logger.error('获取DeepSeek模型列表失败:', error);
                    reject(ErrorHandler.handleApiError(error, 'DeepSeek'));
                }
            });
        });
    },

    // 获取 OpenAI 模型列表
    async _fetchOpenAIModels(apiKey) {
        return new Promise((resolve, reject) => {
            Logger.info('获取OpenAI模型列表');
            
            // 验证API密钥
            if (!apiKey || apiKey.trim() === '') {
                Logger.error('API密钥为空');
                reject(ErrorHandler.createError('API密钥不能为空', 'warning'));
                return;
            }
            
            this._makeApiRequest({
                url: ModelConfig.providers.openai.modelsUrl,
                method: 'GET',
                apiKey: apiKey,
                onSuccess: (data) => {
                    try {
                        if (Array.isArray(data.data)) {
                            const models = data.data
                                .filter(model => model.id && (model.id.startsWith('gpt-4') || model.id.startsWith('gpt-3.5'))) // 只保留 GPT 模型
                                .map(model => ({
                                    id: model.id,
                                    name: model.id.toUpperCase()
                                }));
                            
                            // 更新ModelConfig中的模型列表
                            ModelConfig.providers.openai.models = models;
                            
                            // 更新UI中的模型选择下拉框
                            const modelSelect = document.querySelector('#openai-model');
                            if (modelSelect) {
                                // 保存当前选中的值
                                const currentValue = modelSelect.value;
                                
                                // 清空现有选项
                                modelSelect.innerHTML = '';
                                
                                // 添加新选项
                                models.forEach(model => {
                                    const option = document.createElement('option');
                                    option.value = model.id;
                                    option.textContent = model.name;
                                    modelSelect.appendChild(option);
                                });
                                
                                // 尝试恢复之前选中的值，如果不存在则使用默认模型
                                if (models.some(m => m.id === currentValue)) {
                                    modelSelect.value = currentValue;
                                } else {
                                    modelSelect.value = ModelConfig.providers.openai.defaultModel;
                                }
                            }
                            
                            Logger.info('OpenAI模型列表获取成功', models);
                            resolve(models);
                        } else {
                            throw new Error('Invalid models data format');
                        }
                    } catch (error) {
                        Logger.error('处理模型列表数据失败:', error);
                        reject(ErrorHandler.createError('处理模型列表失败: ' + error.message));
                    }
                },
                onError: (error) => {
                    Logger.error('获取OpenAI模型列表失败:', error);
                    reject(ErrorHandler.handleApiError(error, 'OpenAI'));
                }
            });
        });
    },

    // 通用API请求方法
    _makeApiRequest({url, method = 'POST', apiKey = null, headers = {}, data = {}, params = {}, onSuccess, onError}) {
        // 处理URL参数
        if (Object.keys(params).length > 0) {
            const queryString = Object.entries(params)
                .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`)
                .join('&');
            url = `${url}?${queryString}`;
        }

        const xhr = new XMLHttpRequest();
        const timeoutDuration = 15000; // 15秒超时
        let timeoutId;
        
        // 记录请求信息（不包含敏感信息）
        Logger.info('发送API请求', {
            url: url,
            method: method,
            hasApiKey: !!apiKey,
            headers: Object.keys(headers),
            dataKeys: Object.keys(data),
            hasParams: Object.keys(params).length > 0
        });
        
        // 设置超时
        timeoutId = setTimeout(() => {
            xhr.abort();
            Logger.error('API请求超时');
            onError(ErrorHandler.handleTimeoutError());
        }, timeoutDuration);
        
        xhr.open(method, url, true);
        
        // 设置默认的Content-Type
        xhr.setRequestHeader('Content-Type', 'application/json');
        Logger.info('设置Content-Type: application/json');
        
        // 添加其他自定义请求头
        for (const [key, value] of Object.entries(headers)) {
            if (key.toLowerCase() !== 'content-type') { // 避免重复设置Content-Type
                xhr.setRequestHeader(key, value);
                Logger.info(`设置请求头: ${key}`);
            }
        }
        
        // 处理授权头 - API要求格式为 "Bearer sk-xxxxxxxx"
        if (apiKey) {
            // 确保API密钥有Bearer前缀
            const authHeader = apiKey.startsWith('Bearer ') ? apiKey : `Bearer ${apiKey}`;
            xhr.setRequestHeader('Authorization', authHeader);
            
            // 记录授权头格式（不包含实际密钥）
            const authFormat = apiKey.startsWith('Bearer ') ? 
                'Bearer [API_KEY]' : 
                `Bearer ${apiKey.substring(0, 5)}...`;
            Logger.info('添加授权头', { format: authFormat });
        }
        
        xhr.onload = function() {
            clearTimeout(timeoutId);
            
            if (xhr.status >= 200 && xhr.status < 300) {
                try {
                    const data = JSON.parse(xhr.responseText);
                    Logger.info('API请求成功', { status: xhr.status });
                    onSuccess(data);
                } catch (error) {
                    Logger.error('解析响应失败:', error);
                    onError({ error: '解析API响应失败' });
                }
            } else {
                // 记录详细的错误信息
                Logger.error('API请求失败', { 
                    status: xhr.status, 
                    statusText: xhr.statusText,
                    response: xhr.responseText
                });
                
                let errorInfo = { 
                    error: `请求失败: ${xhr.status} ${xhr.statusText}`,
                    status: xhr.status
                };
                
                // 尝试解析错误响应
                try {
                    const responseText = xhr.responseText.trim();
                    if (responseText.startsWith('"') && responseText.endsWith('"')) {
                        // 处理字符串形式的错误消息
                        const errorMessage = JSON.parse(responseText);
                        errorInfo.details = errorMessage;
                    } else if (responseText) {
                        try {
                            const errorResponse = JSON.parse(responseText);
                            if (typeof errorResponse === 'string') {
                                // 如果响应是字符串，直接使用
                                errorInfo.details = errorResponse;
                            } else if (errorResponse.error) {
                                // 如果响应有error字段，使用它
                                errorInfo = { ...errorInfo, ...errorResponse };
                            } else {
                                // 否则，将整个响应作为details
                                errorInfo.details = errorResponse;
                            }
                        } catch (e) {
                            // 如果无法解析JSON，使用原始响应文本
                            errorInfo.details = responseText;
                        }
                    }
                } catch (e) {
                    // 如果处理过程中出错，记录错误并使用原始响应文本
                    Logger.error('处理错误响应时出错:', e);
                    errorInfo.details = xhr.responseText;
                }
                
                onError(errorInfo);
            }
        };
        
        xhr.onerror = function() {
            clearTimeout(timeoutId);
            Logger.error('网络请求错误');
            onError(ErrorHandler.handleNetworkError());
        };
        
        xhr.ontimeout = function() {
            clearTimeout(timeoutId);
            Logger.error('请求超时');
            onError(ErrorHandler.handleTimeoutError());
        };
        
        try {
            const jsonData = JSON.stringify(data);
            Logger.info('发送请求数据', { dataLength: jsonData.length });
            xhr.send(jsonData);
        } catch (error) {
            clearTimeout(timeoutId);
            Logger.error('发送请求失败:', error);
            onError({ error: '发送请求失败' });
        }
    }
};

// ====================== 4. 错误处理模块 ======================
const ErrorHandler = {
    // 创建错误对象
    createError(message, type = 'error') {
        return {
            success: false,
            error: message,
            type: type
        };
    },
    
    // 处理API错误
    handleApiError(error, provider) {
        Logger.error(`${provider} API错误:`, error);
        
        // 确保error对象存在
        if (!error) {
            return this.createError('未知错误');
        }

        // 获取错误信息
        let errorMessage = '';
        
        // 处理嵌套的错误对象
        if (error.error && error.error.message) {
            errorMessage = error.error.message;
        } else if (error.error && typeof error.error === 'string') {
            errorMessage = error.error;
        } else if (error.message) {
            errorMessage = error.message;
        } else if (typeof error === 'string') {
            errorMessage = error;
        } else {
            errorMessage = '未知错误';
        }
        
        // 根据错误类型返回友好的错误信息
        if (error.status === 404) {
            return this.createError('API端点不存在或请求格式错误，请检查API配置');
        } else if (error.status === 401 || errorMessage.includes('unauthorized')) {
            return this.createError('API密钥无效或未授权，请检查密钥是否正确');
        } else if (error.status === 403) {
            return this.createError('没有权限访问该API，请检查API密钥权限');
        } else if (error.status === 429) {
            return this.createError('请求频率超限，请稍后再试');
        } else if (error.status === 400) {
            return this.createError('请求参数错误：' + errorMessage);
        } else if (error.status >= 500) {
            return this.createError('服务器错误，请稍后重试');
        }
        
        // 针对不同服务商的特殊错误处理
        switch (provider) {
            case 'Gemini':
                if (errorMessage.includes('API_KEY_INVALID')) {
                    return this.createError('Gemini API密钥无效，请确保使用正确的API密钥');
                } else if (errorMessage.includes('PERMISSION_DENIED')) {
                    return this.createError('没有权限使用Gemini API，请检查API密钥权限');
                }
                break;
            // ... 其他服务商的特殊错误处理 ...
        }
        
        // 默认错误信息
        return this.createError(errorMessage || '请求失败，请检查网络连接和API配置');
    },
    
    // 处理网络错误
    handleNetworkError() {
        return this.createError('网络请求失败，请检查网络连接');
    },
    
    // 处理超时错误
    handleTimeoutError() {
        return this.createError('请求超时，服务器响应时间过长');
    },
    
    // 处理验证错误
    handleValidationError(message) {
        return this.createError(message, 'warning');
    }
};

// ====================== 5. 数据模块 ======================
const DataManager = {
    // 初始化设置数据
    initSettings() {
        // 默认设置
        this.settings = {
            currentProvider: null,
            providers: {}
        };
        
        // 初始化每个服务商的设置
        Object.keys(ModelConfig.providers).forEach(providerId => {
            this.settings.providers[providerId] = {
                apiKey: null,
                model: ModelConfig.providers[providerId].defaultModel
            };
        });
        
        // 加载保存的设置
        this.loadSettings();
    },
    
    // 加载设置
    loadSettings() {
        try {
            // 尝试从本地存储加载设置
            const savedSettings = localStorage.getItem(ModelConfig.storageKeys.settings);
            if (savedSettings) {
                const parsedSettings = JSON.parse(savedSettings);
                this.settings = {...this.settings, ...parsedSettings};
            }
            
            // 加载当前服务商
            const currentProvider = localStorage.getItem(ModelConfig.storageKeys.currentProvider);
            if (currentProvider) {
                this.settings.currentProvider = currentProvider;
            } else if (!this.settings.currentProvider) {
                // 默认选择第一个服务商
                this.settings.currentProvider = Object.keys(ModelConfig.providers)[0];
            }
            
            Logger.info('设置加载成功', this.settings);
        } catch (error) {
            Logger.error('加载设置失败', error);
            // 出错时使用默认设置
        }
    },
        
    // 保存设置
    saveSettings() {
        try {
            localStorage.setItem(ModelConfig.storageKeys.settings, JSON.stringify(this.settings));
            localStorage.setItem(ModelConfig.storageKeys.currentProvider, this.settings.currentProvider);
            Logger.info('设置保存成功');
            return true;
        } catch (error) {
            Logger.error('保存设置失败', error);
            return false;
        }
    },
    
    // 获取当前服务商
    getCurrentProvider() {
        return this.settings.currentProvider;
    },
    
    // 设置当前服务商
    setCurrentProvider(providerId) {
        this.settings.currentProvider = providerId;
        this.saveSettings();
    },
    
    // 获取服务商设置
    getProviderSettings(providerId) {
        return this.settings.providers[providerId] || {
            apiKey: null,
            model: ModelConfig.providers[providerId]?.defaultModel
        };
    },
    
    // 更新服务商设置
    updateProviderSettings(providerId, settings) {
        this.settings.providers[providerId] = {
            ...this.settings.providers[providerId],
            ...settings
        };
        this.saveSettings();
    }
};

// ====================== 6. API模块 ======================
const APIService = {
    // 获取硅基流动模型列表
    async _fetchSiliconioModels(apiKey) {
        return new Promise((resolve, reject) => {
            Logger.info('获取硅基流动模型列表');
            
            // 验证API密钥
            if (!apiKey || apiKey.trim() === '') {
                Logger.error('API密钥为空');
                reject(ErrorHandler.createError('API密钥不能为空', 'warning'));
                return;
            }
            
            // 清理API密钥
            let cleanApiKey = apiKey.trim();
            if (cleanApiKey.toLowerCase().startsWith('bearer ')) {
                cleanApiKey = cleanApiKey.substring(7).trim();
            }
            
            this._makeApiRequest({
                url: ModelConfig.providers.siliconio.modelsUrl,
                method: 'GET',
                apiKey: cleanApiKey,
                onSuccess: (data) => {
                    try {
                        // 处理返回的模型数据
                        if (Array.isArray(data.data)) {
                            const models = data.data
                                .filter(model => model.id) // 确保模型有ID
                                .map(model => ({
                                    id: model.id,
                                    name: model.name || model.id // 如果没有name就使用id
                                }));
                            
                            // 更新ModelConfig中的模型列表
                            ModelConfig.providers.siliconio.models = models;
                            
                            // 更新UI中的模型选择下拉框
                            const modelSelect = document.querySelector('#siliconio-model');
                            if (modelSelect) {
                                // 保存当前选中的值
                                const currentValue = modelSelect.value;
                                
                                // 清空现有选项
                                modelSelect.innerHTML = '';
                                
                                // 添加新选项
                                models.forEach(model => {
                                    const option = document.createElement('option');
                                    option.value = model.id;
                                    option.textContent = model.name;
                                    modelSelect.appendChild(option);
                                });
                                
                                // 尝试恢复之前选中的值，如果不存在则使用默认模型
                                if (models.some(m => m.id === currentValue)) {
                                    modelSelect.value = currentValue;
                                } else {
                                    modelSelect.value = ModelConfig.providers.siliconio.defaultModel;
                                }
                            }
                            
                            Logger.info('硅基流动模型列表获取成功', models);
                            resolve(models);
                        } else {
                            throw new Error('Invalid models data format');
                        }
                    } catch (error) {
                        Logger.error('处理模型列表数据失败:', error);
                        reject(ErrorHandler.createError('处理模型列表失败: ' + error.message));
                    }
                },
                onError: (error) => {
                    Logger.error('获取硅基流动模型列表失败:', error);
                    reject(ErrorHandler.handleApiError(error, '硅基流动'));
                }
            });
        });
    },

    // 测试API连接
    async testAPIConnection(provider, apiKey) {
        // 显示测试中通知
        const notification = NotificationManager.show(
            '正在测试连接...',
            '请稍候，正在验证API密钥',
            'info',
            30000 // 较长的超时时间，以防测试需要较长时间
        );

        try {
            // 验证API密钥不为空
            if (!apiKey || apiKey.trim() === '') {
                // 更新通知为警告
                NotificationManager.update(
                    notification,
                    '验证失败',
                    'API密钥不能为空',
                    'warning',
                    5000 // 警告显示5秒
                );
                throw ErrorHandler.createError('API密钥不能为空', 'warning');
            }

            let result;
            switch (provider) {
                case 'siliconio':
                    result = await this._testSiliconioAPI(apiKey);
                    break;
                case 'deepseek':
                    result = await this._testDeepseekAPI(apiKey);
                    break;
                case 'openai':
                    result = await this._testOpenAIAPI(apiKey);
                    break;
                case 'gemini':
                    result = await this._testGeminiAPI(apiKey);
                    break;
                default:
                    throw new Error('不支持的服务商');
            }

            // 更新通知为成功
            NotificationManager.update(
                notification,
                '连接成功',
                `${ModelConfig.providers[provider].name} API连接测试通过`,
                'success',
                3000 // 成功显示3秒
            );

            return result;
        } catch (error) {
            // 更新通知为错误
            NotificationManager.update(
                notification,
                '连接失败',
                error.error || error.message || '未知错误',
                'error',
                5000 // 错误显示5秒
            );

            throw error;
        }
    },

    // 测试硅基流动 API
    async _testSiliconioAPI(apiKey) {
        return new Promise(async (resolve, reject) => {
            try {
                // 记录请求信息
                Logger.info('测试硅基流动API连接', {
                    url: ModelConfig.providers.siliconio.apiUrl,
                    model: ModelConfig.providers.siliconio.defaultModel
                });
                
                // 验证API密钥
                if (!apiKey || apiKey.trim() === '') {
                    Logger.error('API密钥为空');
                    reject(ErrorHandler.createError('API密钥不能为空', 'warning'));
                    return;
                }
                
                // 清理API密钥（移除可能的空格和Bearer前缀）
                let cleanApiKey = apiKey.trim();
                if (cleanApiKey.toLowerCase().startsWith('bearer ')) {
                    cleanApiKey = cleanApiKey.substring(7).trim();
                }
                
                // 记录API密钥格式（不包含完整密钥）
                Logger.info('API密钥格式', {
                    startsWith: cleanApiKey.substring(0, 5),
                    length: cleanApiKey.length
                });
                
                // 验证API密钥格式
                if (!cleanApiKey.startsWith('sk-')) {
                    Logger.error('API密钥格式错误', { format: cleanApiKey.substring(0, 3) + '...' });
                    reject(ErrorHandler.createError('API密钥格式错误，硅基流动API密钥应以sk-开头', 'warning'));
                    return;
                }
                
                // 构建请求数据 - 严格按照硅基流动API文档格式
                const requestData = {
                    model: ModelConfig.providers.siliconio.defaultModel,
                    messages: [
                        { role: 'user', content: '你好，这是一个API连接测试' }
                    ],
                    stream: false,
                    max_tokens: 10,
                    temperature: 0.7,
                    top_p: 0.7,
                    top_k: 50,
                    frequency_penalty: 0.5,
                    n: 1,
                    response_format: {
                        type: "text"
                    }
                };
                
                // 记录请求数据
                Logger.info('请求数据', requestData);
                
                const result = await new Promise((resolveTest, rejectTest) => {
                    this._makeApiRequest({
                        url: ModelConfig.providers.siliconio.apiUrl,
                        apiKey: cleanApiKey,
                        headers: {
                            'Content-Type': 'application/json'
                        },
                        data: requestData,
                        onSuccess: (data) => {
                            Logger.info('硅基流动API连接成功', data);
                            resolveTest({
                                success: true,
                                data: data
                            });
                        },
                        onError: (error) => {
                            Logger.error('硅基流动API连接失败', error);
                            rejectTest(error);
                        }
                    });
                });

                // API测试成功后，获取模型列表
                try {
                    await this._fetchSiliconioModels(apiKey);
                } catch (modelError) {
                    Logger.warn('获取模型列表失败，但API测试已成功:', modelError);
                    // 即使获取模型列表失败，也不影响API测试的结果
                }

                resolve(result);
            } catch (error) {
                reject(error);
            }
        });
    },

    // 测试 DeepSeek API
    async _testDeepseekAPI(apiKey) {
        return new Promise((resolve, reject) => {
            // 记录请求信息
            Logger.info('测试DeepSeek API连接', {
                url: ModelConfig.providers.deepseek.apiUrl,
                model: ModelConfig.providers.deepseek.defaultModel
            });
            
            // 验证API密钥
            if (!apiKey || apiKey.trim() === '') {
                Logger.error('API密钥为空');
                reject(ErrorHandler.createError('API密钥不能为空', 'warning'));
                return;
            }
            
            // 清理API密钥（移除可能的空格和Bearer前缀）
            let cleanApiKey = apiKey.trim();
            if (cleanApiKey.toLowerCase().startsWith('bearer ')) {
                cleanApiKey = cleanApiKey.substring(7).trim();
            }
            
            // 记录API密钥格式（不包含完整密钥）
            Logger.info('API密钥格式', {
                startsWith: cleanApiKey.substring(0, 5),
                length: cleanApiKey.length
            });
            
            // 构建请求数据
            const requestData = {
                model: ModelConfig.providers.deepseek.defaultModel,
                messages: [
                    { role: 'user', content: '你好，这是一个API连接测试' }
                ],
                max_tokens: 10
            };
            
            // 记录请求数据
            Logger.info('请求数据', requestData);
            
            this._makeApiRequest({
                url: ModelConfig.providers.deepseek.apiUrl,
                apiKey: cleanApiKey, // 使用清理后的API密钥
                data: requestData,
                onSuccess: async (data) => {
                    Logger.info('DeepSeek API连接成功', data);
                    
                    // API测试成功后，获取模型列表
                    try {
                        await this._fetchDeepseekModels(apiKey);
                    } catch (modelError) {
                        Logger.warn('获取模型列表失败，但API测试已成功:', modelError);
                        // 即使获取模型列表失败，也不影响API测试的结果
                    }
                    
                    resolve({
                        success: true,
                        data: data
                    });
                },
                onError: (error) => {
                    Logger.error('DeepSeek API连接失败', error);
                    
                    // 特殊处理401错误
                    if (error.error && error.error.includes('401')) {
                        reject(ErrorHandler.createError('API密钥无效，请确保输入了正确的DeepSeek API密钥', 'error'));
                    } else if (error.details && typeof error.details === 'string' && error.details.includes('invalid')) {
                        reject(ErrorHandler.createError('API密钥无效，请检查密钥格式是否正确', 'error'));
                    } else if (error.status === 415) {
                        reject(ErrorHandler.createError('Content-Type错误，请确保API请求格式正确', 'error'));
                    } else {
                        reject(ErrorHandler.handleApiError(error, 'DeepSeek'));
                    }
                }
            });
        });
    },

    // 测试 OpenAI API
    async _testOpenAIAPI(apiKey) {
        return new Promise((resolve, reject) => {
            this._makeApiRequest({
                url: ModelConfig.providers.openai.apiUrl,
                apiKey: apiKey,
                data: {
                    model: ModelConfig.providers.openai.defaultModel,
                    messages: [
                        { role: 'user', content: '你好，这是一个API连接测试' }
                    ],
                    max_tokens: 10
                },
                onSuccess: async (data) => {
                    Logger.info('OpenAI API连接成功', data);
                    
                    // API测试成功后，获取模型列表
                    try {
                        await this._fetchOpenAIModels(apiKey);
                    } catch (modelError) {
                        Logger.warn('获取模型列表失败，但API测试已成功:', modelError);
                        // 即使获取模型列表失败，也不影响API测试的结果
                    }
                    
                    resolve({
                        success: true,
                        data: data
                    });
                },
                onError: (error) => {
                    reject(ErrorHandler.handleApiError(error, 'OpenAI'));
                }
            });
        });
    },

    // 测试 Gemini API
    async _testGeminiAPI(apiKey) {
        return new Promise((resolve, reject) => {
            const model = ModelConfig.providers.gemini.defaultModel;
            
            // 构建正确的 API URL
            const url = `${ModelConfig.providers.gemini.apiUrl}/v1/models/${model}:generateContent`;
            
            Logger.info('测试Gemini API连接', {
                url: url,
                model: model
            });
            
            this._makeApiRequest({
                url: url,
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                data: {
                    contents: [{
                        parts: [{
                            text: "你好，这是一个API连接测试"
                        }]
                    }]
                },
                params: {
                    key: apiKey
                },
                onSuccess: async (data) => {
                    Logger.info('Gemini API连接成功', data);
                    
                    // API测试成功后，获取模型列表
                    try {
                        await this._fetchGeminiModels(apiKey);
                    } catch (modelError) {
                        Logger.warn('获取模型列表失败，但API测试已成功:', modelError);
                        // 即使获取模型列表失败，也不影响API测试的结果
                    }
                    
                    resolve({
                        success: true,
                        data: data
                    });
                },
                onError: (error) => {
                    Logger.error('Gemini API连接失败', error);
                    
                    // 特殊处理 Gemini API 的错误
                    if (error.status === 404) {
                        reject(ErrorHandler.createError('API端点不存在，请确认使用了正确的 Gemini API 版本', 'error'));
                    } else if (error.status === 400) {
                        reject(ErrorHandler.createError('请求格式错误，请检查API参数', 'error'));
                    } else {
                        reject(ErrorHandler.handleApiError(error, 'Gemini'));
                    }
                }
            });
        });
    },

    // 通用API请求方法
    _makeApiRequest({url, method = 'POST', apiKey = null, headers = {}, data = {}, params = {}, onSuccess, onError}) {
        // 处理URL参数
        if (Object.keys(params).length > 0) {
            const queryString = Object.entries(params)
                .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`)
                .join('&');
            url = `${url}?${queryString}`;
        }

        const xhr = new XMLHttpRequest();
        const timeoutDuration = 15000; // 15秒超时
        let timeoutId;
        
        // 记录请求信息（不包含敏感信息）
        Logger.info('发送API请求', {
            url: url,
            method: method,
            hasApiKey: !!apiKey,
            headers: Object.keys(headers),
            dataKeys: Object.keys(data),
            hasParams: Object.keys(params).length > 0
        });
        
        // 设置超时
        timeoutId = setTimeout(() => {
            xhr.abort();
            Logger.error('API请求超时');
            onError(ErrorHandler.handleTimeoutError());
        }, timeoutDuration);
        
        xhr.open(method, url, true);
        
        // 设置默认的Content-Type
        xhr.setRequestHeader('Content-Type', 'application/json');
        Logger.info('设置Content-Type: application/json');
        
        // 添加其他自定义请求头
        for (const [key, value] of Object.entries(headers)) {
            if (key.toLowerCase() !== 'content-type') { // 避免重复设置Content-Type
                xhr.setRequestHeader(key, value);
                Logger.info(`设置请求头: ${key}`);
            }
        }
        
        // 处理授权头 - API要求格式为 "Bearer sk-xxxxxxxx"
        if (apiKey) {
            // 确保API密钥有Bearer前缀
            const authHeader = apiKey.startsWith('Bearer ') ? apiKey : `Bearer ${apiKey}`;
            xhr.setRequestHeader('Authorization', authHeader);
            
            // 记录授权头格式（不包含实际密钥）
            const authFormat = apiKey.startsWith('Bearer ') ? 
                'Bearer [API_KEY]' : 
                `Bearer ${apiKey.substring(0, 5)}...`;
            Logger.info('添加授权头', { format: authFormat });
        }
        
        xhr.onload = function() {
            clearTimeout(timeoutId);
            
            if (xhr.status >= 200 && xhr.status < 300) {
                try {
                    const data = JSON.parse(xhr.responseText);
                    Logger.info('API请求成功', { status: xhr.status });
                    onSuccess(data);
                } catch (error) {
                    Logger.error('解析响应失败:', error);
                    onError({ error: '解析API响应失败' });
                }
            } else {
                // 记录详细的错误信息
                Logger.error('API请求失败', { 
                    status: xhr.status, 
                    statusText: xhr.statusText,
                    response: xhr.responseText
                });
                
                let errorInfo = { 
                    error: `请求失败: ${xhr.status} ${xhr.statusText}`,
                    status: xhr.status
                };
                
                // 尝试解析错误响应
                try {
                    const responseText = xhr.responseText.trim();
                    if (responseText.startsWith('"') && responseText.endsWith('"')) {
                        // 处理字符串形式的错误消息
                        const errorMessage = JSON.parse(responseText);
                        errorInfo.details = errorMessage;
                    } else if (responseText) {
                        try {
                            const errorResponse = JSON.parse(responseText);
                            if (typeof errorResponse === 'string') {
                                // 如果响应是字符串，直接使用
                                errorInfo.details = errorResponse;
                            } else if (errorResponse.error) {
                                // 如果响应有error字段，使用它
                                errorInfo = { ...errorInfo, ...errorResponse };
                            } else {
                                // 否则，将整个响应作为details
                                errorInfo.details = errorResponse;
                            }
                        } catch (e) {
                            // 如果无法解析JSON，使用原始响应文本
                            errorInfo.details = responseText;
                        }
                    }
                } catch (e) {
                    // 如果处理过程中出错，记录错误并使用原始响应文本
                    Logger.error('处理错误响应时出错:', e);
                    errorInfo.details = xhr.responseText;
                }
                
                onError(errorInfo);
            }
        };
        
        xhr.onerror = function() {
            clearTimeout(timeoutId);
            Logger.error('网络请求错误');
            onError(ErrorHandler.handleNetworkError());
        };
        
        xhr.ontimeout = function() {
            clearTimeout(timeoutId);
            Logger.error('请求超时');
            onError(ErrorHandler.handleTimeoutError());
        };
        
        try {
            const jsonData = JSON.stringify(data);
            Logger.info('发送请求数据', { dataLength: jsonData.length });
            xhr.send(jsonData);
        } catch (error) {
            clearTimeout(timeoutId);
            Logger.error('发送请求失败:', error);
            onError({ error: '发送请求失败' });
        }
    }
};

// ====================== 7. UI模块 ======================
const UIController = {
    // 初始化UI
    initUI() {
        this.bindTabEvents();
        this.bindPasswordToggle();
        this.bindButtonEvents();
        this.updateUIFromSettings();
    },
    
    // 绑定标签页事件
    bindTabEvents() {
        Logger.info('绑定标签页事件');
        
        // 获取所有标签页元素
        const tabs = document.querySelectorAll('.model-tab');
        Logger.info(`找到 ${tabs.length} 个标签页元素`);
        
        // 为每个标签页添加点击事件
        tabs.forEach((tab, index) => {
            const provider = tab.getAttribute('data-provider');
            Logger.info(`为标签页 ${index + 1} 绑定事件: ${provider}`);
            
            // 移除可能存在的旧事件处理器
            tab.removeEventListener('click', tab._clickHandler);
            
            // 创建新的事件处理器
            tab._clickHandler = (event) => {
                // 阻止默认行为
                event.preventDefault();
                event.stopPropagation();
                
                // 记录点击事件
                Logger.info(`标签页点击: ${provider}`);
                console.log(`标签页点击: ${provider}`);
                
                // 切换到对应的服务商
                this.switchProvider(provider);
                
                return false;
            };
            
            // 添加事件监听器
            tab.addEventListener('click', tab._clickHandler);
        });
    },
    
    // 绑定密码显示/隐藏切换
    bindPasswordToggle() {
        document.querySelectorAll('.toggle-password').forEach(button => {
            button.addEventListener('click', () => {
                const input = button.parentElement.querySelector('input');
                if (input.type === 'password') {
                    input.type = 'text';
                    button.querySelector('i').classList.add('visible');
                } else {
                    input.type = 'password';
                    button.querySelector('i').classList.remove('visible');
                }
            });
        });
    },
    
    // 绑定按钮事件
    bindButtonEvents() {
        // 测试连接按钮
        document.querySelectorAll('.test-model-btn').forEach(button => {
            button.addEventListener('click', async () => {
                const provider = button.getAttribute('data-provider');
                const apiKeyInput = document.querySelector(`#${provider}-api-key`);
                
                if (!apiKeyInput || !apiKeyInput.value.trim()) {
                    NotificationManager.show('验证失败', 'API密钥不能为空', 'warning');
                    return;
                }
                
                try {
                    // 禁用按钮并更改文本
                    button.disabled = true;
                    const originalText = button.textContent;
                    button.textContent = '测试中...';
                    
                    // 测试连接 - APIService.testAPIConnection内部会处理通知
                    await APIService.testAPIConnection(provider, apiKeyInput.value.trim());
                    
                    // 测试成功后，延迟恢复按钮状态，让用户有时间看到成功通知
                    setTimeout(() => {
                        button.textContent = originalText;
                        button.disabled = false;
                    }, 1500);
                } catch (error) {
                    // 测试失败时，立即恢复按钮状态
                    button.textContent = '测试连接';
                    button.disabled = false;
                    // 错误已经在APIService.testAPIConnection中处理，这里不需要额外处理
                }
            });
        });
        
        // 保存设置按钮
        document.querySelectorAll('.save-model-btn').forEach(button => {
            button.addEventListener('click', () => {
                const provider = button.getAttribute('data-provider');
                this.saveProviderSettings(provider);
            });
        });
    },
    
    // 切换服务商
    switchProvider(provider) {
        Logger.info('开始切换服务商:', provider);
        console.log('开始切换服务商:', provider);
        
        try {
            // 验证参数
            if (!provider || !ModelConfig.providers[provider]) {
                throw new Error(`无效的服务商ID: ${provider}`);
            }
            
            // 更新标签页
            const tabs = document.querySelectorAll('.model-tab');
            Logger.info(`找到 ${tabs.length} 个标签页元素`);
            
            let activeTabFound = false;
            tabs.forEach(tab => {
                const tabProvider = tab.getAttribute('data-provider');
                if (tabProvider === provider) {
                    tab.classList.add('active');
                    activeTabFound = true;
                    Logger.info(`激活标签页: ${tabProvider}`);
                } else {
                    tab.classList.remove('active');
                }
            });
            
            if (!activeTabFound) {
                Logger.warn(`未找到匹配的标签页: ${provider}`);
            }
            
            // 更新内容区域
            const contents = document.querySelectorAll('.model-tab-content');
            Logger.info(`找到 ${contents.length} 个内容区域元素`);
            
            let activeContentFound = false;
            contents.forEach(content => {
                if (content.id === `${provider}-content`) {
                    content.classList.add('active');
                    activeContentFound = true;
                    Logger.info(`激活内容区域: ${content.id}`);
                } else {
                    content.classList.remove('active');
                }
            });
            
            if (!activeContentFound) {
                Logger.warn(`未找到匹配的内容区域: ${provider}-content`);
            }
            
            // 更新当前服务商
            DataManager.setCurrentProvider(provider);
            
            // 更新所有服务商的已选状态
            this.updateSelectedBadges();
            
            Logger.info('服务商切换成功:', provider);
            console.log('服务商切换成功:', provider);
        } catch (error) {
            Logger.error('切换服务商失败:', error);
            console.error('切换服务商失败:', error);
            NotificationManager.show('切换失败', `切换服务商时发生错误: ${error.message}`, 'error');
        }
    },
    
    // 更新已选标记
    updateSelectedBadges() {
        const currentProvider = DataManager.getCurrentProvider();
        
        Object.keys(ModelConfig.providers).forEach(provider => {
            const settings = DataManager.getProviderSettings(provider);
            const isSelected = currentProvider === provider && settings.apiKey;
            const tab = document.querySelector(`.model-tab[data-provider="${provider}"]`);
            const badge = tab?.querySelector('.selected-badge');
            
            if (badge) {
                badge.style.display = isSelected ? 'inline-block' : 'none';
            }
            
            // 添加或移除selected类，以匹配CSS选择器
            if (tab) {
                if (isSelected) {
                    tab.classList.add('selected');
                } else {
                    tab.classList.remove('selected');
                }
            }
        });
    },
    
    // 保存服务商设置
    saveProviderSettings(provider) {
        const apiKeyInput = document.querySelector(`#${provider}-api-key`);
        const modelSelect = document.querySelector(`#${provider}-model`);
        
        if (!apiKeyInput || !apiKeyInput.value.trim()) {
            NotificationManager.show('保存失败', 'API密钥不能为空', 'warning');
            return;
        }
        
        // 更新设置
        DataManager.updateProviderSettings(provider, {
            apiKey: apiKeyInput.value.trim(),
            model: modelSelect ? modelSelect.value : ModelConfig.providers[provider].defaultModel
        });
        
        // 更新UI
        this.updateSelectedBadges();
        
        // 显示成功通知
        NotificationManager.show('保存成功', `${ModelConfig.providers[provider].name}设置已保存`, 'success');
    },
    
    // 从设置更新UI
    updateUIFromSettings() {
        Logger.info('从设置更新UI');

        // 获取当前服务商
        const currentProvider = DataManager.getCurrentProvider();
        
        // 切换到当前服务商
        if (currentProvider) {
            this.switchProvider(currentProvider);
        }
        
        // 更新所有服务商的设置
        Object.keys(ModelConfig.providers).forEach(provider => {
            const settings = DataManager.getProviderSettings(provider);
            
            // 更新API Key输入框
            const apiKeyInput = document.querySelector(`#${provider}-api-key`);
            if (apiKeyInput && settings.apiKey) {
                apiKeyInput.value = settings.apiKey;
            }
            
            // 更新模型选择
            const modelSelect = document.querySelector(`#${provider}-model`);
            if (modelSelect && settings.model) {
                modelSelect.value = settings.model;
            }
        });
        
        // 更新已选标记
        this.updateSelectedBadges();
    }
};

// ====================== 8. 初始化函数 ======================
function initialize() {
    console.log('开始初始化模型设置页面');
    
    try {
        // 初始化设置数据
        DataManager.initSettings();
        
        // 初始化UI
        UIController.initUI();
        
        // 尝试获取硅基流动模型列表（如果有保存的API密钥）
        const siliconioSettings = DataManager.getProviderSettings('siliconio');
        if (siliconioSettings && siliconioSettings.apiKey) {
            APIService._fetchSiliconioModels(siliconioSettings.apiKey).catch(error => {
                Logger.warn('初始化时获取模型列表失败:', error);
                // 失败时不影响其他功能
                NotificationManager.show(
                    '模型列表获取失败',
                    '获取硅基流动模型列表失败，将使用默认模型列表',
                    'warning',
                    5000
                );
            });
        }
        
        // 额外添加直接的事件绑定，以确保标签页点击事件能够正常工作
        document.querySelectorAll('.model-tab').forEach(tab => {
            console.log('为标签页绑定直接点击事件:', tab.getAttribute('data-provider'));
            
            // 移除可能存在的旧事件处理器
            if (tab._clickHandler) {
                tab.removeEventListener('click', tab._clickHandler);
            }
            
            // 使用直接的onclick属性
            tab.onclick = function(event) {
                event.preventDefault();
                const provider = this.getAttribute('data-provider');
                console.log('标签页直接点击事件触发:', provider);
                UIController.switchProvider(provider);
                return false;
            };
        });
        
        // 日志记录
        Logger.info('模型设置页面初始化完成');
        console.log('模型设置页面初始化完成');
    } catch (error) {
        console.error('模型设置页面初始化失败:', error);
        NotificationManager.show(
            '初始化失败',
            '模型设置页面初始化失败: ' + error.message,
            'error',
            5000
        );
    }
}

// 页面加载完成后初始化
document.addEventListener('DOMContentLoaded', function() {
    console.log('模型设置页面DOM加载完成，准备初始化');
    // 检查是否已经初始化过
    if (!window._modelSettingsInitialized) {
        window._modelSettingsInitialized = true;
        initialize();
    }
});

// 导出对象到全局作用域
window.APIService = APIService;
window.ModelConfig = ModelConfig;
window.UIController = UIController;
window.initialize = initialize;

// 添加调试辅助函数
window.switchToProvider = function(provider) {
    console.log('手动切换到服务商:', provider);
    UIController.switchProvider(provider);
    return '已尝试切换到 ' + provider;
};