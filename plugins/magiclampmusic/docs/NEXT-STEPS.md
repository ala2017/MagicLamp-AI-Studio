# 神灯音乐工作台 - 下一步开发计划

> **检查日期**：2026-01-25  
> **当前状态**：Phase 0 完成，准备进入 Phase 1  

---

## 📊 当前进度评估

### ✅ 已完成

**项目骨架**
- ✅ VS Code 插件基础结构（`src/extension.ts`）
- ✅ Webview Provider 注册
- ✅ React + Vite 开发环境配置
- ✅ TailwindCSS 样式系统
- ✅ 基础 UI 布局（侧边栏 + 主工作区）
- ✅ 步骤导航（6 个模块）
- ✅ Lyrics 和 Style 面板的 UI 原型

**文档**
- ✅ PRD（含战略定位）
- ✅ Suno API 技术研究
- ✅ IDE 环境检测方案
- ✅ 实现清单
- ✅ 项目总览

### ❌ 待实现

**核心功能**
- ❌ 环境检测模块（IDE 类型识别）
- ❌ AI 能力适配层（Gemini API）
- ❌ Suno 服务集成
- ❌ 项目管理（创建/保存/加载）
- ❌ Extension ↔ Webview 通信逻辑
- ❌ 所有业务功能（歌词润色、音乐生成等）

---

## 🎯 Phase 1: 基础架构（优先级 P0）

**目标**：建立可运行的基础架构，实现环境检测和项目管理

### 任务 1.1: 环境检测模块 ⏱️ 2-3 小时

**创建文件**：
```
src/
├── utils/
│   ├── ideDetector.ts          # IDE 类型检测
│   └── __tests__/
│       └── ideDetector.test.ts # 单元测试
```

**实现内容**：
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
  // 实现检测逻辑
}
```

**验收标准**：
- [ ] 能正确识别 4 种 IDE 类型
- [ ] 返回正确的能力标识
- [ ] 单元测试覆盖率 > 80%

---

### 任务 1.2: 项目管理模块 ⏱️ 3-4 小时

**创建文件**：
```
src/
├── models/
│   └── project.ts              # 项目数据模型
├── services/
│   └── projectService.ts       # 项目管理服务
└── types/
    └── index.ts                # 全局类型定义
```

**数据模型**：
```typescript
// src/models/project.ts
export interface Project {
  id: string;
  name: string;
  createdAt: number;
  updatedAt: number;
  lyrics: {
    original: string;
    optimized?: string;
    version: number;
  };
  style: {
    tags: string[];
    prompt: string;
  };
  generations: AudioGeneration[];
  mastering?: MasteringConfig;
  artwork?: ArtworkConfig;
}

export interface AudioGeneration {
  id: string;
  title: string;
  audioUrl: string;
  videoUrl?: string;
  status: 'queued' | 'streaming' | 'complete' | 'error';
  liked: boolean;
  createdAt: number;
}
```

**服务实现**：
```typescript
// src/services/projectService.ts
export class ProjectService {
  constructor(private context: vscode.ExtensionContext) {}
  
  async createProject(name: string): Promise<Project>
  async saveProject(project: Project): Promise<void>
  async loadProject(id: string): Promise<Project>
  async listProjects(): Promise<Project[]>
  async deleteProject(id: string): Promise<void>
}
```

**验收标准**：
- [ ] 可以创建新项目
- [ ] 项目数据保存到工作区 `.magiclamp/projects/`
- [ ] 可以加载和列出项目
- [ ] 数据持久化正常工作

---

### 任务 1.3: Extension ↔ Webview 通信 ⏱️ 2-3 小时

**更新文件**：
```
src/
├── extension.ts                # 更新消息处理
└── commands/
    ├── createProject.ts        # 创建项目命令
    ├── saveProject.ts          # 保存项目命令
    └── loadProject.ts          # 加载项目命令
```

**消息协议**：
```typescript
// src/types/messages.ts
export type ExtensionMessage = 
  | { command: 'createProject'; payload: { name: string } }
  | { command: 'saveProject'; payload: { project: Project } }
  | { command: 'loadProject'; payload: { id: string } }
  | { command: 'optimizeLyrics'; payload: { lyrics: string } }
  | { command: 'generateStyle'; payload: { tags: string[] } };

export type WebviewMessage =
  | { command: 'projectCreated'; data: Project }
  | { command: 'projectSaved'; data: { success: boolean } }
  | { command: 'projectLoaded'; data: Project }
  | { command: 'error'; data: { message: string } };
