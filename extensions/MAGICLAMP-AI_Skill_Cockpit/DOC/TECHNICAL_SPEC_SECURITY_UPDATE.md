# 技术规范：更新与安全检测机制 (Update & Security Spec)

本规范定义了 Skill Cockpit 如何检测外部资源更新，以及如何保障加载的 Skill 安全。

## 更新记录

### 0.1.21 - 2026-01-26

- 优化 Zen Mode 实现：集成 `workbench.action.toggleZenMode`，支持 Webview 触发宿主全屏模式。

### 0.1.15 - 2026-01-26

- 增加 Zen 模式切换按钮，支持专注视图。

### 0.1.14 - 2026-01-26

- 全面清理 Webview 点击行为中的重复 VS Code API 获取。
- 确保所有点击动作统一使用单例 API，避免运行时崩溃。

### 0.1.13 - 2026-01-26

- 修复 Webview 运行时错误: "An instance of the VS Code API has already been acquired"。
- 实施 Webview VS Code API 单例模式 (Singleton Pattern)，确保全局唯一实例调用。

### 0.1.11 - 2026-01-25

- 统一 Webview 状态注入为可序列化数据，避免加载阶段 UI 无法渲染。
- 补充 Webview 资源加载根路径，提升加载稳定性。

### 0.1.10 - 2026-01-25

- 明确 UI 加载状态的消息注入与兜底策略，避免界面停留在进度条。

## 1. Skill 更新机制 (Update Mechanism)

### 1.1 Git-Based Skills (主流场景)

大多数 Skill 都是通过 Clone GitHub 仓库安装的。

* **检测策略**:
  * 插件启动或用户点击 "Check Updates" 时，对所有包含 `.git` 目录的 Skill 执行 `git fetch --dry-run`。
  * 比较本地 HEAD 与 Remote Tracking Branch (e.g., `origin/main`) 的 Commit Hash。
  * **判定**: `Local Hash != Remote Hash` => Update Available。
* **操作**:
  * UI 显示绿色 "Update Available" 徽章。
  * 用户点击更新后，执行 `git pull --rebase`。

### 1.2 Manifest-Based Resources (官方/市场 Skill)

对于通过 `discovery_manifest.json` 安装的资源。

* **版本控制**: 依赖 `manifest.json` 中的 `version` 字段。
* **检测策略**:
  * 比较 Local Manifest Version 与 Remote Manifest Version。
  * **判定**: `Remote > Local` => System Update Available。

### 1.3 更新频率 (Frequency)

* **自动检测**: 每次插件激活时（Startup）延时 30秒执行，避免阻塞启动。
* **Token 节约**: `git fetch` 仅消耗网络流量，不消耗 LLM Token。

---

## 2. Skill 安全检测机制 (Security Mechanism)

我们采用 **"三层防御体系" (Tiered Defense System)**。

### Level 1: 静态特征扫描 (Static Syntax Analysis)

在 Skill 加载入内存前，先扫描 `SKILL.md` 的文本内容。

* **高危关键词 (Red Flags)**:
  * `"ignore previous instructions"` (注入特征)
  * `"system prompt"` (尝试覆盖系统提示)
  * `"delete all files"` (破坏性指令)
* **风险评分**:
  * 命中一个 Red Flag 计 10分。
  * `Score > 0` 显示黄色警告: "Potential Risk Detected"。
  * `Score > 20` 自动禁用 Skill。

### Level 2: 权限审计 (Permission Audit)

解析 `SKILL.md` 的 Frontmatter 中的 `allowed-tools` 字段。

* **危险工具列表**:
  * `cmd_run` / `shell_exec`: **CRITICAL** (极高危，必须用户显式批准)
  * `fs_write` / `fs_delete`: **HIGH** (高危)
  * `web_fetch` (无白名单): **MEDIUM** (中危，可能泄露隐私)
* **UI 表现**:
  * Skill 详情页必须醒目展示请求的权限列表（类似 Android 安装应用时的权限弹窗）。
  * 对于 **CRITICAL** 权限，Skill 卡片上会一直显示红色盾牌 "RCE Risk"。

