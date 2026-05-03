# MagicLamp-AI-Studio · AGENTS.md

## Monorepo Convention

This is the **only** Git repository for all MagicLamp AI Studio software development. Never `git init` in subdirectories. All projects live as child directories under this repo.

## Directory Routing

When scaffolding, creating, or modifying any project, enforce these rules:

| Project Type | Directory |
|-------------|-----------|
| VS Code extension / Chrome extension / Browser plugin | `plugins/<name>/` |
| opencode skill / Claude skill / AI agent skill | `skills/<name>/` |
| Desktop application / Web application / standalone app | `apps/<name>/` |
| CLI tool / shell script / utility / small program | `tools/<name>/` |

**Never** create projects at repository root level.

## Directory Naming

The directory name `<name>` **MUST** match the project name defined in its PRD (Product Requirements Document). Use `kebab-case` (lowercase, hyphens).

Examples:
```
PRD title: "Genie AI Article Image Generator" → genie-ai-article-image-generator/
PRD title: "MAGICLAMP·AI Skill Cockpit" → magiclamp-ai-skill-cockpit/
PRD title: "神灯音乐工作台" → magiclampmusic/ (use English name from PRD)
```

If the project already has a canonical English name used in its `package.json` or similar, use that. Otherwise derive from the PRD English title.

## PRD Location

Each project's PRD lives inside its directory:
```
plugins/<name>/PRD.md      ← definitive
```

Or in `docs/` subdirectory if the project has documentation complexity:
```
plugins/<name>/docs/PRD.md
```

## File Layout Per Project

```
apps/<name>/
├── README.md          ← project description, install, usage
├── PRD.md             ← product requirements
├── [source files...]
└── docs/              ← optional, for projects with extensive documentation
```

---

Author: 天火义王 · Part of 神灯智库 · [MagicLamp-AI-Studio](https://github.com/ala2017/MagicLamp-AI-Studio)