```

**实现要点**：
- Extension 接收 Webview 消息并调用相应服务
- Extension 返回结果给 Webview
- 统一的错误处理机制

**验收标准**：
- [ ] Webview 可以发送消息到 Extension
- [ ] Extension 可以响应并返回数据
- [ ] 错误能正确传递和显示

---

### 任务 1.4: Webview 状态管理 ⏱️ 2-3 小时

**创建文件**：
```
webview/src/
├── store/
│   ├── projectStore.ts         # 项目状态
│   ├── uiStore.ts              # UI 状态
│   └── index.ts                # 导出所有 store
├── hooks/
│   ├── useVSCode.ts            # VS Code API hook
│   └── useProject.ts           # 项目管理 hook
└── utils/
    └── vscode.ts               # VS Code API 封装
```

**Zustand Store**：
```typescript
// webview/src/store/projectStore.ts
import { create } from 'zustand';

interface ProjectStore {
  currentProject: Project | null;
  projects: Project[];
  
  setCurrentProject: (project: Project) => void;
  updateProject: (updates: Partial<Project>) => void;
  createProject: (name: string) => Promise<void>;
  saveProject: () => Promise<void>;
  loadProject: (id: string) => Promise<void>;
}

export const useProjectStore = create<ProjectStore>((set, get) => ({
  // 实现
}));
```

**VS Code Hook**：
```typescript
// webview/src/hooks/useVSCode.ts
export function useVSCode() {
  const vscode = acquireVsCodeApi();
  
  const postMessage = useCallback((message: ExtensionMessage) => {
    vscode.postMessage(message);
  }, []);
  
  const onMessage = useCallback((handler: (message: WebviewMessage) => void) => {
    const listener = (event: MessageEvent) => {
      handler(event.data);
    };
    window.addEventListener('message', listener);
    return () => window.removeEventListener('message', listener);
  }, []);
  
  return { postMessage, onMessage };
}
```

**验收标准**：
- [ ] Zustand store 正常工作
- [ ] useVSCode hook 可以发送和接收消息
- [ ] 状态更新触发 UI 重新渲染

---

### 任务 1.5: 项目创建 UI ⏱️ 2 小时

**更新文件**：
```
webview/src/
├── components/
│   ├── ProjectSelector.tsx     # 项目选择器
│   └── CreateProjectModal.tsx  # 创建项目弹窗
└── App.tsx                     # 集成组件
```

**UI 功能**：
- 顶部显示当前项目名称
- 点击可以切换项目
- "新建项目"按钮打开弹窗
- 输入项目名称并创建

**验收标准**：
- [ ] 可以创建新项目
- [ ] 项目名称显示在顶部
- [ ] 可以切换项目
- [ ] UI 交互流畅

---

## 🎯 Phase 2: AI 能力集成（优先级 P0）

**目标**：实现 AI 能力适配层，完成歌词润色和风格生成

### 任务 2.1: AI 服务适配层 ⏱️ 4-5 小时

**创建文件**：
```
src/
├── services/
│   ├── aiService.ts            # AI 服务接口
│   ├── adapters/
│   │   ├── antigravityAdapter.ts
│   │   ├── geminiAdapter.ts
│   │   └── index.ts
│   └── aiServiceFactory.ts     # 工厂函数
└── config/
    └── settings.ts             # 配置管理
```

**接口定义**：
```typescript
// src/services/aiService.ts
export interface AIService {
  generateText(prompt: string, options?: GenerateOptions): Promise<string>;
  generateImage(prompt: string, options?: ImageOptions): Promise<string>;
}
```

**实现要点**：
- Antigravity 适配器（优先）
- Gemini API 适配器（降级）
- 自动选择合适的适配器
- API Key 管理（SecretStorage）

**验收标准**：
- [ ] 在 Antigravity 中使用内置 API
- [ ] 在 VS Code 中使用用户配置的 API Key
- [ ] 错误处理完善
- [ ] 有降级策略

---

### 任务 2.2: 歌词润色功能 ⏱️ 3-4 小时

**创建文件**：
```
src/
└── commands/
    └── optimizeLyrics.ts       # 歌词润色命令

webview/src/
└── components/
    └── LyricsPanel.tsx         # 更新歌词面板
