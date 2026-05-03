import * as vscode from 'vscode';
import { GeminiService } from './services/GeminiService';
import { SunoApiClient } from './services/SunoApiClient';
import axios from 'axios';
import * as path from 'path';
import * as fs from 'fs';
import { spawn, ChildProcess } from 'child_process';

const NVIDIA_API_KEY = "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";

let currentPanel: vscode.WebviewPanel | undefined = undefined;
let sunoProcess: ChildProcess | null = null;

// 侧边栏 Provider - 显示快速启动按钮
class SidebarProvider implements vscode.WebviewViewProvider {
    constructor(private readonly extensionUri: vscode.Uri) {}

    resolveWebviewView(webviewView: vscode.WebviewView) {
        webviewView.webview.options = { enableScripts: true };
        webviewView.webview.html = `
            <!DOCTYPE html>
            <html>
            <head>
                <style>
                    body { 
                        padding: 16px; 
                        font-family: var(--vscode-font-family);
                        color: var(--vscode-foreground);
                    }
                    .btn {
                        width: 100%;
                        padding: 12px;
                        background: var(--vscode-button-background);
                        color: var(--vscode-button-foreground);
                        border: none;
                        border-radius: 6px;
                        cursor: pointer;
                        font-size: 13px;
                        font-weight: 500;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        gap: 8px;
                    }
                    .btn:hover { background: var(--vscode-button-hoverBackground); }
                    .title { 
                        font-size: 11px; 
                        color: var(--vscode-descriptionForeground);
                        margin-bottom: 12px;
                        text-align: center;
                    }
                </style>
            </head>
            <body>
                <p class="title">🪔 神灯音乐工作台</p>
                <button class="btn" onclick="openStudio()">
                    <span>🎵</span> 打开工作台
                </button>
                <script>
                    const vscode = acquireVsCodeApi();
                    function openStudio() {
                        vscode.postMessage({ command: 'openStudio' });
                    }
                </script>
            </body>
            </html>
        `;
        
        webviewView.webview.onDidReceiveMessage(message => {
            if (message.command === 'openStudio') {
                vscode.commands.executeCommand('magiclampmusic.start');
            }
        });
    }
}

// Suno API Private 管理
class SunoServiceManager {
    private context: vscode.ExtensionContext;
    private sunoDir: string;

    constructor(context: vscode.ExtensionContext) {
        this.context = context;
        this.sunoDir = path.join(context.globalStorageUri.fsPath, 'suno-api-private');
    }

    async ensureInstalled(): Promise<boolean> {
        // 确保目录存在
        const storageDir = this.context.globalStorageUri.fsPath;
        if (!fs.existsSync(storageDir)) {
            fs.mkdirSync(storageDir, { recursive: true });
        }

        // 检查是否已安装
        if (fs.existsSync(path.join(this.sunoDir, 'package.json'))) {
            return true;
        }

        // 克隆项目
        const result = await vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: '正在安装 Suno API 服务...',
            cancellable: false
        }, async (progress) => {
            try {
                progress.report({ message: '克隆项目...' });
                await this.execCommand(`git clone https://github.com/joeseesun/suno-api-private "${this.sunoDir}"`);
                
                progress.report({ message: '安装依赖...' });
                await this.execCommand('npm install', this.sunoDir);
                
                return true;
            } catch (e: any) {
                vscode.window.showErrorMessage('安装 Suno API 失败: ' + e.message);
                return false;
            }
        });

        return result;
    }

    async isRunning(): Promise<boolean> {
        try {
            await axios.get('http://localhost:3001/api/get_limit', { timeout: 2000 });
            return true;
        } catch {
            return false;
        }
    }

    async start(): Promise<boolean> {
        if (await this.isRunning()) {
            return true;
        }

        // 检查是否配置了 Token
        const envPath = path.join(this.sunoDir, '.env');
        if (!fs.existsSync(envPath)) {
            return false; // 需要先配置 Token
        }

        return new Promise((resolve) => {
            sunoProcess = spawn('npm', ['start'], {
                cwd: this.sunoDir,
                shell: true,
                detached: false,
                stdio: 'pipe'
            });

            let started = false;
            const timeout = setTimeout(() => {
                if (!started) resolve(false);
            }, 15000);

            sunoProcess.stdout?.on('data', (data) => {
                const output = data.toString();
                console.log('[Suno]', output);
                if (output.includes('3001') || output.includes('started')) {
                    started = true;
                    clearTimeout(timeout);
                    resolve(true);
                }
            });

            sunoProcess.stderr?.on('data', (data) => {
                console.error('[Suno Error]', data.toString());
            });

            sunoProcess.on('error', () => {
                clearTimeout(timeout);
                resolve(false);
            });
        });
    }

    async configureToken(cookie: string, jwtToken: string): Promise<boolean> {
        try {
            const envContent = `SUNO_COOKIE=${cookie}\nSUNO_JWT_TOKEN=${jwtToken}\n`;
            const envPath = path.join(this.sunoDir, '.env');
            fs.writeFileSync(envPath, envContent);
            return true;
        } catch {
            return false;
        }
    }

    hasToken(): boolean {
        const envPath = path.join(this.sunoDir, '.env');
        return fs.existsSync(envPath);
    }

    private execCommand(cmd: string, cwd?: string): Promise<void> {
        return new Promise((resolve, reject) => {
            const proc = spawn(cmd, [], { shell: true, cwd });
            proc.on('close', (code) => {
                if (code === 0) resolve();
                else reject(new Error(`Command failed with code ${code}`));
            });
            proc.on('error', reject);
        });
    }
}

