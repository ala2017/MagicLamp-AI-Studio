# 🔒 safe-config-edit

> Prevent OpenCode startup failures caused by AI agents writing invalid config fields.

OpenCode `opencode.json` is the core config for AI agent workflows—providers, agents, MCP servers, permissions, and custom commands all live here. One malformed field and the entire app fails to launch, leaving you to manually restore from backup.

**This skill forces AI agents to follow a four-step safety protocol every time they touch a config file**, so you never have to debug a broken `opencode.json` again.

## The Problem It Solves

AI agents are great at writing code but notorious for **guessing** config formats:

```
❌ Writes "lsp": true      → invalid schema field, OpenCode crashes
❌ Writes MCP command as "npx" + "args" → wrong format, MCP doesn't load
❌ Adds fields without checking the official schema → JSON valid but semantically broken
❌ No backup before editing → recovery requires manual file restoration
```

After the tenth time restoring `opencode.json` from a stale backup, you install this skill.

## What It Does

| Step | Action | Why |
|------|--------|-----|
| 🔙 **Backup** | Runs `backup_config.ps1` before every edit | You always have a rollback point |
| 📋 **Schema Check** | Reads `https://opencode.ai/config.json` before writing | Prevents guessing field formats |
| ✅ **Validate** | Runs `opencode agent list` after each edit | Catches schema errors that JSON parse misses |
| 📝 **Global Rule** | Adds safety constraint to AGENTS.md on first load | Makes protection permanent |

## Installation

### Option 1: OpenCode Skill Installer

```bash
npx skills install ala2017/MagicLamp-AI-Studio/skills/safe-config-edit
```

### Option 2: Manual

```bash
mkdir -p ~/.config/opencode/skills/safe-config-edit
curl -o ~/.config/opencode/skills/safe-config-edit/SKILL.md \
  https://raw.githubusercontent.com/ala2017/MagicLamp-AI-Studio/main/skills/safe-config-edit/SKILL.md
```

### Option 3: Copy the repo

```bash
git clone https://github.com/ala2017/MagicLamp-AI-Studio.git
cp -r MagicLamp-AI-Studio/skills/safe-config-edit ~/.config/opencode/skills/
```

## After Installation

Restart OpenCode. The skill auto-loads whenever an agent attempts to modify any config file under `~/.config/opencode/`.

**Verification**: Ask your agent to "add something to opencode.json". If it backs up first, checks the schema, and validates after writing — the skill is working.

## How It Works

The skill registers a `description` field that tells OpenCode when to inject it:

```yaml
description: >-
  修改 OpenCode 配置文件的强制安全检查——备份→查schema→验证，防止启动失败。
  每次编辑 opencode.json / AGENTS.md / tui.json 前自动触发。
```

OpenCode's agent sees this description and loads the full skill content into context whenever a file path matching `opencode.json` or `AGENTS.md` is about to be edited. The four-step protocol becomes a hard constraint in the current conversation.

## Real-World Crash Examples This Prevents

| What the agent wrote | Why OpenCode crashed |
|---------------------|---------------------|
| `"lsp": true` | `lsp` doesn't exist at root level in schema |
| `"mcp": {"name": {"command": "npx", "args": [...]}}` | `command` must be `["npx", "-y", "..."]`, not separate `args` |
| `"tools": {"*": false}` | `tools` is deprecated; use `permission` instead |
| MCP field with `"env"` not `"environment"` | Schema requires `"environment"` for local MCP servers |

## License

MIT

## Author

[@ala2017](https://github.com/ala2017)
