# IronFile PRD — Product Requirements Document

**版本:** v0.2.0
**日期:** 2026-06-02
**作者:** 天火义王 + 灵芸（AI 伴侣）
**仓库:** `MagicLamp-AI-Studio/skills/magiclamp-ai-ironfile`

---

## 1. 产品定位

**IronFile 是 AI 与文件系统之间的底层安全闸门。**

它不是 AI 工具，不是 git，不是版本控制系统。它的位置很窄——就在 AI 说"我要写文件"和文件系统说"写完了"之间。用户看不到它，直到他们需要它的时候。

**一句话：终结 AI 代码无故消失、截断、损坏的时代。**

---

## 2. 为什么需要这个产品

### 2.1 问题根源

2025-2026 年的 AI 编程生态发生了根本变化：AI 不再只是"建议代码"——它直接写文件。但它继承了一个系统性缺陷：**目前的开发工具链中，普遍缺乏一道死守在 AI 与文件系统之间的底层安全闸门。**

这不是某个工具的 bug。这是整个工具链的架构盲区。AI 工具的"编辑文件"操作本质上就是一次无保护的写磁盘调用——一旦遭遇会话中断、网络波动、额度溢出、上下文压缩、并发互踩，文件直接归零或截断，没有任何补救机会。

### 2.2 六种死亡场景

| 场景 | 触发条件 | 后果 | 影响 |
|:---|:---|:---|:---|
| **Token 耗尽断** | 单次会话 token 预算用尽 | 文件写到一半被截断或零清空 | **不可逆，需人工重建** |
| **Agent 用错工具** | AI 在 Write/Edit/Bash 间误操作 | 文件被错误覆盖或插入错位 | **代码逻辑受损，难以排查** |
| **上下文压缩丢状态** | 窗口压缩后 AI 基于过期认知继续编辑 | 用不存在的 old_str 替换，或重复操作 | **产生额外损伤** |
| **会话中断** | 网络、系统、浏览器崩溃导致 session 意外终止 | 未完成写入的文件处于中间状态 | **中断时开多少文件就赌多少次命** |
| **工具自身 bug** | 各 AI 工具存在的已知缺陷 | Kiro 50 行截断、Trae 重启丢历史、Codex 沙箱绕过 | **非用户可控** |
| **并发会话互踩** | 两个 AI 会话同时编辑同一项目 | 后写入的覆盖先完成的 | **静默丢失** |

### 2.3 已有受害者

