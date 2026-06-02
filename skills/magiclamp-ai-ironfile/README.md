# IronFile — AI 编程的铁布衫

[![Python](https://img.shields.io/badge/python-3.9+-blue.svg)](https://www.python.org/)
[![Tests](https://img.shields.io/badge/tests-56%20passed-green.svg)](./tests)
[![License](https://img.shields.io/badge/license-MIT-orange.svg)](./LICENSE)
[![skills](https://img.shields.io/badge/skills.sh-magiclamp–ai–ironfile-purple.svg)](https://skills.sh/)

> 你有没有过这样的瞬间——AI 正帮你改了 10 个文件，网络断了一下，回来一看，文件全是空的。

> 不是你的问题，是所有 AI 编程工具的共同缺陷。它们没有一个在写入前先备份，写入后验证文件是否完整。

> IronFile 就是解决这个问题的。它就是 AI 的文件安全中间件。

---

## 它做了什么

AI 每次编辑你的文件时，IronFile 在后面做三件事：

```
🔒 备份 → ✍️ 写入 → ✅ 验证（出问题？自动回滚备份）
```

这就是铁律。**先备份，再动手，不对就回来。**

不是事后修复——是根本不让坏文件出现。坏的被拦在写入那一步，好的才放进去。

更厉害的是三层防线：

| 防线 | 何时触发 | 做了什么 |
|:---|:---|:---|
| **L1 原子编辑守卫** | 每次 AI 写文件 | 备份 → 写入 → 校验大小和尾部 → 不对就回滚 |
| **L2 Git 快照** | 多文件任务开始前 | 自动 git commit，随时可以回退到任务前状态 |
| **L3 完整性扫描** | 会话启动时 | 扫描所有文件是否有截断、语法错误、被零字节清空 |

三层配合：**L1 防每一笔脏写，L2 防整批崩盘，L3 防带着损伤上路。**

## 一分钟上手

安装只需两行（这是神灯AI工具箱 MagicLamp-AI-Studio 的一部分）：

```bash
git clone https://github.com/ala2017/MagicLamp-AI-Studio.git
cd MagicLamp-AI-Studio/skills/magiclamp-ai-ironfile
pip install -e .
```

验证：
```bash
ironfile --version
```

然后你就可以用了：

```bash
# 编辑一个文件（自动备份→写入→验证→失败回滚）
ironfile edit path/to/file.py "old code" "new code"

# 全局替换
ironfile edit path/to/file.py "x = 1" "y = 2" --all

# 多文件任务前打一个 checkpoint
ironfile checkpoint "重构认证模块之前"

# 不对就回退
ironfile rollback

# 会话重启后扫描一遍，确认文件完好
ironfile scan
```

就这么简单。**每个 AI 项目都该有这四行命令。**

## 为什么不是 Git 就够？

Git 需要你**记得** commit。IronFile **自动**保护你每一次文件写入。

- Git 防的是"两周后发现改错了"。
- IronFile 防的是"下一秒 AI 断线，文件归零"。
- 它的备份是**自动的、立即的、随时可回滚的**。不需要你记住什么。

## 已有真实受害者

这不是杞人忧天：

- **Claude Code** — 5,636 行代码在一次中断后永久消失
- **Trae** — 10-15 次更改在重启后丢失
- **Kiro** — 50 行截断 bug 反复出现
- **Codex CLI** — 沙箱绕过漏洞，可任意执行代码

每一个都可以被 IronFile 拦截。只要 AI 通过 ironfile edit 写文件，上面的故事就不会发生。

## Claude Skill 安装（全局生效）

IronFile 已打包为 Claude Agent Skill。安装后，所有 AI 会话自动使用 ironfile edit 替代原生 Edit/Write：

```bash
npx skills add <path-to-magiclamp-ai-ironfile.skill> -g -y
```

或从 skills.sh 市场安装（即将上架）：

```bash
npx skills add <org>/magiclamp-ai-ironfile -g -y
```

## 测试

56 个测试覆盖三层防线所有关键路径：

```bash
pip install pytest
pytest tests/ -v
```

## 架构

```
AI 工具 → IronFile → 文件系统
              ├── safe_edit.py     L1 原子编辑
              ├── checkpoint.py    L2 Git 快照
              ├── scanner.py       L3 完整性扫描
              └── cli.py           统一 CLI
```

## 设计哲学

> "安全不是'坏了能修'，而是'根本不会坏'。"
>
> 预防的成本（备份+验证，<50ms）远低于修复的成本（2-5分钟+数千token+认知污染）。

## 文件结构

```
magiclamp-ai-ironfile/
├── src/ironfile/      ← 核心引擎
│   ├── safe_edit.py       L1 原子编辑
│   ├── checkpoint.py      L2 Git 快照
│   ├── scanner.py         L3 完整性扫描
│   └── cli.py             统一 CLI
├── tests/              ← 56 个测试
├── docs/               ← 协议规范 + 安全报告
├── SKILL.md            ← Claude agent skill
└── README.md           ← 你正在看的
```

## 为什么不叫"AI安全工具"？

因为它根本不在乎你是 AI 还是人类。它的立场是 **"文件安全是第一性原理"**。谁在写文件不重要，文件有没有被写坏——这个它说了算。

## 许可证

MIT — 自由使用、自由修改、自由集成。

---

**[神灯AI·IronFile](https://github.com/ala2017/MagicLamp-AI-Studio/tree/main/skills/magiclamp-ai-ironfile)** — 不是又一个工具，是你的文件