```

**功能实现**：
- 用户输入原始歌词
- 点击"AI 优化"按钮
- 调用 AI 服务生成优化建议
- 显示多个版本供选择
- 一键替换原始歌词

**Prompt 模板**：
```typescript
const LYRICS_OPTIMIZE_PROMPT = `
你是一位专业的歌词创作者。请优化以下歌词：

原始歌词：
{lyrics}

要求：
1. 保持原意和情感
2. 优化押韵和节奏
3. 增强表达力
4. 调整结构（如需要）

请提供 3 个不同风格的优化版本：
1. 保守版（微调）
2. 平衡版（适度优化）
3. 激进版（大幅改写）

格式：
[版本1]
...

[版本2]
...

[版本3]
...
`;
```

**验收标准**：
- [ ] 可以调用 AI 生成优化建议
- [ ] 显示多个版本
- [ ] 可以选择和替换
- [ ] Loading 状态显示
- [ ] 错误提示友好

---

### 任务 2.3: 风格提示词生成 ⏱️ 2-3 小时

**创建文件**：
```
src/
└── commands/
    └── generateStylePrompt.ts  # 风格生成命令

webview/src/
└── components/
    └── StylePanel.tsx          # 更新风格面板
```

**功能实现**：
- 用户选择标签（Genre, Mood, Instruments）
- 点击"生成 Prompt"
- AI 生成 Suno 专用 Prompt
- 可以手动编辑
- 保存到项目

**Prompt 模板**：
```typescript
const STYLE_PROMPT_TEMPLATE = `
你是 Suno AI 音乐生成专家。根据以下标签生成 Suno Prompt：

标签：{tags}
歌词主题：{lyricsTheme}

要求：
1. 使用 Suno 理解的音乐术语
2. 包含：Genre, BPM, Instruments, Mood, Vocal Style
3. 简洁明确，不超过 100 字
4. 英文输出

示例格式：
"A dark aggressive hardcore rap, heavy 808 bass, distorted synths, angry male vocals, fast flow, rebellious mood, 140 BPM"

请生成：
`;
```

**验收标准**：
- [ ] 可以选择标签
- [ ] AI 生成符合 Suno 格式的 Prompt
- [ ] 可以编辑和保存
- [ ] 预设标签库完善

---

## 🎯 Phase 3: Suno 集成（优先级 P0）

**目标**：集成 Suno API，实现音乐生成和播放

### 任务 3.1: Suno 服务封装 ⏱️ 4-5 小时

**创建文件**：
```
src/
├── services/
│   └── sunoService.ts          # Suno API 封装
└── config/
    └── suno.ts                 # Suno 配置
```

**服务实现**：
```typescript
// src/services/sunoService.ts
export class SunoService {
  private baseUrl: string;
  
  constructor(baseUrl: string = 'http://localhost:3001') {
    this.baseUrl = baseUrl;
  }
  
  async checkStatus(): Promise<{ connected: boolean; quota?: any }>
  async generate(params: GenerateParams): Promise<AudioGeneration[]>
  async getStatus(ids: string[]): Promise<AudioGeneration[]>
  async pollUntilComplete(ids: string[], maxAttempts?: number): Promise<AudioGeneration[]>
  async downloadAudio(url: string, savePath: string): Promise<void>
}
```

**功能要点**：
- 检测本地服务状态
- 调用 custom_generate API
- 轮询生成状态
- 下载音频文件
- 错误处理

**验收标准**：
- [ ] 可以检测 suno-api-private 服务
- [ ] 可以生成音乐
- [ ] 可以查询状态
- [ ] 可以下载音频
- [ ] 错误提示清晰

---

### 任务 3.2: 首次使用引导 ⏱️ 2-3 小时

**创建文件**：
```
src/
└── commands/
    └── showSunoGuide.ts        # Suno 配置引导

webview/src/
└── components/
    └── SunoSetupGuide.tsx      # 配置引导 UI
```

**引导内容**：
1. 检测 suno-api-private 服务
2. 如果未运行，显示配置教程
3. 提供下载链接和文档
4. 实时检测服务状态
5. 配置完成后自动关闭

**验收标准**：
- [ ] 首次使用显示引导
- [ ] 实时检测服务状态
- [ ] 教程清晰易懂
- [ ] 配置完成后不再显示

---

### 任务 3.3: 音频生成 UI ⏱️ 4-5 小时

**更新文件**：
```
webview/src/
└── components/
    ├── AudioPanel.tsx          # 音频生成面板
    ├── AudioCard.tsx           # 音频卡片组件
    └── AudioPlayer.tsx         # 音频播放器
