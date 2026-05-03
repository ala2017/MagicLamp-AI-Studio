// AI Service - 通过 VS Code Extension 后端调用 API

declare const vscode: any;

export interface AICallOptions {
    model?: string;
    temperature?: number;
    maxTokens?: number;
    timeoutMs?: number;
}

// 存储待处理的请求回调
const pendingRequests: Map<string, { resolve: (value: string) => void; reject: (error: Error) => void }> = new Map();

// 监听来自 extension 的消息
if (typeof window !== 'undefined') {
    window.addEventListener('message', (event) => {
        const message = event.data;
        if (message.type === 'aiResponse' && message.requestId) {
            const pending = pendingRequests.get(message.requestId);
            if (pending) {
                if (message.error) {
                    pending.reject(new Error(message.error));
                } else {
                    pending.resolve(message.result);
                }
                pendingRequests.delete(message.requestId);
            }
        }
        if (message.type === 'genAiResponse' && message.requestId) {
            const pending = pendingRequests.get(message.requestId);
            if (pending) {
                if (message.error) {
                    pending.reject(new Error(message.error));
                } else {
                    pending.resolve(message.result);
                }
                pendingRequests.delete(message.requestId);
            }
        }
    });
}

/**
 * Call NVIDIA NIM Chat API via Extension
 */
export async function callNvidiaChat(
    systemPrompt: string,
    userMessage: string,
    options: AICallOptions = {}
): Promise<string> {
    const requestId = `chat_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    return new Promise((resolve, reject) => {
        // 设置超时
        const timeoutId = setTimeout(() => {
            pendingRequests.delete(requestId);
            reject(new Error('API 请求超时'));
        }, options.timeoutMs || 180000);

        pendingRequests.set(requestId, {
            resolve: (result) => {
                clearTimeout(timeoutId);
                resolve(result);
            },
            reject: (error) => {
                clearTimeout(timeoutId);
                reject(error);
            }
        });

        // 发送消息给 extension
        if (typeof vscode !== 'undefined') {
            vscode.postMessage({
                type: 'callNvidiaChat',
                requestId,
                systemPrompt,
                userMessage,
                options
            });
        } else {
            pendingRequests.delete(requestId);
            clearTimeout(timeoutId);
            reject(new Error('VS Code API not available'));
        }
    });
}

/**
 * Call NVIDIA NIM GenAI API (Flux for images) via Extension
 */
export async function callNvidiaGenAI(
    endpoint: string,
    payload: any,
    timeoutMs = 300000
): Promise<any> {
    const requestId = `genai_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    return new Promise((resolve, reject) => {
        const timeoutId = setTimeout(() => {
            pendingRequests.delete(requestId);
            reject(new Error('图像生成超时'));
        }, timeoutMs);

        pendingRequests.set(requestId, {
            resolve: (result) => {
                clearTimeout(timeoutId);
                resolve(result);
            },
            reject: (error) => {
                clearTimeout(timeoutId);
                reject(error);
            }
        });

        if (typeof vscode !== 'undefined') {
            vscode.postMessage({
                type: 'callNvidiaGenAI',
                requestId,
                endpoint,
                payload
            });
        } else {
            pendingRequests.delete(requestId);
            clearTimeout(timeoutId);
            reject(new Error('VS Code API not available'));
        }
    });
}
