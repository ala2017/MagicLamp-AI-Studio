# OpenCode 重复试错解决方案

> 让OpenCode不再在同一个坑里摔两次

## 问题

OpenCode有一个系统性缺陷：**每次会话都是"白板"，从不记住之前的失败教训**。

```
第1天：Edit工具失败 → 试错 → Python脚本成功 ✓
第2天：Edit工具失败 → 试错 → Python脚本成功 ✓
第3天：Edit工具失败 → 试错 → ... (无限循环)
```

不是能力问题，是**架构缺陷**——AI没有跨会话记忆。

## 解决方案

把最佳实践"写死"在系统配置里，让OpenCode每次启动自动加载：

### 快速使用

1. 复制 `SYSTEM_CONFIG_INSTRUCTIONS.md` 到你的OpenCode配置目录：
   ```bash
   cp SYSTEM_CONFIG_INSTRUCTIONS.md ~/.config/opencode/
   ```

2. 在 `opencode.json` 中添加引用：
   ```json
   {
     "instructions": [
       "~/.config/opencode/SYSTEM_CONFIG_INSTRUCTIONS.md"
     ]
   }
   ```

3. 重启OpenCode，规则自动生效

## 涵盖的问题

| 问题 | 症状 | 解决方案 |
|------|------|----------|
| Edit工具循环 | 永远提示"必须先读取文件" | 强制使用Python脚本 |
| 中文编码错误 | GBK/UTF-8冲突 | 统一UTF-8输出规范 |
| Agent缺失 | agent not found | 预检测脚本 |
| PowerShell转义 | 引号地狱 | 统一脚本模板 |
| 路径处理 | 反斜杠陷阱 | 强制raw string |

## 文件说明

- `SYSTEM_CONFIG_INSTRUCTIONS.md` - 核心配置文件（复制即用）
- `full-article.md` - 完整技术文章（深度分析）

## 效果

- **首次成功率**：<10% → >95%
- **时间成本**：30分钟 → 1分钟
- **心理负担**：焦虑 → 可控

## 贡献

欢迎补充更多OpenCode的"坑"和解决方案！

---

MIT License