```

**UI 功能**：
- 控制区（Instrumental 开关、模型选择）
- 生成按钮（显示配额）
- 生成列表（卡片展示）
- 播放器（播放/暂停、进度条）
- 收藏/删除操作

**状态管理**：
```typescript
// webview/src/store/audioStore.ts
interface AudioStore {
  generations: AudioGeneration[];
  currentPlaying: string | null;
  isGenerating: boolean;
  
  generate: (params: GenerateParams) => Promise<void>;
  togglePlay: (id: string) => void;
  toggleLike: (id: string) => void;
  deleteGeneration: (id: string) => void;
}
```

**验收标准**：
- [ ] 可以生成音乐
- [ ] 显示生成进度
- [ ] 可以播放音频
- [ ] 可以收藏和删除
- [ ] UI 交互流畅

---

## 📅 开发时间估算

### Phase 1: 基础架构（2-3 天）
- 任务 1.1: 环境检测 - 2-3 小时
- 任务 1.2: 项目管理 - 3-4 小时
- 任务 1.3: 通信机制 - 2-3 小时
- 任务 1.4: 状态管理 - 2-3 小时
- 任务 1.5: 项目 UI - 2 小时

**小计**: 11-15 小时（约 2-3 个工作日）

### Phase 2: AI 能力（2-3 天）
- 任务 2.1: AI 适配层 - 4-5 小时
- 任务 2.2: 歌词润色 - 3-4 小时
- 任务 2.3: 风格生成 - 2-3 小时

**小计**: 9-12 小时（约 2-3 个工作日）

### Phase 3: Suno 集成（3-4 天）
- 任务 3.1: Suno 服务 - 4-5 小时
- 任务 3.2: 使用引导 - 2-3 小时
- 任务 3.3: 音频 UI - 4-5 小时

**小计**: 10-13 小时（约 3-4 个工作日）

**总计**: 30-40 小时（约 7-10 个工作日）

---

## 🎯 里程碑

### 里程碑 1: 基础架构完成（Day 3）
- ✅ 环境检测正常工作
- ✅ 可以创建和管理项目
- ✅ Extension ↔ Webview 通信正常
- ✅ 状态管理正常工作

### 里程碑 2: AI 功能完成（Day 6）
- ✅ 可以使用 AI 润色歌词
- ✅ 可以生成风格提示词
- ✅ 在 Antigravity 中零配置使用
- ✅ 在 VS Code 中配置后可用

### 里程碑 3: 音乐生成完成（Day 10）
- ✅ 可以生成音乐
- ✅ 可以播放和管理音频
- ✅ 完整的创作流程打通
- ✅ 用户体验流畅

---

## 🚀 立即开始

### 第一步：环境检测模块

**现在就可以开始**：

```bash
# 1. 创建目录结构
mkdir -p src/utils/__tests__

# 2. 创建文件
touch src/utils/ideDetector.ts
touch src/utils/__tests__/ideDetector.test.ts

# 3. 开始编码
code src/utils/ideDetector.ts
```

**参考文档**：
- [ide-detection.md](./ide-detection.md) - 完整实现方案
- [PRD.md](./PRD.md) - 技术架构

---

## 📝 开发规范

### 代码风格
- TypeScript strict mode
- ESLint + Prettier
- 函数式编程优先
- 单一职责原则

### 提交规范
```
feat: 添加环境检测模块
fix: 修复项目保存问题
docs: 更新 API 文档
test: 添加单元测试
refactor: 重构 AI 服务
```

### 测试要求
- 核心模块测试覆盖率 > 80%
- 关键路径必须有集成测试
- UI 组件有基础测试

---

## ⚠️ 注意事项

### 开发环境
- Node.js >= 18
- VS Code >= 1.80
- 推荐使用 Antigravity 进行开发

### 依赖管理
- 尽量使用 VS Code 内置 API
- 避免引入大型依赖
- 注意打包体积

### 性能优化
- 懒加载非关键模块
- 缓存 AI 响应
- 避免频繁的文件 I/O

---

## 🎉 准备就绪！

所有文档和计划都已完成，现在可以开始编码了！

**建议顺序**：
1. 先完成 Phase 1（基础架构）
2. 再完成 Phase 2（AI 能力）
3. 最后完成 Phase 3（Suno 集成）

**每完成一个任务，记得**：
- [ ] 更新 implementation-checklist.md
- [ ] 提交代码到 Git
- [ ] 测试功能是否正常
- [ ] 记录遇到的问题

加油！🚀
