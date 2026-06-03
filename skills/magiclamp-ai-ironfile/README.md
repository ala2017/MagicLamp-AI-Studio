# IronFile — 文件安全守卫

[![Python](https://img.shields.io/badge/python-3.9+-blue.svg)](https://www.python.org/)
[![Tests](https://img.shields.io/badge/tests-56%20passed-green.svg)](./tests)
[![License](https://img.shields.io/badge/license-MIT-orange.svg)](./LICENSE)

> 你一定也遇到过这种绝望时刻：AI 核心代码写到一半，会话突然断了——要不是网络波动，要不是额度溢出。当你恢复对话，几千行代码要么直接归零，要么被无情截断，要么被另一个会话踩得稀碎。

> **不是能不能修的问题——是根本无从修起。** 文件被截断了，你不知道原本完整的内容长什么样。你只能从记忆里拼回去。记忆拼不全的部分，永远没了。

> 这不是你的操作失误，也不是单一 AI 工具的偶发 Bug。而是目前的开发工具链中，普遍缺乏一道死守在 AI 与文件系统之间的底层安全闸门。

> **IronFile 就是这道闸门。** 每次 AI 执行文件写入，IronFile 强制执行"先冷备份、再行落盘、当场验证"的原子保护协议。一旦发现语法破损或文件截断，立刻无缝回滚至备份状态。不修不补，从源头杜绝任何损坏文件进入你的视线。

---

## 你正在面对的风险——不止网络波动

AI 编辑文件会失败，至少有六种不同的死法：

### 1. Token 耗尽断

AI 一次会话有 token 预算。用完了，连接就断。如果中断时 AI 正在写文件——文件可能已经写到一半被截断了。

"Claude Code 在一次中断后，5,636 行代码永久消失。"这不是杜撰——这是 [GitHub issue #11416](https://github.com/anthropics/claude-code/issues/11416)。

### 2. Agent 用错工具

一个 AI agent 的工具有十几个——Edit、Write、MultiEdit、Bash、Replace。它可能先用 Write 覆盖了整个文件，然后用 Edit 往错误的位置插入代码，然后用 Bash 跑了一个重定向。任何一步出了问题，文件就乱了。而且 agent 不知道自己出错了——它继续自信地往下写。

### 3. 上下文压缩丢状态

AI 的上下文窗口有限。工作到一半，前面的信息被压缩了——包括"文件当前是什么样的"。于是它基于过期的认知继续编辑，结果就是：插入了不该插入的内容，删了不该删的行，或者用已经不存在的 old_str 去匹配替换。

AI 自己不知道这些——它看到的上下文版本里，文件还是上次读到的那样。

### 4. 会话中断

"正在处理你的请求……""会话已过期。"你关掉 CoW，回来一看——三小时的工作只剩 60%。

不只是网络。浏览器崩溃、系统更新重启、电量耗尽关机、误关了窗口——每一次中断都是一次截断抽奖。不知道哪个文件会被抽中。

### 5. 工具本身有 bug

Kiro 有一个反复出现的 50 行截断 bug。任何超过 50 行的文件写入都可能被截掉。Trae 在重启后丢失 10-15 次更改的历史记录。Codex CLI 甚至有一个沙箱绕过漏洞（[CVE-2025-61260](https://research.checkpoint.com/2025/openai-codex-cli-command-injection-vulnerability/)），攻击者可以在 AI 编辑文件时执行任意代码。

这些不是你用得不好——这些是工具本身的缺陷。而 AI 没有文件安全机制，所以一旦触发，文件就坏了。

### 6. 并发会话互踩

你同时开了两个 AI 会话编辑同一个项目。第一个刚写完文件，第二个也打开了同一文件但读的是旧版本，然后覆盖写入——第一个会话的修改就丢了。

---

## 它不是修复工具，是防护工具

IronFile 不去修复已经被截断的文件——**它让文件根本不会被截断。**

每一次 AI 操作文件，IronFile 在后面做三件事：

```
🔒 备份文件 → ✍️ 执行写入 → ✅ 验证结果
                            ↓
                    （不对？立刻回滚备份）
```

这是铁律。**先备份，再动手，不对就回来。** 坏的被拦在写入那一步，好的才放进去。文件的完整性在写入节点就被保障了，不需要事后发现、事后抢救、事后追悔。

更完整的，是三层防线：

| 防线 | 何时触发 | 做了什么 | 防的是 |
|:---|:---|:---|:---|
| **L1 原子编辑守卫** | 每一次 Edit / Write | 备份 → 写入 → 校验文件大小+尾部完整性 → 失败自动回滚 | token耗尽、网络中断、工具bug、并发冲突|
| **L2 Git 快照** | 多文件任务开始前 | 自动 git commit，记录 SHA-256 签名 | 一批操作中任何一个环节出错，整批回退 |
| **L3 完整性扫描** | 会话启动时 | 扫描全项目：语法错误、文件截断、零字节清空、对比git HEAD | 带着上次中断的损伤上路 |

三层配合的逻辑是：

- **L1 守住了每一次写入的原子性。** 枪里每颗子弹都是好的。
- **L2 守住了整个任务的连贯性。** 不只是一发一发打，你随时可以撤回整场战斗之前的版本。
- **L3 守住了新会话的起点。** 这次回来，先告诉大家上次打完战场清干净了没有。

---

## 一分钟上手

克隆仓库并安装 IronFile：

```bash
git clone https://github.com/ala2017/MagicLamp-AI-Studio.git
cd MagicLamp-AI-Studio/skills/magiclamp-ai-ironfile
pip install -e .
```

验证：
```bash
ironfile --version
```

然后你的 AI 就可以改用安全通道了：

```bash
# 编辑文件（自动备份→写入→验证→失败回滚）
ironfile edit path/to/file.py "old code" "new code"

# 多文件任务前打 checkpoint
ironfile checkpoint "重构认证模块之前"

# 出问题了？回退
ironfile rollback

# 会话重启后扫一遍
ironfile scan
```

## Claude Agent Skill 安装

IronFile 同时以 Claude Agent Skill 分发。Skill 安装后，AI 会话自动使用 `ironfile edit` 替代原生 Edit/Write：

```bash
npx skills add path/to/magiclamp-ai-ironfile -g -y
```

或从 skills.sh 市场安装（即将上架）：

```bash
npx skills add magiclamp-ai-ironfile -g -y

---

## Git vs IronFile —— 不是一个维度的东西

Git 是版本控制的保险柜。**但保险柜的门要你手动关上。**

- Git 防的是：两周后发现改错了，查历史。
- IronFile 防的是：下一秒截断，这一秒已经有备份。

Git 需要你记得 commit。如果 AI 正在疯狂改文件、刚好改到一半 session 断了——你还没来得及 commit，那是 git 也救不了的。而 IronFile 的备份是**自动的、每一次写入都有的、立即可以回滚的**。文件写入安全的颗粒度从"任务级"变成了"写入级"。

---

## 56 个测试，覆盖三种死亡场景

```bash
pip install pytest
pytest tests/ -v
```

测试覆盖了 ASCII、UTF-8 中文、emoji、二进制文件、符号链接、截断检测、膨胀攻击、TOCTOU 竞态、checkpoint 签名防伪、完整回滚流程。

更详细的独立安全审查：[docs/security-review-2026-06-02.md](docs/security-review-2026-06-02.md)

---

## 架构

```
AI 工具                     IronFile                    文件系统
────────                   ────────                    ────────
                            ┌─ safe_edit.py  L1 原子编辑
任何 AI 编码工具 ──→        ├─ checkpoint.py L2 Git 快照   ──→ 你的文件
                            ├─ scanner.py   L3 完整性扫描
                            └─ cli.py       统一 CLI 入口
```

---

## 为什么叫 "IronFile"？

Iron = 铁。铁的价值在于不可逆的刚性——一旦冷备份写入，就是铁打的事实。你的文件也是一样：写入前已有备份，写入后当场验证，任何异常都退不回备份之前的状态。

> **"安全不是'坏了能修'，而是'根本不会坏'。"**
>
> 预防的成本（备份 + 验证，< 50ms）远低于修复的成本（2-5 分钟回溯 + 数千 token 重写 + 被污染的记忆里那些再也找不回来的逻辑）。

---

## 设计哲学（来自同一次红队对抗的教训）

> **这个项目自己的核心引擎在开发时发现了一个致命 bug：** str/bytes 类型混用使得对所有含中文/emoji 文件的编辑全部失败。也就是——IronFile 需要被 IronFile 保护，才能写出正确的 IronFile。

这是自举。这是安全工具的典型悖论。我们选择直面并解决它，而不是隐藏它。

**完整的缺陷分析、攻击向量、修复记录都在安全报告里。**

---

## 文件结构

```
magiclamp-ai-ironfile/
├── src/ironfile/      ← 核心引擎
│   ├── safe_edit.py       L1 原子编辑 (4 个自定义异常 + 7 项安全加固)
│   ├── checkpoint.py      L2 Git 快照 (SHA-256 签名 + manifest 防伪)
│   ├── scanner.py         L3 完整性扫描 (6 种文件格式)
│   └── cli.py             统一 CLI
├── tests/              ← 56 个测试，全绿
├── docs/               ← 协议规范 + PRD + 红队安全审查报告 + 营销海报
├── SKILL.md            ← Claude Agent Skill
└── README.md           ← 你正在看的
```

---

#