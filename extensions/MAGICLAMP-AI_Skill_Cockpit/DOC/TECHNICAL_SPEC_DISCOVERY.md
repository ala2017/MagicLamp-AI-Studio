# 技术规范：资源检索与发现策略 (Resource Discovery Strategy)

为了确保 Skill Cockpit 能准确纳管所有 AI 能力，我们定义以下严谨的**检索策略 (Discovery Strategy)**。

## 1. 扫描范围与优先级 (Scope & Priority)

系统将按以下优先级顺序扫描资源，每一层级的同名资源将**覆盖**下一层级（Shadowing）：

1. **Runtime Memory**: 当前调试会话中动态加载的（最高优先级）。
2. **Workspace Local**: 当前打开项目的布局目录。
3. **User Global**: 用户机器的全局配置目录。
4. **System/Extension Built-in**: 插件自带的黄金模板（最低优先级）。

## 2. 规则驱动的检索引擎 (Rule-Based Discovery Engine)

不再在代码中硬编码路径，而是通过加载外部规则文件 `discovery_manifest.json` 来驱动扫描。这也是系统支持**动态更新**的基础。

### 2.1 规则定义 (Manifest Schema)

参见项目根目录下的 `discovery_manifest.json`。该文件定义了每个工具的：

* **Path**: 支持环境变量 (`${env:APPDATA}`) 和工作区变量 (`${workspaceFolder}`)。
* **Pattern**: 文件匹配模式 (glob)。
* **Format**: 解析器类型 (`json-mcp`, `cursor-mdc`, `sqlite-vscdb`, `antigravity-skill`)。

### 2.2 动态更新机制 (Dynamic Update)

插件启动时（或用户点击 "Check Updates"），会尝试从官方仓库拉取最新的 `discovery_manifest.json` (Raw URL)。

* **Remote URL**: `https://raw.githubusercontent.com/antigravity-ai/skill-cockpit/main/registry/discovery_manifest.json` (示例)
* **Fallback**: 若拉取失败，使用插件内置的 default manifest。
* **Versioning**: Manifest 包含 version 字段，插件仅在 remote version > local version 时更新。

### 2.3 解析器适配 (Parser Adapters)

引擎根据 `format` 字段调度不同的解析器：

* **`antigravity-skill`**: 标准解析器。读取 `SKILL.md` 的 YAML Frontmatter。
* **`json-mcp`**: Claude 解析器。读取 JSON 中的 `mcpServers` 键值对，转换为 Skill 对象。
* **`cursor-mdc`**: Cursor 解析器。读取 `.mdc` 文件的 Frontmatter (通常包含 description, globs)。
* **`sqlite-vscdb`**: (高级) 使用 `better-sqlite3` 或类似库（需注意 Native Module 兼容性，暂时可能仅做只读提示）读取 Cursor 的内部 SQLite 数据库，提取 Prompt History。

## 3. 实时监听与热重载 (Watch & Hot-Reload)

* 监听 `.agent/skills/**` 和 `.gemini/antigravity/**` 的 `create`, `change`, `delete` 事件。
* 一旦检测到 `SKILL.md` 变动，**立即** 触发 `Parser.reparse(path)` 并通过 RPC 推送给 Resource Console 更新 UI，无需 Reload Window。
* **ConfigWatcher**:
  * 监听 `claude_desktop_config.json` 的变动。
  * 变动时弹出 Toast: "检测到 Claude MCP 配置更新，是否同步？"

## 4. 冲突解决策略 (Conflict Resolution)

当 Global 和 Project 存在同名资源（如都叫 `git-commit-helper`）时：

* **默认行为**: Project 级资源 **Override（覆盖）** Global 级资源。
* **UI 表现**: 在列表中显示 Project 级资源，并打上 `[Override]` 的角标，提示用户这覆盖了全局配置。