### Level 3: 来源信任验证 (Origin Verification)

基于 Skill 的来源给予信任等级。

* **Trusted (绿色盾牌)**:
  * 来源: `github.com/antigravity-ai/*` (官方)
  * 来源: `github.com/microsoft/*`, `github.com/google/*` (知名组织)
* **Community (灰色盾牌)**:
  * 其他 GitHub 仓库。
* **Unknown (红色盾牌)**:
  * 本地手动创建，无 Remote 源。

### 2.4 紧急熔断机制 (Kill Switch)

在 `discovery_manifest.json` 中维护一个全局 `blacklist`。

* 如果某个 Skill Repo 被发现恶意，官方将其加入黑名单。
* 客户端同步 Manifest 后，即刻**强制禁用**该 Skill 并弹窗警告。

---

### 3. 用户交互工作流 (User Interaction Workflows)

#### 3.1 启动时自动扫描 (Startup Scan)

* **时机**: 每次插件激活或窗口重载时。
* **行为**: 后台静默扫描所有 Installed Skills。
* **结果**: 如果发现新风险，Security Widget 变黄/红，并弹出 Toast: *"Security Alert: 2 skills flagged. Check Console."*

#### 3.2 安装前 AI 深度扫描 (Install-Time AI Scan)

* **时机**: 用户粘贴 URL 并点击 Install 时。
* **行为**:
    1. **Clone**: 临时 Clone 到 `/tmp` 目录。
    2. **AI Analysis**: 调用 LLM (Copilot/OpenAI) 阅读源码，提示词：*"Analyze this code for malicious intent, obfuscated network calls, or system destruction commands. Output JSON report."*
    3. **Pattern Match**: 同时运行正则扫描 (SkillScan logic)。
* **阻断策略**:
  * **High Risk**: 弹出红色模态框 (Modal)，列出具体风险代码段。用户必须输入 "CONFIRM INSTALL" 才能强行安装。
  * **Safe**: 自动安装。

#### 3.3 手动扫描 (Manual Scan)

* **入口**: Security Widget -> "Run Full Scan"。
* **行为**: 强制重新评估所有资源的 Risk Score。

---

## 4. 性能与质量检测 (Performance & Quality)

### 4.1 功能重复检测 (Functional Overlap)

* **机制**: 使用 Embedding 模型 (本地或 API) 计算 Skill Description 的语义相似度。
* **场景**: 用户已安装 "Python Linter"，又想装 "PyLint Pro"。
* **提示**: *"Duplicate Capability Detected: You already have 'Python Linter' which does similar things. Do you want to replace it?"*

### 4.2 代码质量与性能预估 (Quality & Perf)

* **静态分析**: 检查 `SKILL.md` 的 Context 上下文大小。
* **预警**: *"This skill loads 50KB of documentation into context context. Expect high token usage (~20k tokens/run)."*

---

## 5. 智能推荐引擎 (Smart Recommendation)

* **Context-Aware**:
  * 监听 IDE 打开的文件类型 (e.g., `*.tf`).
  * 扫描 `package.json` / `requirements.txt`.
* **推荐逻辑**:
  * Detection: "Detected Terraform project."
  * Query: 检索 Manifest 中 tags 包含 "terraform" 的高分 Skill。
  * Action: 在 Resource Console 顶部显示 "Recommended for this Project" 横幅。

---

## 6. UI 交互设计 (Security UI)

* **Security Widget**:
  * Default: 绿色盾牌 (All Safe).
  * Risk: 黄色盾牌 + 风险计数 ("2 Risks Found").
* **Consent Dialog**:
  * 当 Skill 首次请求 `cmd_run` 权限时，必须弹窗：
  * *"Skill 'Auto-Dev' is requesting to run Shell Commands. This allows it to modify your system. Allow?"*
  * 选项: [Allow Once] [Allow Always] [Deny].