export function activate(context: vscode.ExtensionContext) {
    const geminiService = new GeminiService(context);
    const sunoApiClient = new SunoApiClient(context);
    const sunoManager = new SunoServiceManager(context);

    // 自动初始化 Suno 服务
    initSunoService(sunoManager);

    // 注册侧边栏 Webview（用于显示图标和快速启动）
    const sidebarProvider = new SidebarProvider(context.extensionUri);
    context.subscriptions.push(
        vscode.window.registerWebviewViewProvider('magiclampmusic.sidebar', sidebarProvider)
    );

    // 主命令：打开全屏工作台
    context.subscriptions.push(
        vscode.commands.registerCommand('magiclampmusic.start', () => {
            if (currentPanel) {
                currentPanel.reveal(vscode.ViewColumn.One);
                return;
            }
            
            currentPanel = vscode.window.createWebviewPanel(
                'magiclampmusic.studio',
                '🪔 神灯音乐工作台',
                vscode.ViewColumn.One,
                {
                    enableScripts: true,
                    retainContextWhenHidden: true,
                    localResourceRoots: [context.extensionUri]
                }
            );

            currentPanel.webview.html = getWebviewContent(currentPanel.webview, context.extensionUri);

            currentPanel.webview.onDidReceiveMessage(
                async (data) => {
                    await handleWebviewMessage(data, currentPanel!.webview, geminiService, sunoApiClient, sunoManager);
                },
                undefined,
                context.subscriptions
            );

            currentPanel.onDidDispose(
                () => { 
                    currentPanel = undefined;
                    // 如果在 Zen Mode 中关闭 panel，自动退出 Zen Mode
                    vscode.commands.executeCommand('workbench.action.exitZenMode');
                },
                undefined,
                context.subscriptions
            );
        })
    );

    // 设置 Gemini API Key
    context.subscriptions.push(
        vscode.commands.registerCommand('magiclampmusic.setApiKey', async () => {
            const key = await vscode.window.showInputBox({
                title: 'Set Gemini API Key',
                prompt: 'Enter your Google Gemini API Key.',
                ignoreFocusOut: true,
                password: true
            });
            if (key) {
                await geminiService.setApiKey(key);
                vscode.window.showInformationMessage('Gemini API Key saved!');
            }
        })
    );

    // 激活时自动打开
    vscode.commands.executeCommand('magiclampmusic.start');
}

async function initSunoService(manager: SunoServiceManager) {
    const installed = await manager.ensureInstalled();
    if (!installed) return;

    if (!manager.hasToken()) {
        // 提示用户配置 Token
        const action = await vscode.window.showInformationMessage(
            '首次使用需要配置 Suno Token',
            '配置 Token'
        );
        if (action === '配置 Token') {
            vscode.commands.executeCommand('magiclampmusic.configureSunoToken');
        }
        return;
    }

    // 自动启动服务
    const started = await manager.start();
    if (started) {
        vscode.window.showInformationMessage('🎵 Suno 服务已启动');
    }
}

