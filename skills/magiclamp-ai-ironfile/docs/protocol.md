# Safe File Edit Protocol v1.0 (Draft)

> **一份开放的协议规范，定义 AI 编程工具如何保证文件编辑安全。**
>
> 任何 AI 工具厂商可以独立实现此协议，无需依赖 IronFile 的代码。

---

## 摘要

Safe File Edit Protocol 定义了一个最小接口：AI 工具在每次文件写入前调用一个用户配置的验证脚本（PreWrite Hook），根据脚本的退出码和输出决定是否执行写入、如何写入、以及写入后如何验证。

协议分三个合规等级，让工具可以渐进式采用。

---

## 1. 设计目标

- **最小接口**：AI 工具只需在文件写入前加一个调用点，其余逻辑由用户或社区提供
- **工具无关**：不绑定任何特定 AI 工具或实现
- **渐进式**：Iron-1 只需支持 allow/deny，Iron-3 才是完整方案
- **向后兼容**：不支持协议的旧版工具不受影响

## 2. 协议定义

### 2.1 PreWrite Hook

AI 工具在每次文件写入操作（Write / Edit / MultiEdit）执行前，调用用户配置的验证脚本。

**工具传入（stdin JSON）：**

```json
{
  "protocol": "ironfile-v1",
  "tool": "write|edit",
  "file_path": "/absolute/path/to/file",
  "content_length": 12345,
  "old_string": "text to replace",
  "new_string": "replacement text",
  "content": "full file content for write operations",
  "session_id": "abc-123",
  "timestamp": "2026-05-25T14:30:00Z"
}
```

**字段说明：**
- `protocol`: 固定为 `"ironfile-v1"`
- `tool`: `"write"` 或 `"edit"`
- `file_path`: 目标文件的绝对路径
- `content_length`: 新内容的字节长度
- `old_string`: edit 操作时提供（要替换的文本）
- `new_string`: edit 操作时提供（替换后的文本）
- `content`: write 操作时提供（完整新内容）。edit 操作时不提供（由脚本自行计算）
- `session_id`: 可选，当前 AI 会话标识
- `timestamp`: 操作时间

**脚本返回（stdout JSON）：**

```json
{
  "decision": "allow|deny|custom",
  "reason": "human-readable explanation",
  "custom_result": "result text shown to AI when decision=custom"
}
```

**退出码语义：**

| 退出码 | 含义 | 行为 |
|:---:|:---|:---|
| **0** | allow | 工具正常执行内置写入逻辑 |
| **1** | custom | 工具不执行内置写入。使用 stdout JSON 中的 `custom_result` 作为工具结果返回给 AI |
| **2** | deny | 工具阻止写入。stderr 作为错误信息返回给 AI |

### 2.2 PostWrite Hook（Iron-3 可选）

AI 工具在文件写入操作完成后调用验证脚本。

**工具传入（stdin JSON）：**

```json
{
  "protocol": "ironfile-v1",
  "hook": "postwrite",
  "tool": "write|edit",
  "file_path": "/absolute/path/to/file",
  "written_bytes": 12345,
  "session_id": "abc-123"
}
```

**退出码语义：**

| 退出码 | 含义 |
|:---:|:---|
| **0** | 验证通过 |
| **1** | 验证失败（警告，不回滚） |
| **2** | 验证失败（严重，建议回滚） |

### 2.3 SessionInit Hook（Iron-3 可选）

AI 工具在会话启动时调用完整性扫描脚本。

**工具传入（stdin JSON）：**

```json
{
  "protocol": "ironfile-v1",
  "hook": "sessioninit",
  "session_id": "abc-123",
  "workspace_root": "/path/to/project"
}
```

**退出码语义：**

| 退出码 | 含义 |
|:---:|:---|
| **0** | 所有文件完好 |
| **1** | 发现问题（警告） |
| **2** | 发现严重问题（阻止会话继续） |

---

## 3. 合规等级

### Iron-1：基础

**要求：**
- 支持 PreWrite Hook（stdin JSON + 退出码 0/2）
- `tool`, `file_path`, `content_length` 字段必须提供

**能做什么：**
- 阻止对受保护文件的写入
- 阻止超过大小限制的写入
- 阻止在非工作目录的写入

**不能做什么：**
- 无法注入自定义写入逻辑（无 exit code 1）
- 无法进行写入后验证

### Iron-2：标准（Claude Code CLI、Kiro CLI 已满足）

**要求：**
- 支持 PreWrite Hook（stdin JSON 完整字段 + 退出码 0/1/2）
- `old_string`, `new_string`, `content` 字段按需提供

**能做什么：**
- Iron-1 全部能力
- 注入自定义安全写入逻辑（备份→写入→验证→回滚）
- fettle 模式：先自行写入，再 deny 内置工具

### Iron-3：完整

**要求：**
- Iron-2 全部要求
- PostWrite Hook（写入后验证）
- SessionInit Hook（会话启动扫描）

**能做什么：**
- Iron-2 全部能力
- 写入后自动验证
- 会话启动自动检测上次中断导致的文件损坏

---

## 4. 参考实现

IronFile（`github.com/magiclamp-ai/ironfile`）是本协议的参考实现。它提供了：

- `ironfile hook --mode=prewrite` — PreWrite Hook 处理器
- `ironfile hook --mode=postwrite` — PostWrite Hook 处理器
- `ironfile hook --mode=sessioninit` — SessionInit Hook 处理器
- `ironfile scan` — 独立的完整性扫描 CLI

工具厂商可以参考 IronFile 的实现来了解协议的具体工作方式，也可以直接推荐用户安装 IronFile 作为 hook 处理器。

---

## 5. 已支持协议的工具

| 工具 | 合规等级 | Hook 机制 | 配置方式 |
|:---|:---:|:---|:---|
| Claude Code CLI | Iron-2 | PreToolUse | `.claude/settings.json` |
| Kiro CLI | Iron-2 | preToolUse | Agent config JSON |

---

## 6. 如何为你的工具实现此协议

### 如果你在开发 AI 编程工具：

**最小实现（Iron-1）：**

1. 在文件写入函数入口处，检查用户是否配置了 `prewrite_hook_command`
2. 如果有，将操作上下文序列化为 JSON，通过 stdin 传给 hook 命令
3. 等待 hook 命令退出，检查退出码
4. 退出码 0 → 继续原生写入；退出码 2 → 中止并返回错误

**代码骨架（伪代码）：**

```python
def write_file(filepath, content):
    hook_cmd = config.get("prewrite_hook_command")
    if hook_cmd:
        input_json = json.dumps({
            "protocol": "ironfile-v1",
            "tool": "write",
            "file_path": filepath,
            "content_length": len(content),
            "content": content
        })
        result = subprocess.run(hook_cmd, input=input_json,
                                capture_output=True, text=True)
        if result.returncode == 2:
            raise WriteBlocked(result.stderr)
        elif result.returncode == 1:
            # custom — hook 已自行写入
            return result.stdout
        # returncode == 0 — 继续原生写入

    # 原生写入逻辑
    with open(filepath, 'w') as f:
        f.write(content)
```

**配置格式建议（`.toolrc` 或类似）：**

```json
{
  "hooks": {
    "prewrite": "ironfile hook --mode=prewrite"
  }
}
```

---

## 7. 版本历史

| 版本 | 日期 | 变更 |
|:---|:---|:---|
| v1.0-draft | 2026-05-25 | 初始草案。定义 PreWrite/PostWrite/SessionInit + Iron-1/2/3。 |

---

## 8. 许可证

本协议规范采用 [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/) 许可。任何人都可以自由实现、修改、扩展本协议，无需授权。
