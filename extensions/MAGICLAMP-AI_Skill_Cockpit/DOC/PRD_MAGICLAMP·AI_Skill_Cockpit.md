# PRD：MAGICLAMP·AI Skill Cockpit (技能驾驶舱)

> **版本**：v1.0.0
> **状态**：Draft
> **更新日期**：2026-01-26
> **核心目标**：为 AI-ide工具， 打造一个集可视化监控、全生命周期管理、生态扩展于一体的 VS Code 原生级管理插件，解决 Skill 系统“不可见、难管理、缺生态”的三大痛点。

---

## 1. 产品愿景 (Vision)

做 AI-ide 生态的 **"Universal Command Center"** (通用指挥中心)。

*   **跨平台中立性 (Neutrality)**: 打破 VS Code、Cursor、Antigravity 等 IDE 之间的壁垒，成为开发者跨工具作业时的**统一技能控制台**。
*   **连接一切 (Connectivity)**: 将 **MCP Servers** (连接能力)、**Plugins** (扩展能力)、**Skills** (认知能力) 进行统一纳管，无论底层协议如何变迁（MCP/OpenAI Actions），管理权始终在用户手中。

## 2. 核心功能模块 (Core Modules)

### 2.1 资源主控台 (Resource Console - 核心交互区)

解决“不可见、难管理”的问题，用户第一眼看到的是清晰的**能力清单**。

* **🚀 快速安装栏 (Quick Install Bar)**:
  * 置顶的宽幅输入框："Paste GitHub URL to Install..."。
  * 支持输入 URL 后自动触发“智能适配引擎”。
* **🧘 Zen 专注模式 (Zen Mode)**:
  * 右上角一键切换，隐藏侧边栏、顶部标题与安装栏，仅保留核心资源列表。
  * 提供沉浸式管理体验，专注于资源监控与操作。
* **📋 统一资源网格 (Unified Resource Grid)**:
  * **核心视图**：不再是各种图表，而是类似任务管理器的详细清单。
  * **列定义**: `[Icon+Name]` | `[Type Badge]` | `[Scope Badge]` | `[Tool Compat (VSCode/Cursor/Claude)]` | `[Status]` | `[Actions]`。
  * **过滤与排序**: 这是一个管理工具，必须支持按 "Updates Available", "Errors", "Globally Installed" 等维度快速筛选。
  * **开关与卸载**:
    * **状态开关**: 在列表行内提供 Active/Disabled 点击切换，直达 `skills.toggle` 逻辑。
    * **卸载入口**: 展开行后的 Actions 区必须包含 Uninstall，直达 `skills.delete` 逻辑。
    * **配置与编辑**: 行内提供 Config/Edit 入口，便于快速进入配置与工坊。
* **🧭 迷你状态栏 (Mini-Monitors)**:
  * Token 消耗和安全状态退居右上角，作为胶囊型的小组件 (Pill Widget) 展示，不占用主操作区。

### 2.2 技能工坊 (Workshop - 制作与调试)

解决“制作难”的问题，降低 Prompt Engineering 门槛。

* **🛠️ 可视化编辑器**: 也就是 Skill Creator 的 GUI 版。表单式填写 Trigger、Description、Instructions，实时预览 `SKILL.md` 源码。
* **🧪 调试沙箱 (Playground)**: 内置模拟对话框，不消耗真实 Token，仅测试 Router 是否能准确命中设定的 Trigger 关键词。
* **📝 黄金模板库**: 内置 "Coding", "Review", "Design" 等几大类经过验证的最佳实践模板，一键生成。
* **🖇️ 技能编排 (Orchestration)**: 允许定义 Skill Chain（技能链），例如：`架构设计` -> `API 定义` -> `测试生成`，实现工作流自动化。

### 2.3 仓库管理 (Repository - 非易失性管理)

解决“难管理”的问题，提供后悔药和版本控制。

### 2.5 智能适配引擎 (Smart Adapter Engine - 跨端核心)

**核心差异化功能**：解决 "拿到一个 GitHub 仓库却不知道怎么用" 的痛点。

* **🧠 仓库认知解析 (Repo Cognitive Analysis)**:
  * 用户输入任意 GitHub 仓库地址。
  * AI 自动阅读 `README.md`, `package.json`, 核心代码。
  * **识别类型**: 是一个 MCP Server? 是一个 Python 脚本? 还是一个 VS Code 插件?
