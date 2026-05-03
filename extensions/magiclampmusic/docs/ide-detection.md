# AI IDE 环境检测与能力适配方案

> **目的**：让神灯音乐工作台在不同 IDE 环境中提供最佳体验  
> **策略**：优先使用 IDE 内置能力，降级到用户配置  

---

## 1. 支持的 IDE 环境

### 1.1 优先级

| 优先级 | IDE | 体验 | 内置能力 |
|--------|-----|------|----------|
| P0 | Antigravity | ⭐⭐⭐ 最佳 | Gemini API, Python |
| P1 | Cursor | ⭐⭐ 良好 | AI Completion |
| P2 | Windsurf | ⭐⭐ 良好 | AI Completion |
| P3 | VS Code | ⭐ 基础 | 无（需用户配置） |

### 1.2 功能支持矩阵

| 功能 | Antigravity | Cursor | Windsurf | VS Code |
|------|-------------|--------|----------|---------|
| 歌词润色 | ✅ 内置 Gemini | ⚠️ 需配置 | ⚠️ 需配置 | ⚠️ 需配置 |
| 风格生成 | ✅ 内置 Gemini | ⚠️ 需配置 | ⚠️ 需配置 | ⚠️ 需配置 |
| 封面生成 | ✅ 内置 Gemini | ⚠️ 需配置 | ⚠️ 需配置 | ⚠️ 需配置 |
| 音乐生成 | ✅ 本地服务 | ✅ 本地服务 | ✅ 本地服务 | ✅ 本地服务 |
| 母带处理 | ✅ 内置 Python | ✅ 内置 Python | ⚠️ 需检测 | ⚠️ 需安装 |

---

## 2. 环境检测实现

### 2.1 检测 IDE 类型

```typescript
// src/utils/ideDetector.ts

export type IDEType = 'antigravity' | 'cursor' | 'windsurf' | 'vscode';

export interface IDECapabilities {
  type: IDEType;
  hasBuiltinAI: boolean;
  hasBuiltinGemini: boolean;
  hasPython: boolean;
  displayName: string;
}

export function detectIDE(): IDECapabilities {
  const appName = vscode.env.appName.toLowerCase();
  const appRoot = vscode.env.appRoot.toLowerCase();
  
  // 检测 Antigravity
  if (appName.includes('antigravity') || appRoot.includes('antigravity')) {
    return {
      type: 'antigravity',
      hasBuiltinAI: true,
      hasBuiltinGemini: true,
      hasPython: true,
      displayName: 'Antigravity'
    };
  }
  
  // 检测 Cursor
  if (appName.includes('cursor') || appRoot.includes('cursor')) {
    return {
      type: 'cursor',
      hasBuiltinAI: true,
      hasBuiltinGemini: false,
      hasPython: true,
      displayName: 'Cursor'
    };
  }
  
  // 检测 Windsurf
  if (appName.includes('windsurf') || appRoot.includes('windsurf')) {
    return {
      type: 'windsurf',
      hasBuiltinAI: true,
      hasBuiltinGemini: false,
      hasPython: false,
      displayName: 'Windsurf'
    };
  }
  
  // 默认为 VS Code
  return {
    type: 'vscode',
    hasBuiltinAI: false,
    hasBuiltinGemini: false,
    hasPython: false,
    displayName: 'VS Code'
  };
}
```

### 2.2 运行时检测

```typescript
// src/extension.ts

import { detectIDE } from './utils/ideDetector';

export async function activate(context: vscode.ExtensionContext) {
  // 检测 IDE 环境
  const ideCapabilities = detectIDE();
  
  // 存储到全局状态
  context.globalState.update('ideCapabilities', ideCapabilities);
  
  // 显示欢迎信息
  vscode.window.showInformationMessage(
    `神灯音乐工作台已启动 (${ideCapabilities.displayName})`
  );
  
  // 根据环境提供不同的配置建议
  if (!ideCapabilities.hasBuiltinGemini) {
    showGeminiConfigPrompt();
  }
}
```

---

