# Claude Code 集成指南

## 一键部署

```bash
ironfile init claude-code
```

这会在当前项目的 `.claude/` 目录下创建所需的 hook 脚本和配置。

## 手动配置

### 1. 安装 IronFile

```bash
pip install ironfile
```

### 2. 配置 PreToolUse Hook

在项目根目录的 `.claude/settings.json` 中添加：

```json
{
  "hooks": {
    "PreToolUse": [
      {
        "matcher": "Edit|Write",
        "hooks": [
          {
            "type": "command",
            "command": "ironfile hook --mode=prewrite"
          }
        ]
      }
    ],
    "PostToolUse": [
      {
        "matcher": "Edit|Write",
        "hooks": [
          {
            "type": "command",
            "command": "ironfile hook --mode=postwrite"
          }
        ]
      }
    ]
  }
}
```

### 3. 在 CLAUDE.md 中添加规则

```markdown
## File Safety Protocol

- **禁止直接使用 Edit 工具。** 所有修改通过 ironfile 执行。
- 多文件修改前打 checkpoint：`ironfile checkpoint "<描述>"`
- 会话启动时运行扫描：`ironfile scan`
```

### 4. 验证

```bash
# 测试 hook 是否生效
echo '{"tool_name":"Write","tool_input":{"file_path":"/tmp/test.txt","content":"hello"}}' | ironfile hook --mode=prewrite
```

## 工作流

### 日常使用

1. **开始工作前**：`ironfile scan`（或让 Claude 自动执行）
2. **AI 编辑文件时**：PreToolUse hook 自动备份 → AI 写入 → PostToolUse hook 自动验证
3. **多文件任务前**：告诉 Claude 执行 `ironfile checkpoint "任务描述"`
4. **出现问题时**：`ironfile rollback` 回退到最近的 checkpoint

### fettle 模式（高级）

如果你想让 IronFile 完全替换 Claude Code 的内置 Edit/Write（类似 fettle）：

1. 配置 PreToolUse hook，脚本返回 exit 1（custom）来绕过内置工具
2. hook 脚本自行执行安全写入
3. 内置工具永远不执行

这个模式更安全，但也更复杂。一般用户使用默认的 PreToolUse 保护模式即可（备份→让内置工具写入→PostToolUse 验证）。