* **🔌 环境自适应安装 (Adpative Installation)**:
  * 根据当前运行环境（Antigravity / Cursor / VS Code / Claude Desktop）自动生成安装策略。
  * *Case A (MCP)*: 若检测为 MCP Server，自动修改 `claude_desktop_config.json` 或 Antigravity 的 MCP 注册表。
  * *Case B (Script)*: 若为独立脚本，自动封装为 Shell Skill。
* **🌐 作用域与同步 (Scope & Sync)**:
  * **Tri-Level Scope**: 安装时选择 **Global** (本机所有项目可用)、**Project** (仅当前项目可用) 或 **Sync All** (同步给所有受支持的 AI 工具)。
  * **Toolchain Sync**: 一处安装，多处生效。例如在 Antigravity 安装了 "Google Drive MCP"，可勾选同步给 Claude Desktop，实现能力互通。

### 2.6 市场与源管理器 (Marketplace & Source Manager)

支持“联邦式”分发，吸纳社区优质资源。

* **🌍 多源订阅 (Multi-Source Subscription)**:
  * 允许用户添加第三方 Registry URL (指向 `discovery_manifest.json`)。
* **🌉 外部资源桥接 (External Resource Bridge)**:
  * **策略**: "Data Ingestion, Platform Native"。吸纳外部静态列表数据，通过 Antigravity 的安全与管理机制运行。
  * **SkillHub Awesome Skills**: 自动解析其 README 生成动态 Skill 列表，标记为 "Community Source"，并强制启用 Install-Time AI Scan。
  * **Baoyu Skills**: 深度集成其内容创作类 Skill，作为官方推荐的 "Creative Suite"。
* **🛡️ 来源信任分级**:
  * **Official**: 官方认证，绿色盾牌。
* **Verified**: 知名组织（如 Microsoft/Google），蓝色盾牌。
* **Community**: 用户添加的第三方源，灰色小球，安装时弹出风险提示。
* **🛒 聚合检索**: 搜索结果将聚合所有已订阅源的内容，并优先展示高信誉源。
* **✨ 状态看板**: 卡片式展示所有资源，通过状态灯（🟢Active / ⚪Idle / 🔴Error）显示健康度。
* **⏪ 时光机 (Time Machine)**:
  * **一键快照**: 编辑保存时自动生成本地历史副本。
  * **秒级回滚**: 提供 Timeline 视图，一键还原到任意历史时刻。

### 2.7 安全卫士 (Security Guard - 信任机制)

### 2.7 安全卫士 (Security Guard - 三层防御)

* **🛡️ 静态与 AI 深度扫描 (Deep Scan)**:
  * **Level 1**: 正则扫描 Prompt 注入特征 (如 "ignore previous instructions").
  * **Level 2**: **Install-Time AI Scan**。安装前调用 LLM 分析源码意图，识别混淆代码或系统破坏指令。
* **🛂 权限动态审计 (Permission Audit)**:
  * 安装 / 运行时醒目提示 Skill 是否包含高危权限 (`cmd_run`, `fs_delete`)。
* **🚨 熔断机制 (Kill Switch)**:
  * 根据官方黑名单（Manifest），自动禁用已知恶意 Skill。

### 2.8 性能与质量分析 (Quality & Performance)

由 "Performance Check" 模块驱动。

* **⚖️ 功能重叠检测 (Overlap Detection)**:
  * 安装新 Skill 时，自动计算其与已安装 Skill 的功能语义相似度。
  * **提示**: "检测到功能重复：'PyLint Pro' 与已有的 'Python Linter' 高度相似，建议二选一。"
* **📉 性能预估 (Performance Prediction)**:
  * 分析 Skill 上下文大小，预警可能的高 Token 消耗（如 "此 Skill 每次运行消耗 ~20k Tokens"）。

### 2.9 智能推荐引擎 (Smart Recommendation)

* **🔍 场景感知 (Context-Aware)**:
  * 自动扫描 `package.json`、`requirements.txt` 或当前打开的文件类型。
  * **示例**: 检测到 `terraform` 模块，顶部横幅主动推荐 "Infrastructure as Code Expert" Skill。
  * **动态性**: 推荐内容随项目上下文实时变化。

### 2.10 智能编排中心 (Orchestration Hub - Alpha)