## 3. AI 能力适配层

### 3.1 统一接口设计

```typescript
// src/services/aiService.ts

export interface AIService {
  generateText(prompt: string, options?: GenerateOptions): Promise<string>;
  generateImage(prompt: string, options?: ImageOptions): Promise<string>;
}

export interface GenerateOptions {
  temperature?: number;
  maxTokens?: number;
  systemPrompt?: string;
}

export interface ImageOptions {
  size?: '256x256' | '512x512' | '1024x1024';
  style?: 'photorealistic' | 'anime' | 'digital-art';
}
```

### 3.2 Antigravity 适配器

```typescript
// src/services/adapters/antigravityAdapter.ts

export class AntigravityAIAdapter implements AIService {
  async generateText(prompt: string, options?: GenerateOptions): Promise<string> {
    // 调用 Antigravity 内置 Gemini API
    // 注意：这里的 API 需要根据 Antigravity 的实际文档调整
    
    try {
      // 假设 Antigravity 提供了全局的 antigravity 对象
      const result = await (globalThis as any).antigravity?.gemini?.generateText({
        prompt,
        temperature: options?.temperature ?? 0.7,
        maxOutputTokens: options?.maxTokens ?? 1024,
        systemInstruction: options?.systemPrompt
      });
      
      return result.text;
    } catch (error) {
      console.error('Antigravity AI call failed:', error);
      throw new Error('无法调用 Antigravity 内置 AI');
    }
  }
  
  async generateImage(prompt: string, options?: ImageOptions): Promise<string> {
    try {
      const result = await (globalThis as any).antigravity?.gemini?.generateImage({
        prompt,
        aspectRatio: options?.size === '1024x1024' ? '1:1' : '16:9'
      });
      
      return result.imageUrl;
    } catch (error) {
      console.error('Antigravity image generation failed:', error);
      throw new Error('无法调用 Antigravity 图像生成');
    }
  }
}
```

### 3.3 通用 Gemini 适配器

```typescript
// src/services/adapters/geminiAdapter.ts

export class GeminiAPIAdapter implements AIService {
  private apiKey: string;
  
  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }
  
  async generateText(prompt: string, options?: GenerateOptions): Promise<string> {
    const response = await fetch(
      'https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-goog-api-key': this.apiKey
        },
        body: JSON.stringify({
          contents: [{
            parts: [{ text: prompt }]
          }],
          generationConfig: {
            temperature: options?.temperature ?? 0.7,
            maxOutputTokens: options?.maxTokens ?? 1024
          }
        })
      }
    );
    
    if (!response.ok) {
      throw new Error(`Gemini API error: ${response.statusText}`);
    }
    
    const data = await response.json();
    return data.candidates[0].content.parts[0].text;
  }
  
  async generateImage(prompt: string, options?: ImageOptions): Promise<string> {
    // Gemini 目前不直接支持图像生成
    // 可以集成 Imagen 或其他服务
    throw new Error('Gemini API 不支持图像生成，请使用即梦 API');
  }
}
```

### 3.4 工厂模式创建适配器

```typescript
// src/services/aiServiceFactory.ts

import { detectIDE } from '../utils/ideDetector';
import { AntigravityAIAdapter } from './adapters/antigravityAdapter';
import { GeminiAPIAdapter } from './adapters/geminiAdapter';

export async function createAIService(
  context: vscode.ExtensionContext
): Promise<AIService> {
  const ideCapabilities = detectIDE();
  
  // 优先使用 IDE 内置能力
  if (ideCapabilities.hasBuiltinGemini) {
    return new AntigravityAIAdapter();
  }
  
  // 降级到用户配置的 API Key
  const config = vscode.workspace.getConfiguration('magicLampStudio');
  const apiKey = await context.secrets.get('geminiApiKey') 
    || config.get<string>('geminiApiKey');
  
  if (!apiKey) {
    // 提示用户配置
    const action = await vscode.window.showWarningMessage(
      '需要配置 Gemini API Key 才能使用 AI 功能',
      '去配置',
      '稍后'
    );
    
    if (action === '去配置') {
      vscode.commands.executeCommand(
        'workbench.action.openSettings',
        'magicLampStudio.gemini'
      );
    }
    
    throw new Error('未配置 Gemini API Key');
  }
  
  return new GeminiAPIAdapter(apiKey);
}
```