async function handleWebviewMessage(
    data: any,
    webview: vscode.Webview,
    geminiService: GeminiService,
    sunoApiClient: SunoApiClient,
    sunoManager: SunoServiceManager
) {
    switch (data.type) {
        case 'onInfo':
            vscode.window.showInformationMessage(data.value);
            break;
        case 'onError':
            vscode.window.showErrorMessage(data.value);
            break;
        case 'toggleZenMode':
            vscode.commands.executeCommand('workbench.action.toggleZenMode');
            // 关闭 Zen Mode 的居中布局
            vscode.commands.executeCommand('workbench.action.toggleCenteredLayout');
            break;

        case 'optimizeLyrics': {
            try {
                let isKeySet = await geminiService.checkApiKey();
                if (!isKeySet) {
                    const key = await vscode.window.showInputBox({
                        title: 'Set Gemini API Key',
                        prompt: 'Enter your Google Gemini API Key.',
                        ignoreFocusOut: true,
                        password: true
                    });
                    if (key) {
                        await geminiService.setApiKey(key);
                    } else {
                        webview.postMessage({ type: 'lyricsOptimized', value: '' });
                        return;
                    }
                }
                const result = await geminiService.optimizeLyrics(data.original, data.prompt);
                webview.postMessage({ type: 'lyricsOptimized', value: result });
            } catch (e: any) {
                vscode.window.showErrorMessage("Error: " + e.message);
                webview.postMessage({ type: 'lyricsOptimized', value: '' });
            }
            break;
        }

        case 'generateStyle': {
            try {
                let isKeySet = await geminiService.checkApiKey();
                if (!isKeySet) {
                    const key = await vscode.window.showInputBox({
                        title: 'Set Gemini API Key',
                        prompt: 'Enter API Key for Style Generation.',
                        ignoreFocusOut: true,
                        password: true
                    });
                    if (key) {
                        await geminiService.setApiKey(key);
                    } else {
                        webview.postMessage({ type: 'styleGenerated', value: '' });
                        return;
                    }
                }
                const result = await geminiService.generateStylePrompt(data.tags, data.description);
                webview.postMessage({ type: 'styleGenerated', value: result });
            } catch (e: any) {
                vscode.window.showErrorMessage(e.message);
                webview.postMessage({ type: 'styleGenerated', value: '' });
            }
            break;
        }

        case 'generateMusic': {
            try {
                const { prompt, isInstrumental } = data;
                if (!prompt) {
                    vscode.window.showErrorMessage("Music prompt is empty!");
                    return;
                }
                const result = await sunoApiClient.generate(prompt, isInstrumental);
                webview.postMessage({ type: 'musicGenerated', value: result });
            } catch (e: any) {
                vscode.window.showErrorMessage("Suno Error: " + e.message);
                webview.postMessage({ type: 'musicGenerated', value: null });
            }
            break;
        }

        case 'generateAudio': {
            try {
                const { prompt, tags, title, makeInstrumental, model } = data.payload;
                if (!prompt) {
                    webview.postMessage({ command: 'error', data: { message: '歌词不能为空' } });
                    return;
                }
                const result = await sunoApiClient.generate(
                    prompt,
                    makeInstrumental,
                    tags,
                    title,
                    model || 'chirp-crow'
                );
                const generations = result.clips?.map((clip: any) => ({
                    id: clip.id,
                    title: clip.title || title,
                    audioUrl: clip.audio_url,
                    imageUrl: clip.image_url,
                    status: clip.status || 'queued',
                    liked: false,
                    createdAt: Date.now(),
                    model: model
                })) || [];
                webview.postMessage({ command: 'audioGenerated', data: generations });
            } catch (e: any) {
                webview.postMessage({ command: 'error', data: { message: e.message } });
            }
            break;
        }

        case 'checkSunoService': {
            // 检测 suno-api-private 服务是否运行
            try {
                const baseUrl = vscode.workspace.getConfiguration('magiclampmusic').get<string>('sunoBaseUrl') || 'http://localhost:3001';
                await axios.get(`${baseUrl}/api/get_limit`, { timeout: 3000 });
                webview.postMessage({ command: 'sunoServiceStatus', data: { connected: true, hasToken: sunoManager.hasToken() } });
            } catch (e) {
                webview.postMessage({ command: 'sunoServiceStatus', data: { connected: false, hasToken: sunoManager.hasToken() } });
            }
            break;
        }

        case 'configureSunoToken': {
            // 打开配置 Token 的流程
            const cookie = await vscode.window.showInputBox({
                title: '配置 Suno Token (步骤 1/2)',
                prompt: '粘贴从浏览器复制的 Cookie（访问 suno.com → F12 → Network → 找到请求 → 复制 Cookie 值）',
                ignoreFocusOut: true,
                placeHolder: '__client=xxx; __session=xxx; ...'
            });
            if (!cookie) {
                webview.postMessage({ command: 'tokenConfigured', data: { success: false } });
                return;
            }

            const jwtToken = await vscode.window.showInputBox({
                title: '配置 Suno Token (步骤 2/2)',
                prompt: '粘贴 Authorization Header 中的 JWT Token（Bearer 后面的部分）',
                ignoreFocusOut: true,
                placeHolder: 'eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9...'
            });
            if (!jwtToken) {
                webview.postMessage({ command: 'tokenConfigured', data: { success: false } });
                return;
            }

            const success = await sunoManager.configureToken(cookie, jwtToken);
            if (success) {
                vscode.window.showInformationMessage('Token 配置成功！正在启动服务...');
                const started = await sunoManager.start();
                webview.postMessage({ command: 'tokenConfigured', data: { success: true, started } });
                if (started) {
                    webview.postMessage({ command: 'sunoServiceStatus', data: { connected: true, hasToken: true } });
                }
            } else {
                vscode.window.showErrorMessage('Token 配置失败');
                webview.postMessage({ command: 'tokenConfigured', data: { success: false } });
            }
            break;
        }

        case 'startSunoService': {
            const started = await sunoManager.start();
            if (started) {
                webview.postMessage({ command: 'sunoServiceStatus', data: { connected: true, hasToken: true } });
            } else {
                webview.postMessage({ command: 'sunoServiceStatus', data: { connected: false, hasToken: sunoManager.hasToken() } });
            }
            break;
        }

        // NVIDIA Chat API 调用
        case 'callNvidiaChat': {
            try {
                const { requestId, systemPrompt, userMessage, options } = data;
                const response = await axios.post(
                    'https://integrate.api.nvidia.com/v1/chat/completions',
                    {
                        model: options?.model || 'meta/llama-3.1-70b-instruct',
                        messages: [
                            { role: 'system', content: systemPrompt },
                            { role: 'user', content: userMessage }
                        ],
                        temperature: options?.temperature ?? 0.7,
                        max_tokens: options?.maxTokens ?? 2048,
                        stream: false
                    },
                    {
                        headers: {
                            'Content-Type': 'application/json',
                            'Authorization': `Bearer ${NVIDIA_API_KEY}`,
                            'Accept': 'application/json'
                        },
                        timeout: options?.timeoutMs || 180000
                    }
                );
                const result = response.data.choices?.[0]?.message?.content || '';
                webview.postMessage({ type: 'aiResponse', requestId, result });
            } catch (e: any) {
                webview.postMessage({ type: 'aiResponse', requestId: data.requestId, error: e.message });
            }
            break;
        }

        // NVIDIA GenAI API 调用 (图像生成)
        case 'callNvidiaGenAI': {
            try {
                const { requestId, endpoint, payload } = data;
                const response = await axios.post(
                    `https://ai.api.nvidia.com/v1/genai/${endpoint}`,
                    payload,
                    {
                        headers: {
                            'Content-Type': 'application/json',
                            'Authorization': `Bearer ${NVIDIA_API_KEY}`,
                            'Accept': 'application/json'
                        },
                        timeout: 300000
                    }
                );
                webview.postMessage({ type: 'genAiResponse', requestId, result: response.data });
            } catch (e: any) {
                webview.postMessage({ type: 'genAiResponse', requestId: data.requestId, error: e.message });
            }
            break;
        }
    }
}

function getWebviewContent(webview: vscode.Webview, extensionUri: vscode.Uri): string {
    const scriptUri = webview.asWebviewUri(vscode.Uri.joinPath(extensionUri, 'dist', 'webview', 'assets', 'index.js'));
    const styleUri = webview.asWebviewUri(vscode.Uri.joinPath(extensionUri, 'dist', 'webview', 'assets', 'index.css'));
    const nonce = getNonce();

    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource} 'unsafe-inline'; script-src 'nonce-${nonce}'; img-src ${webview.cspSource} https: data:; connect-src https:;">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <link href="${styleUri}" rel="stylesheet">
    <title>Magic Lamp Studio</title>
</head>
<body class="bg-background text-textMain">
    <div id="root"></div>
    <script nonce="${nonce}" type="module" src="${scriptUri}"></script>
</body>
</html>`;
}

function getNonce() {
    let text = '';
    const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    for (let i = 0; i < 32; i++) {
        text += possible.charAt(Math.floor(Math.random() * possible.length));
    }
    return text;
}

export function deactivate() {
    if (currentPanel) { currentPanel.dispose(); }
    // 关闭 Suno 服务
    if (sunoProcess) {
        sunoProcess.kill();
        sunoProcess = null;
    }
}
