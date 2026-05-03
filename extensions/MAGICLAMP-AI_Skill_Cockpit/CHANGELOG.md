# Changelog

All notable changes to the "MAGICLAMP·AI Skill Cockpit" extension will be documented in this file.

## [0.1.22] - 2026-01-26
### Changed
- 重构 Sidebar (侧边栏)：
  - 升级为功能完备的 Mini Dashboard，不再是单一的启动按钮。
  - 新增实时 Skill 列表展示，直观查看安装的技能及其状态。
  - 支持直接点击列表项跳转至控制台对应技能。
  - 保留全局 "Open Dashboard" 入口。

## [0.1.21] - 2026-01-26
### Changed
- 升级 Zen 模式交互：
  - 点击 Zen 按钮现在会触发 VS Code 窗口级 Zen Mode（全屏无干扰），实现真正的沉浸式体验。
  - 联动 Webview 内部 UI 简化与编辑器全屏。

## [0.1.16] - 2026-01-26
### Changed
- 优化 Zen 模式体验：
  - 增加右上角独立 Zen 按钮（带图标）。
  - Zen 模式下隐藏顶部标题栏与安装栏，仅保留精简过滤选项。
  - 修复 NavRail 隐藏逻辑，真正实现沉浸式管理。

## [0.1.15] - 2026-01-26
### Added
- Zen 模式按钮，右上角一键切换专注视图。

## [0.1.14] - 2026-01-26
### Fixed
- All Webview click actions now use a single VS Code API instance.
- Eliminated remaining duplicate acquireVsCodeApi calls in Console actions.

## [0.1.13] - 2026-01-26
### Fixed
- Webview Runtime Error: "An instance of the VS Code API has already been acquired".
- Implemented Singleton pattern for VS Code API usage in Webview.

## [0.1.12] - 2026-01-26
### Changed
- Release build: Integrated Webview fix (CSP & Serialization).

## [0.1.11] - 2026-01-26

### Fixed

- 统一 Webview 状态注入为可序列化数据，避免加载阶段 UI 无法渲染。
- 补充资源加载根路径，提升 Webview 资源加载稳定性。

## [0.1.10] - 2026-01-25

### Changed

- 补充升级文档，明确 UI 加载状态的消息注入与兜底策略。

## [0.1.7] - 2026-01-25

### Fixed

- Sidebar webview now reliably activates when the view is opened.
- Webview CSP updated to allow loading extension-local resources.
- Removed duplicate `license` field in package.json to avoid manifest ambiguity.

## [0.1.8] - 2026-01-25

### Changed

- Sidebar view now defaults to opening the full UI in an editor tab.

## [0.1.9] - 2026-01-25

### Fixed

- Editor webview now pushes initial state without waiting for app.init.
- Webview adds a fallback init to avoid getting stuck on loading.

## [0.1.0] - 2026-01-25

### Added

- **UI/UX Pro Max**: Complete redesign of the Console and Workshop pages with Cyberpunk/Neon aesthetic.
- **Smart Adapter Engine**: Auto-detects GitHub repo types (MCP vs Skill vs Extension) from URLs.
- **Security Guard**: Level 1 Static Analysis scans for 6 high-risk patterns (Prompt Injection, `rm -rf`, etc.) before installation.
- **Skill Manager**: Full lifecycle management (Install, Update, Config, Local Storage).
- **Core Services**: Implemented ManifestService, RepoAnalysisService, and SecurityService.

### Changed

- Replaced all emoji icons with professional SVG icons (Lucide).
- Improved response grid layout for better scalability on small screens.
- Unified button system with consistent hover states and variants.

### Fixed

- Fixed TypeScript compilation issues with `yaml-front-matter`.
- Resolved potential `ts-node` type definition conflicts in test scripts.