---

## 4. 使用示例

### 4.1 在 Extension 中使用

```typescript
// src/commands/optimizeLyrics.ts

import { createAIService } from '../services/aiServiceFactory';

export async function optimizeLyrics(
  context: vscode.ExtensionContext,
  lyrics: string
): Promise<string> {
  try {
    const aiService = await createAIService(context);
    
    const prompt = `
你是一位专业的歌词创作者。请优化以下歌词，使其更有韵律感和情感表达：

原始歌词：
${lyrics}

要求：
1. 保持原意
2. 优化押韵
3. 增强情感表达
4. 调整节奏感

请直接返回优化后的歌词，不要有其他说明。
    `.trim();
    
    const optimizedLyrics = await aiService.generateText(prompt, {
      temperature: 0.8,
      maxTokens: 2048
    });
    
    return optimizedLyrics;
  } catch (error) {
    vscode.window.showErrorMessage(`歌词优化失败: ${error.message}`);
    throw error;
  }
}
```

### 4.2 在 Webview 中调用

```typescript
// webview/src/components/LyricsPanel.tsx

const handleOptimize = async () => {
  setLoading(true);
  
  // 通过 postMessage 调用 Extension
  vscode.postMessage({
    command: 'optimizeLyrics',
    payload: { lyrics: originalLyrics }
  });
};

// 监听返回结果
useEffect(() => {
  const handler = (event: MessageEvent) => {
    const { command, data, error } = event.data;
    
    if (command === 'optimizeLyricsResult') {
      if (error) {
        toast.error(error);
      } else {
        setOptimizedLyrics(data.lyrics);
      }
      setLoading(false);
    }
  };
  
  window.addEventListener('message', handler);
  return () => window.removeEventListener('message', handler);
}, []);
```

---

## 5. 配置界面设计

### 5.1 Settings Schema

```json
// package.json
{
  "contributes": {
    "configuration": {
      "title": "神灯音乐工作台",
      "properties": {
        "magicLampStudio.geminiApiKey": {
          "type": "string",
          "default": "",
          "description": "Gemini API Key (仅在非 Antigravity 环境需要)",
          "markdownDescription": "获取 API Key: [Google AI Studio](https://makersuite.google.com/app/apikey)"
        },
        "magicLampStudio.sunoApiUrl": {
          "type": "string",
          "default": "http://localhost:3001",
          "description": "Suno API 服务地址"
        },
        "magicLampStudio.jimengApiKey": {
          "type": "string",
          "default": "",
          "description": "即梦 API Key"
        }
      }
    }
  }
}
```

### 5.2 首次启动引导

