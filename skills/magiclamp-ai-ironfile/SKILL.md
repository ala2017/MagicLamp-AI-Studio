---
name: magiclamp-ai-ironfile
description: "IronFile - AI file safety middleware. Use ironfile edit for safe file editing (backup-write-verify-rollback). Run checkpoint before multi-file tasks. Run scan on session start. NEVER skip this skill when editing, writing, or refactoring files."
---

# magiclamp-ai-ironfile

神灯AI·IronFile —— 通用 AI 编程文件安全中间件。三层防线保护你的每一行代码。

## 核心铁律

你（AI 会话中的 Claude）必须将 IronFile 作为所有文件写入操作的默认通道。这是安全底线，不可绕过。

## 三层防线

### L1 — 原子编辑守卫（每次写入自动触发）

**触发时机**：每次使用 Edit / Write 工具修改文件

**命令**：
```bash
ironfile edit <filepath> "<old_str>" "<new_str>"
ironfile edit <filepath> --old-file /tmp/old.txt --new-file /tmp/new.txt
ironfile edit <filepath> "<old_str>" "<new_str>" --all  # 全局替换
```

**工作原理**：
1. 备份 → 验证 old_str 存在 → 写入新内容 → 验证文件大小和尾部完整性 → 失败则自动回滚
2. 写入后文件大小/尾部与预期不符 → 自动从备份恢复原文件
3. 备份使用 UUID 命名（防止并发冲突），成功编辑后自动清理

**约束**：
- old_str 最大 1MB，new_str 最大 50MB
- 单文件最大 500MB
- 文件膨胀最多 50 倍（防止注入垃圾数据）
- 符号链接会被检测并警告

### L2 — Git 快照（多文件任务前手动触发）

**触发时机**：开始一个涉及多个文件修改的复杂任务前

**命令**：
```bash
ironfile checkpoint "任务描述"    # 创建快照
ironfile checkpoints              # 查看历史快照
ironfile rollback                 # 回退到最近快照（需要确认）
ironfile rollback <hash> --force  # 无条件回退到指定 commit
```

每个 checkpoint 会在 `.ironfile/checkpoints.json` 中记录 SHA-256 签名，防止伪造。

### L3 — 完整性扫描（会话启动/恢复时触发）

**触发时机**：每次会话开始时自动运行

**命令**：
```bash
ironfile scan                     # 扫描当前项目
ironfile scan --fix               # 自动从 git HEAD 恢复损坏文件
ironfile scan --verbose           # 显示所有文件状态
```

检测内容：Python 语法错误、JSON 解析错误、HTML 结构完整、JS/CSS 大括号匹配、文件大小对比 git HEAD。

## 使用流程

### 日常编码
```
1. 编辑文件：ironfile edit path/to/file.py "old" "new"
2. 重复编辑...
3. 完成后：ironfile checkpoint "今天完成了 X 功能"
```

### 多文件任务
```
1. ironfile checkpoint "重构认证模块之前"
2. 多个 ironfile edit ... 操作
3. ironfile checkpoint "重构认证模块完成"
```

### 会话恢复
```
1. ironfile scan          # 检查上次会话中断没损坏文件
2. 如果发现问题：
   ironfile scan --fix    # 从 git HEAD 恢复
   或
   ironfile rollback      # 回退到上次 checkpoint
```

## 错误处理

遇到以下 IronFile 错误时的处理策略：

| 错误类型 | 含义 | 正确的做法 |
|:---|:---|:---|
| `OldStringNotFound` | old_str 在文件中不存在 | 重新读取文件，确认当前内容后再试 |
| `OldStringAmbiguous` | old_str 出现多次 | 添加更多上下文使 old_str 唯一，或用 --all |
| `TruncationSuspected` | 文件缩小超过阈值 | 检查 old_str 是否写错了（可能匹配到太多内容） |
| `WriteVerificationFailed` | 写入后验证失败 | 文件已自动回滚——检查磁盘空间和权限 |
| `IronFileError: 备份失败` | 无法创建备份 | 检查磁盘空间和 `.ironfile/` 目录权限 |
| `CheckpointVerificationError` | checkpoint 签名不符 | manifest 可能被篡改——用 git log 手动查找 |

**重要**：遇到 `OldStringNotFound` 时，不要放弃——先重新读取文件，确认当前内容，再构造准确的 old_str 重试。绝不能在不知道文件当前内容的情况下反复尝试 Edit。

## 安装前提

IronFile 是神灯AI工具箱（MagicLamp-AI-Studio）的一部分，位于 `skills/magiclamp-ai-ironfile/` 子目录下。

用户应先克隆主仓库并本地安装：

```bash
git clone https://github.com/ala2017/MagicLamp-AI-Studio.git
cd MagicLamp-AI-Studio/skills/magiclamp-ai-ironfile
pip install -e .
```

安装后验证：
```bash
ironfile --version
```

如果未安装，提醒用户按上述