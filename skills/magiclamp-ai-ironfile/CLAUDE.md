# CLAUDE.md

This file provides guidance to Claude when working with code in this repository.

## Project Identity

IronFile（神灯AI·IronFile）——通用 AI 编程文件安全中间件。定位：AI 编程工具与文件系统之间的安全中间件。任何 AI 工具，任何语言，任何平台。

**核心命题：** 安全不是"坏了能修"，而是"根本不会坏"。预防的成本（备份+验证，通常 <50ms）远低于修复的成本（2-5 分钟 + 数千 token + 认知污染）。

**双轨策略：**
- 轨道一：开源实现（Reference Implementation）——FUSE 透传引擎 + 工具原生钩子模板
- 轨道二：开放标准（Safe File Edit Protocol v1.0）——让 AI 工具厂商独立实现

**名源：** Iron + File —— 铁一样的文件不会碎。

## Architecture

```
src/ironfile/
├── __init__.py      — 导出 safe_edit, scan, checkpoint
├── safe_edit.py     — L1 原子编辑引擎（备份→写入→验证→回滚）
├── scanner.py       — L3 完整性扫描器（语法/结构/大小检测）
├── checkpoint.py    — L2 Git 快照管理
└── cli.py           — 统一 CLI（ironfile edit/scan/checkpoint/rollback）
docs/
├── protocol.md      — Safe File Edit Protocol v1.0 规范
└── integrations/    — 各工具集成指南
```

### Layer Design

| 层级 | 模块 | 职责 | 触发时机 |
|:---|:---|:---|:---|
| L1 | safe_edit.py | 原子编辑守卫：备份→写入→验证→失败回滚 | 每次文件写入 |
| L2 | checkpoint.py | Git 快照：pre_task_snapshot / post_task_commit | 多文件任务前后 |
| L3 | scanner.py | 完整性扫描：语法/结构/大小检测 | 会话启动 / 手动触发 |

### Custom Exceptions (safe_edit.py)

- `IronFileError` — 所有错误的基类
- `OldStringNotFound` — 原字符串在文件中不存在
- `OldStringAmbiguous` — 原字符串匹配到多处
- `TruncationSuspected` — 写入后验证发现疑似截断
- `WriteVerificationFailed` — 写入后验证失败

## Development

### Setup

```bash
cd 神灯AI_IronFile
pip install -e .
```

### Key Commands

```bash
# CLI 功能测试
ironfile edit <filepath> <old_string> <new_string>
ironfile edit <filepath> --all <old_string> <new_string>  # replace_all
ironfile scan                           # 扫描当前目录
ironfile scan --fix                     # 扫描并自动修复
ironfile checkpoint "<描述>"            # 打 Git 快照
ironfile rollback                       # 回退到最近 checkpoint
ironfile checkpoints                    # 列出所有 checkpoint

# 开发用
python -c "from ironfile import safe_edit, scan, checkpoint"
pytest tests/ -v
```

### Testing (Phase 1 待实现)

```
tests/
├── test_safe_edit.py     — 原子编辑测试（替换/回滚/编码/二进制）
├── test_scanner.py       — 扫描器测试（各语言语法/结构/截断检测）
└── test_checkpoint.py    — 快照测试（创建/回滚/列表）
```

## Critical Rules

### 自举悖论

IronFile 是一个文件安全工具，而它的开发过程本身也需要文件安全保护。这是自举问题。

**规则：**
- 在对 IronFile 自身源码做修改时，使用 `ironfile edit` 命令——ironfile 已经是一个可工作的工具
- 如果 ironfile 命令不可用（例如首次 setup 前），用 Write 工具写整文件（原子写入），绝不用 Edit 工具
- **绝对禁止**用 Edit 工具修改 IronFile 自己的 `.py` 文件——我们就是来解决这个问题的，不能自己先踩坑

### FUSE 环境警告

- Cowork 模式的嵌套 FUSE mount 不可靠（已知：写入成功返回但尾部截断、备份文件创建 PermissionError）
- 在此环境下，始终用 Write 工具（Windows host path 直通）写文件
- FUSE 引擎（Phase 2）设计时需考虑：嵌套虚拟化场景下降级到协议模式

### 性能原则

- L1 操作（备份+验证）目标：<50ms
- FUSE 普通模式写入开销：~5-15%（代码编辑场景可接受）
- 大文件（>100MB）：跳过 FUSE 层，仅依赖 L2/L3

### 设计原则

- **协议优先，底层兜底。** Safe File Edit Protocol 定义标准（厂商正道），FUSE 通用层兜底（用户的退路）
- **工具无关。** 不绑定任何特定 AI 工具
- **渐进式。** Iron-1 只需 allow/deny，Iron-3 才是完整方案
- **成功 = 被淘汰。** 如果所有工具都内置了 Iron-3 级别的保护，IronFile 的使命就完成了

## Safe File Edit Protocol

协议定义在 `docs/protocol.md`。三个合规等级：

| 等级 | 要求 | 已支持工具 |
|:---|:---|:---|
| Iron-1（基础） | PreWrite hook + 退出码 0/2 | 待推动 |
| Iron-2（标准） | PreWrite + 退出码 0/1/2 + stdin JSON 完整字段 | Claude Code CLI, Kiro CLI |
| Iron-3（完整） | PreWrite + PostWrite + SessionInit | 待实现 |

**退出码语义：** 0 = allow（原生写入）, 1 = custom（hook 已自行写入）, 2 = deny（阻止写入）

## Brand Identity

- 品牌名：IronFile / 神灯AI·IronFile
- GitHub org：magiclamp-ai
- PyPI 包名：ironfile
- CLI 命令：ironfile
- Tagline：Never lose code to a dead session again. / 再也不会因为 AI 掉线而丢代码。

## Related Projects

- **神灯AI·灵音（SoundGenie）：** IronFile 的第一个验证项目。IronFile 从灵音的内部脚本独立而来。
- 灵音 CLAUDE.md 中的文件安全协议引用 IronFile 作为正式方案，本地 `scripts/safe_edit.py` 和 `scripts/check_integrity.py` 为降级备选。