```typescript
// src/commands/showWelcome.ts

export async function showWelcome(context: vscode.ExtensionContext) {
  const ideCapabilities = detectIDE();
  
  const panel = vscode.window.createWebviewPanel(
    'magicLampWelcome',
    '欢迎使用神灯音乐工作台',
    vscode.ViewColumn.One,
    { enableScripts: true }
  );
  
  panel.webview.html = getWelcomeHTML(ideCapabilities);
}

function getWelcomeHTML(capabilities: IDECapabilities): string {
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: var(--vscode-font-family); padding: 20px; }
        .status { margin: 20px 0; }
        .status-item { display: flex; align-items: center; margin: 10px 0; }
        .icon { margin-right: 10px; font-size: 20px; }
        .ok { color: #4caf50; }
        .warning { color: #ff9800; }
      </style>
    </head>
    <body>
      <h1>🎵 欢迎使用神灯音乐工作台</h1>
      
      <h2>环境检测</h2>
      <div class="status">
        <div class="status-item">
          <span class="icon">${capabilities.hasBuiltinGemini ? '✅' : '⚠️'}</span>
          <span>Gemini AI: ${capabilities.hasBuiltinGemini ? '内置可用' : '需要配置 API Key'}</span>
        </div>
        <div class="status-item">
          <span class="icon">${capabilities.hasPython ? '✅' : '⚠️'}</span>
          <span>Python 环境: ${capabilities.hasPython ? '已检测到' : '需要安装'}</span>
        </div>
      </div>
      
      <h2>快速开始</h2>
      <ol>
        <li>配置 Suno API 服务（<a href="command:magicLampStudio.openSunoGuide">查看教程</a>）</li>
        ${!capabilities.hasBuiltinGemini ? '<li>配置 Gemini API Key（<a href="command:workbench.action.openSettings?magicLampStudio.gemini">去设置</a>）</li>' : ''}
        <li>创建你的第一个音乐项目</li>
      </ol>
      
      <button onclick="vscode.postMessage({ command: 'createProject' })">
        🚀 创建项目
      </button>
    </body>
    </html>
  `;
}
```

---

## 6. 测试策略

### 6.1 单元测试

```typescript
// src/utils/__tests__/ideDetector.test.ts

import { detectIDE } from '../ideDetector';

describe('IDE Detection', () => {
  it('should detect Antigravity', () => {
    // Mock vscode.env
    (global as any).vscode = {
      env: {
        appName: 'Antigravity',
        appRoot: '/path/to/antigravity'
      }
    };
    
    const result = detectIDE();
    expect(result.type).toBe('antigravity');
    expect(result.hasBuiltinGemini).toBe(true);
  });
  
  it('should detect Cursor', () => {
    (global as any).vscode = {
      env: {
        appName: 'Cursor',
        appRoot: '/path/to/cursor'
      }
    };
    
    const result = detectIDE();
    expect(result.type).toBe('cursor');
    expect(result.hasBuiltinGemini).toBe(false);
  });
});
```

### 6.2 集成测试

```typescript
// src/services/__tests__/aiService.integration.test.ts

describe('AI Service Integration', () => {
  it('should use Antigravity adapter when available', async () => {
    // Mock Antigravity environment
    (globalThis as any).antigravity = {
      gemini: {
        generateText: jest.fn().mockResolvedValue({ text: 'Generated text' })
      }
    };
    
    const service = await createAIService(mockContext);
    const result = await service.generateText('test prompt');
    
    expect(result).toBe('Generated text');
    expect((globalThis as any).antigravity.gemini.generateText).toHaveBeenCalled();
  });
  
  it('should fallback to Gemini API when no builtin AI', async () => {
    // Mock VS Code environment
    delete (globalThis as any).antigravity;
    
    const service = await createAIService(mockContext);
    // Should prompt for API key or use configured one
  });
});
```

---

## 7. 文档与用户指南

### 7.1 README 更新

```markdown
# 神灯音乐工作台

> 为 AI 原生创作者设计的音乐工作流插件

## 推荐环境

- ✅ **Antigravity** (最佳体验，内置 Gemini API)
- ✅ **Cursor** (良好体验，需配置 Gemini API Key)
- ⚠️ **VS Code** (基础体验，需手动配置所有 API)

## 快速开始

### 在 Antigravity 中使用（推荐）

1. 安装插件
2. 配置 Suno API 服务
3. 开始创作 🎵

无需配置 Gemini API Key！

### 在 VS Code 中使用

1. 安装插件
2. 配置 Gemini API Key
3. 配置 Suno API 服务
4. 开始创作 🎵
```

### 7.2 配置教程

创建详细的配置教程，针对不同 IDE 环境提供不同的指导。

---

## 8. 未来优化方向

1. **自动检测 API Key**：从环境变量或配置文件自动读取
2. **多 AI 后端支持**：支持 OpenAI、Claude 等其他 AI 服务
3. **离线模式**：使用本地 LLM（如 Ollama）
4. **性能优化**：缓存 AI 响应，减少 API 调用

---

**文档完成** ✅  
下一步：实现环境检测模块
