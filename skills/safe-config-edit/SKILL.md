---
name: safe-config-edit
description: 修改 OpenCode 配置文件的强制安全检查——备份→查schema→验证，防止启动失败。每次编辑 opencode.json / AGENTS.md / tui.json 前自动触发。
---

## 触发条件

以下任一操作必须触发本检查：

- 使用 edit/write 工具修改 `~/.config/opencode/` 下的任何文件
- 修改项目根目录的 `.opencode/` 配置
- 修改 `opencode.json` / `AGENTS.md` / `tui.json` / `oh-my-opencode-*.json`

## 强制四步安全流程

### Step 1: 备份当前配置

```powershell
& "C:\Users\aidie\.config\opencode\backup_config.ps1"
```

备份文件自动命名 `opencode.json.bak-YYYYMMDD-HHmmss`，保留最近 10 份。

### Step 2: 核查官方 Schema

访问 OpenCode 官方 schema 确认你要写入的字段格式是否合法：

```
https://opencode.ai/config.json
```

**常见错误：**
- ❌ `"lsp": true` — schema 中根级别没有 `lsp` 布尔字段
- ❌ `"command": "npx"` + `"args": ["..."]` — MCP 的 command 是数组 `["npx", "-y", "..."]`
- ❌ `"tools": {"*": false}` — 新版本 tools 已 deprecated，改用 `"permission"`

**不确定格式的字段：先查文档，不要猜。**

### Step 3: 分步写入 + 逐次验证

每次 edit 后立即用 `opencode agent list` 验证：

```powershell
opencode agent list 2>&1 | Select-String "Error|Invalid"
```

- 如果输出包含 `Error` 或 `Invalid`：回滚到上一次备份，调整后重试
- 如果输出正常：继续下一步

**仅 JSON parse 通过是不够的**——JSON 语法正确但 schema 错误一样会导致 OpenCode 启动失败。

### Step 4: 最终确认

全部修改完成后，确认以下三项：

- ✅ `opencode agent list` 无误报
- ✅ 备份文件已生成（检查 backup 目录）
- ✅ 所有新字段均已在官方 schema 中核实

## 同时执行：写入全局约束

本 skill 首次加载后，应自动在全局 AGENTS.md (`~/.config/opencode/AGENTS.md`) 中添加以下约束（如已存在则跳过）：

```markdown
## 🔧 配置文件安全

修改 `.opencode/` 或 `~/.config/opencode/` 下的配置时，必须先执行备份脚本后再改，改完用 `opencode agent list` 验证。不得凭猜测写入未查 schema 确认格式的字段。
```

**添加方式**：在 `## ⚠️ 代码修改铁律` 节之后插入，使用 edit 工具精准修改。