- **Claude Code** ([issue #11416](https://github.com/anthropics/claude-code/issues/11416)) — 5,636 行代码在一次中断后永久消失
- **Trae** ([issue #767](https://github.com/Trae-AI/Trae/issues/767)) — 重启后丢失 10-15 次更改
- **Kiro** ([issue #4626](https://github.com/kirodotdev/Kiro/issues/4626)) — 50 行写入限制导致反复截断
- **Codex CLI** ([CVE-2025-61260](https://research.checkpoint.com/2025/openai-codex-cli-command-injection-vulnerability/)) — 沙箱绕过漏洞，攻击者可借文件写入执行任意代码

### 2.4 为什么 Git 不够

Git 的粒度是 commit——人决定的。IronFile 的粒度是每次写入——自动的。

| | Git | IronFile |
|:---|:---|:---|
| 触发 | 手动 commit | 每次 AI 写入文件自动执行 |
| 回滚粒度 | commit 级别 | 单次写入级别 |
| 失效场景 | 如果中断发生在 commit 之前 | **不存在这个时序——备份在写入之前** |
| 事后验证 | 无 | 写入后验证文件大小+尾部完整性 |

---

## 3. 目标用户

### 3.1 首要用户

**任何使用 AI 编程工具且关心文件安全的人。** 不论是专业开发者还是用 AI 辅助写脚本的非技术人员——只要是 AI 在写文件，就需要 IronFile。

### 3.2 使用场景

- 日常 AI 辅助编码（单文件编辑保护）
- 多文件穿梭任务（checkpoint → 多次编辑 → checkpoint）
- 长 session 中断后恢复（scan → fix/rollback）
- CI/CD 中 AI 自动生成代码的安全校验

### 3.3 用户画像

- **天火**（产品设计者）：设计理念驱动，不写代码，需要中间件替 AI 兜底
- **AI 重度用户**：每天多 session 多项目，中断频繁
- **AI 编程工具开发者**：想在自己的工具里集成文件安全协议

---

## 4. 核心功能

### 4.1 L1 — 原子编辑守卫

**位置：** `safe_edit.py`
**触发时机：** 每一次文件写入
**流程：**

```
🔒 备份原文件（UUID 命名防冲突）
  ↓
✍️ 执行替换（验证 old_str 唯一存在）
  ↓
✅ 验证文件大小 + 尾部完整性
  ↓
（不对？自动回滚备份）
```

**安全加固：**
- str/bytes 类型统一为 bytes 比较（防中文字符编辑失败）
- 备份失败=硬错误（不备份不写入）
- TOCTOU 守卫（写入前二次验证文件未被外部修改）
- 膨胀检测（文件最多膨胀 50 倍，防止注入垃圾数据）
- 截断预警（移除 10KB 豁免阈值，所有大小文件同保护）
- 符号链接检测并警告
- 参数大小限制（old_str ≤ 1MB, new_str ≤ 50MB, 文件 ≤ 500MB）

### 4.2 L2 — Git 快照

**位置：** `checkpoint.py`
**触发时机：** 多文件任务开始前（用户/ AI 主动调用）

**增强：**
- `.ironfile/checkpoints.json` manifest 带 SHA-256 签名
- rollback 需确认（或 `--force` 跳过）
- 签名防伪——通过 git log --grep 的 fallback 只是后备方案

### 4.3 L3 — 完整性扫描

**位置：** `scanner.py`
**触发时机：** 会话启动时

**检测范围：**
| 文件类型 | 检测方法 |
|:---|:---|
| `.py` | `py_compile` 语法校验 |
| `.js`, `.ts` | `node -c` / `tsc --noEmit` + 大括号匹配 fallback |
| `.html` | 标签闭合检测（`</html>`, `</body>`, `<script>`, `<style>`） |
| `.css` | 大括号平衡计数 |
| `.json` | `json.load()` 解析验证 |
| 所有 | vs git HEAD 文件大小对比（检测截断/零字节清空） |

**修复机制：** `--fix` 从 git HEAD 恢复前，先自动备份当前（损坏的）文件。

---

## 5. 技术架构

```
AI 编码工具层    (Claude Code, Cursor, Trae, Kiro...)
     │
 IronFile 中间件层
     ├── L1 safe_edit.py     原子编辑引擎
     ├── L2 checkpoint.py    Git 快照管理
     ├── L3 scanner.py        完整性扫描
     └── cli.py              统一 CLI 入口
     │
  文件系统层
```

### 5.1 Safe File Edit Protocol

IronFile 同时是一份开放协议（`docs/protocol.md`），定义了三个合规等级：

| 等级 | 要求 | 已支持工具 |
|:---|:---|:---|
| Iron-1（基础） | PreWrite hook + 退出码 0/2 | 待推动 |
| Iron-2（标准） | PreWrite + 退出码 0/1/2 + stdin JSON 完整字段 | Claude Code, Kiro |
| Iron-3（完整） | PreWrite + PostWrite + SessionInit | 待实现 |

### 5.2 Claude Agent Skill

IronFile 同时以 Claude Agent Skill 分发（`skill/magiclamp-ai-ironfile/SKILL.md`），安装后 AI 会话自动使用 `ironfile edit` 替代原生 Edit/Write。Python 包负责执行，skill 负责指令。

---

## 6. 性能目标

| 指标 | 目标 | 备注 |
|:---|:---|:---|
| L1 edit 延迟 | < 50ms（常规文件） | 备份 + 验证的额外开销 |
| L3 scan 延迟 | 项目级秒级完成 | 不逐文件 subprocess（多进程并行） |
| 内存占用 | < 200MB | 大文件仅依赖 L2/L3 |

---

## 7. 非功能需求

### 7.1 可靠性

- 单次写入的出错概率等于 IronFile 自身的 bug 概率——而非 AI 工具的中断概率
- 自举悖论：IronFile 自身的源码修改也必须走 ironfile edit（`CLAUDE.md` 中的强制规则）

### 7.2 安全性

- 2026-06-02 完成完整红队对抗审查（15 项缺陷，全部修复验证通过）
- 安全审查报告：`docs/security-review-2026-06-02.md`

### 7.3 兼容性

- Python 3.9+
- 平台无关（Linux/macOS/Windows）
- 不依赖任何特定 AI 工具
- 不依赖任何特定语言的项目（只检测语法的部分按后缀路由）

### 7.4 可测试性

- 56 个 pytest（覆盖 ASCII / UTF-8 / emoji / 二进制 / 符号链接 / 截断 / 膨胀 / TOCTOU / checkpoint 签名 / 回滚）
- `pytest tests/ -v` 一次性验证全部功能

---

## 8. Roadmap

| 阶段 | 版本 | 目标 | 状态 |
|:---|:---|:---|:---:|
| **Phase 1** | v0.2.0 | Python CLI 实现 + 红队审查修复 + Claude Skill 打包 | ✅ 完成 |
| **Phase 2** | v0.3.0 | FUSE 透传引擎 (通用文件系统层拦截) + `ironfile hook` 子命令 | 📋 计划 |
| **Phase 3** | v0.5.0 | PostWrite Hook + SessionInit Hook 完整实现 | 📋 计划 |
| **Phase 4** | v1.0.0 | PyPI 发布 + 正式文档站 + 更多工具集成 | 📋 计划 |
| **长期** | - | Safe File Edit Protocol 推动为 AI 工具行业标准 | 📋 愿景 |

---

## 9. 成功指标

- **IronFile 自身退出条件：** 所有主流 AI 编程工具内置了 Iron-3 级别的文件安全保护。届时 IronFile 作为中间件的独立价值归零——使命完成。
- **在此之前：** 所有使用 IronFile 的用户，不会因为 AI 会话中断而丢失代码。一次都没有。

---

## 10. 品牌基础

| 元素 | 值 |
|:---|:---|
| 品牌名 | IronFile / 神灯AI·IronFile |
| CLI 命令 | `ironfile` |
| PyPI 包名 | `ironfile` |
| Tagline | 铁一样的文件不会碎 / Never lose code to a dead session again |
| 名源 | Iron（铁）+ File（文件）— 即使碎了，每一块碎铁也还是铁 |
| 所属 | 神灯AI工具箱（MagicLamp-AI-Studio） |

---

## 11. 依赖关系

- IronFile → 神灯AI·灵音（SoundGenie）：IronFile 从灵音的内部脚本独立而来，灵音是第一个验证项目
- IronFile → MagicLamp-AI-Studio：共享品牌和哲学体系，随单仓库发布
- Safe File Edit Protocol → IronFile：协议独立于实现，任何工具可独立采纳

---

*本文档是活文件。每次重大版本更新后刷新。*
