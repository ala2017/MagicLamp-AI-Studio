# 神灯音乐工作台 (Magic Lamp Music Studio) - 产品需求文档 (PRD)

> **版本**：v1.0 (MVP)  
> **日期**：2026-01-23  
> **状态**：规划中  
> **原则**：UI First (界面先行)  

---

## 1. 项目愿景

**神灯音乐工作台** 是一个运行在 AI IDE / VS Code 中的一体化 AI 音乐创作插件。它旨在解决音乐创作者在多个 AI 工具平台（Suno, ChatGPT, 即梦, Audition）之间反复横跳的痛点，提供一个**可视化的、流程式的、沉浸式**的创作环境。

**核心价值**：

* **Flow**：将碎片化的步骤串联为标准工作流。
* **Visualize**：让复杂的参数配置和 API 调用过程可视化。
* **Asset Management**：统一管理歌词、音频、封面、元数据。

### 1.1 为什么选择 VS Code 插件？

**战略定位：赌注 AI IDE 的未来**

我们相信 AI IDE（Cursor, Windsurf, Antigravity）将成为下一代创作者的中心工作台。不仅是程序员写代码，音乐人、设计师、作家都会在 AI IDE 中完成创作。神灯音乐工作台要成为这个生态的一部分。

**目标用户：AI 原生创作者**

* ✅ 已经在用 Cursor/Windsurf 写提示词
* ✅ 熟悉 ChatGPT/Claude 的工作流
* ✅ 需要一个统一的音乐创作工作台
* ✅ 重视数据隐私（本地优先）

**技术优势：复用 AI IDE 能力**

1. **内置 AI 能力**：Antigravity 等 AI IDE 内置 Gemini API，无需用户配置
2. **环境管理**：IDE 已解决 Python/Node 环境适配问题
3. **文件系统**：天然的项目管理和版本控制（Git）
4. **跨平台**：VS Code 已抽象所有平台差异

**分发策略：开源 + 零成本**

* ✅ Marketplace 一键安装（无需服务器）
* ✅ 用户自己的环境，自己的数据（隐私友好）
* ✅ 社区可以 Fork 和定制（生态潜力）
* ✅ 可持续的开源项目（无运营成本）

**可扩展性：社区驱动**

* 用户可以替换过时的 API（Suno → 其他服务）
* 社区可以贡献风格预设、母带算法
* 通过 Skill/Power 机制快速迭代

---

## 2. 核心范围 (MVP Scope)

**✅ 包含 (MVP Phase):**

1. **Workstation UI**：基于 VS Code Webview 的完整可视化交互面板。
2. **Lyrics**：歌词编辑器 + Gemini AI 润色/押韵优化。
3. **Style**：Gemini AI 风格提示词生成器。
4. **Audio**：集成 Suno API (官方) 进行批量生成与试听。
5. **Mastering (User Side)**：智能母带处理的**前端交互界面**（选择风格/参数）+ 调用本地 Python 脚本执行处理（Matchering/FFmpeg）。
6. **Artwork**：集成即梦 API 生成封面图。
7. **Export**：一键导出符合发行标准的资源包（音频+封面+元数据）。

**❌ 暂缓 (Post-MVP Phase):**

1. **Factory Toolkit**：用于提取母带特征指纹的 Streamlit 独立工具（由开发者内部使用）。
2. **Browser Automation**：DistroKid 自动上传/填表功能（MVP阶段仅做数据导出）。

---

## 3. 用户路径 (User Journey)

1. **项目初始化**：用户在插件中点击“新建项目”，输入歌名《他们说》，系统建立本地档案。
2. **歌词创作**：用户输入草稿，点击“AI 润色”，在分屏界面选择满意的 AI 优化版本。
3. **风格定义**：用户选择“Hardcore Rap”预设，AI 自动生成 Suno 专用 Prompt。
4. **音乐生成**：用户点击“生成”，进度条显示状态。生成完成后，在列表点击播放，标记喜欢的版本。
5. **母带处理**：用户选中满意的音频，应用“Travis Scott 风格”母带预设，系统后台处理并输出发行级音频。
6. **封面设计**：系统根据歌词自动生成封面提示词，用户点击生成并在画廊中选择。
7. **归档导出**：用户点击导出，插件生成包含 wav, jpg, json 的标准文件夹。

---

