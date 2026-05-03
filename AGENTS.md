# MagicLamp-AI-Studio · AGENTS.md

## Monorepo Convention

This is the **only** Git repository for all MagicLamp AI Studio software development. Never `git init` in subdirectories. All projects live as child directories under this repo.

## Directory Routing

When scaffolding, creating, or modifying any project, enforce these rules:

| Project Type | Directory | Rule |
|-------------|-----------|------|
| VS Code extension / Chrome extension | `extensions/<name>/` | Must be installed in a host platform |
| opencode skill / Claude skill / AI agent skill | `skills/<name>/` | Must be loaded by an AI agent to function |
| CLI / desktop app / web app / script / utility | `apps/<name>/` | User runs directly — no host required |

**Judgment logic**: ask "what does it parasitize?" → has a host → extensions or skills. No host → apps.

**Never** create projects at repository root level.

## Directory Naming

The directory name `<name>` **MUST** match the project name defined in its PRD. Use `kebab-case` (lowercase, hyphens, English).

Examples:
```
PRD: "Genie AI Article Image Generator" → genie-ai-article-image-generator/
PRD: "MAGICLAMP·AI Skill Cockpit" → magiclamp-ai-skill-cockpit/
PRD: "神灯音乐工作台" → magiclampmusic/
```

If the project has a canonical English name in `package.json` or similar, use that. Otherwise derive from PRD English title.

## PRD Location

```
<category>/<name>/PRD.md
```

## File Layout Per Project

```
<category>/<name>/
├── README.md          ← project description, install, usage
├── PRD.md             ← product requirements
├── [source files...]
└── docs/              ← optional, for extensive documentation
```

---

Author: 天火义王 · Part of 神灯智库 · [MagicLamp-AI-Studio](https://github.com/ala2017/MagicLamp-AI-Studio)
