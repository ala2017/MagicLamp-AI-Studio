# Red Team Technical Review Report

## 1. 致命架构缺陷 (Critical Architecture Flaws)

### 🔴 1.1 前端技术选型风险 (High Risk)

* **当前设定**: "No-Framework (Vanilla JS)"。
* **红队挑战**: 您设想的 UI 包含 "Nav Rail", "Data Grid", "Diff View", "State Management" (Console/Marketplace 切换)。用原生 JS 手写这些逻辑将导致**代码难以维护**、状态同步 Bug 频发。DOM 操作繁琐，极其容易出现“点击无反应”或“视图不更新”的问题。
* **修正建议**: 必须引入轻量级组件化框架。鉴于 VS Code 官方 Webview Toolkit 基于 **Web Components**，建议使用 **React** 或 **Lit**。为了开发效率和稳定性，**强列建议改为 React** (VS Code 插件开发的行业标准)。

### 🔴 1.2 布局适配性崩溃 (Layout Breakage)

* **当前设定**: "统一资源网格 (Unified Resource Grid)" 包含 6-7 列信息。
* **红队挑战**: 如果此插件运行在 **Sidebar (侧边栏)**，平均宽度只有 200-300px。Grid 布局将瞬间崩溃，挤成一团，完全不可用。
* **修正建议**: 明确 **"Skill Cockpit" 必须占用 Editor Area (编辑器区域)**，即打开一个全屏的 Tab，而不是挤在侧边栏。侧边栏只应作为一个“入口”或“精简列表”。

### 🔴 1.3 LLM "Deep Scan" 的性能陷阱 (Latency Trap)

* **当前设定**: "Paste URL -> LLM 分析源码 -> 安装"。
* **红队挑战**: 一个中型 Repo 可能有 50+ 文件。通过 `vscode.lm` 将所有代码传给 LLM 分析可能需要 **30秒-2分钟**，且极易触发 Rate Limit。用户会因为"安装卡死"而流失。
* **修正建议**: 将 "Deep Scan" 改为 **"Async Advisory" (异步顾问)**。
  * 先快速 Pattern Match (正则) -> 允许安装。
  * 后台异步运行 LLM 扫描 -> 发现问题后再弹窗 "Post-Install Risk Alert"。
  * 或者仅扫描 `SKILL.md` 和入口文件，而非全量代码。

## 2. 运行时隐患 (Runtime Hazards)

### 🟠 2.1 Python 环境地狱 (Dependency Hell)

* **当前设定**: "自动适配 Python 脚本"。
* **红队挑战**: Python 脚本运行依赖环境。用户的 `python` 是 3.8 还是 3.12？依赖包 (`requests`, `pandas`) 装在哪？直接运行极易报 `ModuleNotFound`。
* **修正建议**: 必须内置 **"Virtual Environment Manager"**。插件首次初始化时，在 `.gemini/antigravity/venv` 创建一个专用沙箱环境，所有 Skill 的依赖都装在这里，而不是污染用户的全局 Python。

### 🟠 2.2 Claude Config 并发冲突

* **当前设定**: 修改 `%APPDATA%/Claude/claude_desktop_config.json`。
* **红队挑战**: 该文件是 **JSONC** (带注释的 JSON)。普通的 `JSON.parse/stringify` 会**删除用户的所有注释**，这是不可接受的破坏性行为。
* **修正建议**: 必须使用 `jsonc-parser` 库进行 AST 级别的修改，保留用户的注释和格式。

### 🟠 2.3 `vscode.lm` 的可用性

* **当前设定**: L1 优先使用 `vscode.lm`。
* **红队挑战**: `vscode.lm` 目前是 **Proposal API** (可能需要申请白名单或特定版本)，且强依赖用户安装了 Copilot Chat。如果用户只有 Cursor 没装 Copilot 怎么办？
* **修正建议**: 将 **L2 (Direct API)** 提升为同等重要。如果检测不到 `vscode.lm`，必须引导用户输入 Key，否则插件瞬间变砖。

## 3. 结论与行动调整

1. **Tech Stack**: 立即切换为 **React + Vite** 构建 Webview。
2. **Layout**: 锁定为 **Editor Tab** 模式。
3. **Library**: 添加 `jsonc-parser` 处理配置文件。
4. **Python**: 增加 `venv` 管理逻辑（可推迟到 Phase 2实现，Phase 1先假设用户环境 OK）。
