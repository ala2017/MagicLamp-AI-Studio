# 🔒 safe-config-edit

> 防止 AI agent 乱写配置文件导致 OpenCode 启动崩溃

`opencode.json` 是整个 agent 工作流的核心——provider、agent、MCP 服务器、权限、自定义命令全在这一个文件里。一个字段格式写错，整个应用直接挂掉，只能手动恢复备份。

**这个 skill 强制 AI agent 每次动配置文件前走完四步安全检查**，让你再也不用 debug 坏掉的 `opencode.json`。

## 它解决的问题

AI 写代码很猛，但写配置文件很喜欢**猜格式**：

```
❌ 写 "lsp": true                         → schema 里根级别没有 lsp 字段
❌ MCP command 写成 "npx" + "args" 分离格式 → 正确的是 ["npx", "-y", "..."] 数组
❌ 不查 schema 直接加字段                     → JSON 语法对但语义错
❌ 编辑前不备份                               → 出事了只能手动恢复
```

在我手动恢复了十次 `opencode.json` 之后，编写了这个 skill。

## 四步安全流程

| 步骤 | 操作 | 原因 |
|------|------|------|
| 🔙 **备份** | 每次 edit 前运行 `backup_config.ps1` | 永远有回滚点 |
| 📋 **查 Schema** | 先读 `https://opencode.ai/config.json` | 不猜格式 |
| ✅ **验证** | 每次 edit 后用 `opencode agent list` 验证 | JSON 合法 ≠ Schema 合法 |
| 📝 **全局规则** | 首次加载时在全局 AGENTS.md 加上配置安全约束 | 永久生效 |

## 兼容性

| 工具 | 安装路径 | 状态 |
|------|---------|------|
| **OpenCode** | `~/.config/opencode/skills/` | ✅ 原生支持 |
| **Claude Code** | `~/.claude/skills/` | ✅ 原生支持 |
| **Oh-My-OpenAgent** | `~/.config/opencode/skills/` 或 `~/.claude/skills/` | ✅ 兼容 |
| **Antigravity** | 同 Claude Code skill 规范 | ✅ 兼容 |
| **Kimi Code / Kiro** | 同 Claude Code 兼容层 | ✅ 兼容 |

> 📌 Skill 文件本身是纯文本（YAML frontmatter + Markdown），不包含任何工具特定的 shell 命令或二进制依赖。所有工具的 AGENTS.md 位置和备份机制不同，Skill 内容通用，安装路径自行对应。

## 安装

### 方式 1: Skills Installer

```bash
npx skills install ala2017/MagicLamp-AI-Studio/skills/safe-config-edit
```

### 方式 2: 手动下载

```bash
# OpenCode
mkdir -p ~/.config/opencode/skills/safe-config-edit
curl -o ~/.config/opencode/skills/safe-config-edit/SKILL.md \
  https://raw.githubusercontent.com/ala2017/MagicLamp-AI-Studio/main/skills/safe-config-edit/SKILL.md

# Claude Code
mkdir -p ~/.claude/skills/safe-config-edit
cp ~/.config/opencode/skills/safe-config-edit/SKILL.md ~/.claude/skills/safe-config-edit/
```

### 方式 3: Clone 仓库

```bash
git clone https://github.com/ala2017/MagicLamp-AI-Studio.git
cp -r MagicLamp-AI-Studio/skills/safe-config-edit ~/.config/opencode/skills/
```

## 安装后验证

重启工具。让 agent "在配置文件里加个东西"，如果它先备份、查 schema、写完验证——skill 生效了。

## 真实案例（这个 skill 的由来）

| Agent 写了什么 | 结果 |
|---------------|------|
| `"lsp": true` 在根级别 | OpenCode 启动崩溃，报 `Invalid input lsp` |
| MCP 配置 `{command: "npx", args: ["..."]}` | MCP 服务器无法加载 |
| 加了不在 schema 里的 `env` 字段（应该用 `environment`） | 静默失败，MCP 不报错也不工作 |
| Google provider 的 `${GEMINI_API_KEY}` 环境变量未设置 | provider 加载失败，整个 model 列表不可用 |

> 以上案例均来自生产环境。每次修复都是：手改 → 重启 → Schema Error → 重新看文档 → 再改 → 再重启。

## License

MIT

## Author

[@ala2017](https://github.com/ala2017) — 神灯智库 SoundGenie 项目实践中提炼