解决“单点能力强，协作能力弱”的痛点，提供可视化的多智能体（Multi-Agent）与工作流（Workflow）编排能力。

* **🎼 多格式兼容 (Universal Format Support)**:
  * **CrewAI Support**: 原生解析 `agents.yaml` 和 `tasks.yaml`，可视化展示 Role, Goal, Backstory 和 Task 依赖关系。
  * **AutoGen Support**: 支持导入 `workflow.json`，还原 Agent 节点连接图。
  * **Copilot Agent Mode**: 识别 `.github/copilot-instructions.md` 中的复杂指令链。
* **🎨 可视化画布 (Workflow Canvas)**:
  * **Drag & Drop**: 从左侧 Skill 列表拖拽节点到画布，连线定义执行顺序 (Sequential) 或并行分支 (Parallel)。
  * **Logic Nodes**: 插入“Router”节点（基于 LLM 判断走向）和“Human-in-the-loop”节点（等待人工审批）。
* **🔌 MCP Bridge (MCP 桥接器)**:
  * 自动将本地安装的 MCP Servers (如 `sqlite-mcp`, `filesystem-mcp`) 注入到 CrewAI/AutoGen 的 Agent 运行环境中，实现“一次配置，全框架可用”。

---

## 3. 技术架构 (Technical Architecture)

### 3.1 用户体验设计语言 (UX/UI Design Language)
>
> 核心理念：**Management First**（管理优先）。从炫技的仪表盘转变为高效的系统级控制台。

* **视觉风格 (Visual Style)**:
  * **Data Design**: 强调高密度信息展示 (High Density)。类似 IDE 的 "Problems" 或 "Extensions" 列表，而非大字报式的 Dashboard。
  * **Cyber-Native Elements**:
    * **Scanline Hybrid**: 列表行悬停时出现扫描线效果 (`background: rgba(255,255,255,0.05)`).
    * **Badges System**: 使用霓虹色徽章区分类型（Skill=Blue, MCP=Purple, Extension=Orange）和作用域（Global=Glass, Project=Outline）。
    * **Status Indicators**: 只有在有状态变更（如可更新、报错）时才高亮，平时保持静默。

* **交互动效 (Micro-Interactions)**:
  * **Master-Detail**: 点击列表行，底部或侧边无缝滑出 "Detail Drawer"，展示代码预览或配置表单。
  * **Inline Actions**: 鼠标悬停行时，快速显示 `[Update]`, `[Edit]`, `[Config]` 按钮，减少点击层级。

### 3.2 宿主环境 (Host - VS Code Extension)

* **Core Logic**: TypeScript。
* **Watcher**: 使用 `vscode.workspace.createFileSystemWatcher` 实时监听 `.agent/skills` 目录，实现文件级的热重载 (Hot Reload)。
* **Parser**: 集成 `yaml-front-matter` 高效解析 Skill 元数据，建立内存索引。
* **Git Integration**: 直接调用 `git` 底层命令 (`git show`, `git diff`) 获取历史版本数据，不依赖大型 Git 库。
* **默认入口**: 侧边栏作为启动器，主 UI 默认在编辑器 Tab 打开。

### 3.3 模型推理层 (Model Inference Layer - 混合动力)

不再强制用户配置 API Key，而是充分利用宿主环境算力。

* **L1: Host Native (优先)**:
  * 利用 VS Code `vscode.lm` API，直接调用用户已授权的 **GitHub Copilot** 或 **Copilot Chat** 模型。
  * **优势**: 零配置、零额外付费（复用 Copilot 订阅）、企业级安全。
* **L2: Direct API (备选)**:
  * 支持标准的 OpenAI / Anthropic / Gemini API Key 配置。
  * 适用于需要特定模型（如 Claude 3.5 Sonnet）但宿主不支持的场景。
* **L3: Local Inference (私有)**:
  * 通过 HTTP 连接本地运行的 Ollama / LM Studio。
  * 适用于数据隐私极其敏感的离线环境。

### 3.4 前端视图 (Client - Webview SPA)

* **Architecture**: **No-Framework (Vanilla JS)**。
  * 不引入 React/Vue/Angular，避免打包体积膨胀和运行时开销。
  * 直接操作 DOM，配合 Template Strings 生成 HTML。