## 4. UI 界面设计 (UI First 策略)

界面采用 **左侧导航 + 主工作区** 布局，强调深色专业感 (Dark Mode)。

### 4.1 顶部栏 (Header)

* **左侧**：项目名称面包屑 (Project > 他们说_v1)
* **右侧**：全局设置 (API Key配置)、环境检查 (Python status)

### 4.2 步骤导航 (Workflow Steps)

采用垂直或水平的分步指示器，明确当前环节：

1. 📝 **Lyrics** (歌词)
2. 🎨 **Style** (风格)
3. 🎹 **Audio** (生成)
4. 🎚️ **Mastering** (母带)
5. 🖼️ **Artwork** (封面)
6. 📤 **Export** (导出)

### 4.3 各模块 UI 细节

#### 🟢 Lyrics (歌词面板)

* **布局**：双栏编辑器。
  * Left: `Original Text` (可编辑 textarea)
  * Right: `AI Suggestions` (卡片式列表，点击一键替换左侧)
* **功能区**：
  * Btn: `Optimize Rhyme` (优化押韵)
  * Btn: `Structure Fix` (结构调整)
  * Selector: `Mood` (选择情绪：愤怒/悲伤/甚至)

#### 🟢 Style (风格面板)

* **布局**：表单 + 标签云。
* **交互**：
  * Tags Input: 用户输入或点击标签 (e.g., #Dark, #808)。
  * Generated Prompt: 一个大文本框，显示生成的 Prompt，支持手动微调。
  * Btn: `Generate Prompt` (调用 Gemini)。
  * Btn: `Copy to Clipboard` (备用)。

#### 🟢 Audio (生成面板)

* **控制区**：
  * Switch: `Instrumental`
  * Select: `Model` (v3.5 / v4)
  * Btn: `Generate (Cost: 10 credits)`
* **结果列表 (Playlist)**：
  * 每个生成的 Item 包含：封面缩略图、时长、波形预览(Canvas绘制)、播放/暂停按钮、⭐收藏按钮。
  * 右键菜单：`Move to Mastering`, `Delete`。

#### 🟢 Mastering (母带面板)

* **可视化区**：
  * 显示“当前频谱” vs “目标风格频谱”的对比曲线 (ECharts/Chart.js)。
* **设置区**：
  * Select: `Target Platform` (Spotify/Apple/QQ)
  * Select: `Reference Preset` (调用 index.json 列表，如 "Eminem Style")
* **操作**：
  * Btn: `Apply AI Mastering` (触发 Python 脚本)。
  * A/B Test 切换开关：`Original` / `Mastered`。

#### 🟢 Artwork (封面面板)

* **布局**：画廊模式 (Grid View)。
* **交互**：
  * Input: 画面描述提示词 (支持 AI 基于歌词自动生成)。
  * Btn: `Generate Images`。
  * Selection: 点击选中一张作为最终封面。

---

## 5. 技术架构 (Architecture)

### 5.1 分层架构

```
┌─────────────────────────────────────────────┐
│   AI IDE Layer (Antigravity/Cursor/VS Code)│
│   - Gemini API (内置，优先使用)             │
│   - Python 环境 (内置)                      │
│   - 文件系统 (内置)                         │
│   - Git 集成 (内置)                         │
└─────────────────────────────────────────────┘
                    ↕
┌─────────────────────────────────────────────┐
│   神灯音乐插件 (Extension)                  │
│   - 环境检测与能力适配                      │
│   - 音乐工作流 UI (Webview)                 │
│   - 项目状态管理                            │
│   - API 调用封装                            │
└─────────────────────────────────────────────┘
                    ↕
┌─────────────────────────────────────────────┐
│   用户本地服务                              │
│   - suno-api-private (用户自己运行)         │
│   - Python 脚本 (插件提供，可选)            │
└─────────────────────────────────────────────┘
```

### 5.2 前端 (Webview)

* **Framework**: React 18
* **Build Tool**: Vite
* **UI Library**: VS Code Webview UI Toolkit (保持原生体验) + TailwindCSS
* **State Management**: Zustand (管理当前项目状态)
* **通信机制**: postMessage (Webview ↔ Extension Host)

### 5.3 插件主进程 (Extension Host)

* **Language**: TypeScript
* **核心职责**:
  * **环境检测**：识别 AI IDE 类型（Antigravity/Cursor/VS Code）
  * **能力适配**：优先使用 IDE 内置能力，降级到用户配置
  * **文件读写**：保存项目文件到本地 json
  * **进程管理**：Spawn 本地 Python 进程执行音频算法
  * **API 代理**：封装 Suno/Gemini/即梦 API 调用

### 5.4 环境适配策略

```typescript
// 智能检测 IDE 环境
const ideType = detectIDEType();

// 分层降级策略
if (ideType === 'antigravity') {
  // 最佳体验：使用内置 Gemini
  await antigravity.gemini.generateImage(prompt);
} else if (ideType === 'cursor') {
  // 良好体验：使用 Cursor AI
  await cursor.ai.complete(prompt);
} else {
  // 基础体验：提示用户配置 API Key
  const apiKey = await getGeminiApiKey();
  await callGeminiAPI(apiKey, prompt);
}
```

**支持矩阵**：

| 功能 | Antigravity | Cursor | VS Code |
|------|-------------|--------|---------|
| 歌词润色 (Gemini) | ✅ 内置 | ⚠️ 需配置 | ⚠️ 需配置 |
| 风格生成 (Gemini) | ✅ 内置 | ⚠️ 需配置 | ⚠️ 需配置 |
| 音乐生成 (Suno) | ✅ 本地服务 | ✅ 本地服务 | ✅ 本地服务 |
| 封面生成 (即梦) | ✅ API | ✅ API | ✅ API |
| 母带处理 (Python) | ✅ 内置环境 | ✅ 内置环境 | ⚠️ 需安装 |

### 5.5 本地计算服务 (Python Backend)

* **形态**: 随插件分发的独立 Python 脚本集合 (或依赖用户系统 Python)。
* **Dependencies**: `matchering`, `librosa`, `ffmpeg-python`, `fastapi` (可选，或直接 stdio 通信)。
* **Core Logic**: 执行具体的音频合成与母带处理。

### 5.6 数据结构 (Data Schema)

每个项目文件夹包含 `project.json`：

```json
{
  "id": "uuid",
  "name": "他们说",
  "timeline": {
    "lyrics": { "content": "...", "version": 2 },
    "style": { "prompt": "...", "tags": [] },
    "generations": [
       { "id": "gen_1", "file": "./audio/gen_1.mp3", "status": "liked" }
    ],
    "mastering": { "ref_preset": "hardcore_01", "output": "./audio/master.wav" },
    "artwork": { "selected": "./art/cover_final.png" }
  }
}
```

---

## 6. 开发路线图 (Development Roadmap)

### Phase 1: 骨架与 UI (Skeleton & UI) 📅 Days 1-2

* [ ] 搭建 VS Code 插件 + React Webview 开发环境。
* [ ] 实现环境检测模块（识别 Antigravity/Cursor/VS Code）。
* [ ] 实现"左侧导航 + 多页面切换"的 UI 框架。
* [ ] 实现项目的创建与 `.json` 读写逻辑。
* [ ] **里程碑**：可以在 VS Code 里看到漂亮的界面，虽然点击按钮没有反应。

### Phase 2: 文本流 (Text Workflow) 📅 Days 3-4

* [ ] 实现 AI 能力适配层（Antigravity 内置 vs 用户 API Key）。
* [ ] 接入 Gemini API（优先使用 IDE 内置能力）。
* [ ] 完成 [Lyrics] 面板：润色功能。
* [ ] 完成 [Style] 面板：Prompt 生成功能。

### Phase 3: 音频流 (Audio Workflow) 📅 Days 5-7

* [ ] 接入 Suno API。
* [ ] 完成 [Audio] 面板：串接生成接口，实现简易播放器。
* [ ] **里程碑**：可以从歌词一直跑到出声音。

### Phase 4: 本地处理与图像 (Local & Image) 📅 Days 8-10

* [ ] 编写 Python 母带脚本。
* [ ] 插件层实现调用 Python 脚本的机制。
* [ ] 完成 [Mastering] 面板的参数传递。
* [ ] 接入即梦 API 完成 [Artwork] 面板。

### Phase 5: 整合与优化 (Polish) 📅 Days 11+

* [ ] 串联 Export 流程。
* [ ] 统一 Loading 状态、错误处理。
* [ ] UI 美化 (Tailwind)。

---