* **Communication**: 设计基于 `JSON-RPC` 风格的 `postMessage` 消息总线。
  * Host -> Client: `{ type: 'telemetry_update', data: ... }`
  * Client -> Host: `{ command: 'runTest', skillId: ... }`
* **State Management**: 利用 `vscode.setState()` 实现 Webview 状态持久化，确保窗口重载（Reload Window）后上下文不丢失。
* **Security**: 严格的 CSP (Content Security Policy) 配置，仅允许加载插件内部资源，全面封锁外部脚本注入。
* **首屏保障**: Host 主动注入首屏状态，客户端兜底触发 init，避免卡在加载态。

---

### 3.5 前端导航架构 (Frontend Navigation Architecture)

为了承载复杂的管理、市场与编辑功能，采用 **"Unified Webview with Nav Rail"** 策略。

* **侧边导航栏 (Nav Rail)**: 固定在 Webview 左侧 (50px)，用于模块切换。
    1. **Console**: 资源列表、状态监控、快速安装。
    2. **Marketplace**: 源管理、发现新 Skill。
    3. **Workshop**: 创建、调试 Prompt。
    4. **Settings**: 全局配置、API Key 管理。
* **视图切换 (View Switching)**:
  * 纯前端路由（Client-Side Routing），点击图标立即切换右侧内容区，无页面刷新，保持状态（如滚动位置）。

### 3.6 Skill 详情视图 (Skill Detail View - New)

为了解决“黑盒”问题，用户必须能够查看 Skill 的内部实现与文档。

*   **入口**: 在 Console 列表中点击任意 Skill 卡片。
*   **布局**: 覆盖式面板 (Overlay Panel) 或 独立详情页。
*   **功能 Tab**:
    *   **Overview (概览)**:
        *   渲染 `README.md` (Markdown)。
        *   展示元数据：作者、版本、License、标签。
    *   **Code (源码)**:
        *   展示核心文件列表 (如 `index.ts`, `manifest.json`, `*.py`)。
        *   **Action**: "Open in Editor" (在宿主编辑器中打开文件)。
        *   **Preview**: 提供简单的只读代码预览。

### 3.7 Skill 更新机制 (Update Strategy - New)

系统需提供智能的更新检测与执行能力，确保 Skill 始终处于最新且安全的状态。

*   **检测策略 (Detection Strategy)**:
    *   **Git-based Skills**:
        *   **算法**: 比较本地 `HEAD` Commit Hash 与远程 `origin/HEAD`。
        *   **触发时机**: 每次打开 Console 时静默检测 (Debounced)。
    *   **Registry-based Skills**:
        *   **算法**: 比较本地 `package.json` 或 `manifest.json` 中的 `version` 字段与 Registry 接口返回的 `latest` 版本 (SemVer)。
    *   **Local Skills**:
        *   **策略**: 不检测更新，视为用户私有资产。

*   **更新执行 (Execution)**:
    *   **Git**: 执行 `git pull --rebase`，若有冲突则弹窗提示用户手动解决。
    *   **Registry**: 下载新版包并替换旧文件，保留用户配置文件 (`.env`, `config.json`)。

*   **UI 表现**:
    *   仅当检测到新版本时，Skill 卡片上才会出现 **"Update Available"** 徽章和 **Update** 按钮。
    *   更新过程中显示 Loading 状态。

---

---

## 5. 致谢与参考 (Credits & Acknowledgements)

本项目在设计与开发过程中，深入参考并借鉴了以下开源项目的卓越思想与实现。我们将在插件的 "About" 页面设立专门的 **Acknowledgement Tab** 以示感谢。

| Project | Contribution | Reference Area |
| :--- | :--- | :--- |
| **[JimLiu/baoyu-skills](https://github.com/JimLiu/baoyu-skills)** | Content Creation Agents | 借鉴了其高保真网页抓取 (Chrome CDP) 与内容生成工作流的设计。采用了其 `cover-image` 技能用于本项目宣发。 |
| **[keyuyuan/skillhub-awesome-skills](https://github.com/keyuyuan/skillhub-awesome-skills)** | Skill Taxonomy | 借鉴了其 Skill 分类体系 (AI-ML, DevOps, Security) 及静态资源站的运营模式。本项目将通过 Bridge 适配器兼容其 Skill 列表。 |

> *Created by Antigravity Agent & User Collaboration*
