# OpenCode 配置编辑系统级指令

## 🔧 配置文件编辑标准流程

### ⚠️ 关键约束：禁止依赖 edit 工具

**错误用法**：
```
Read file → edit(text) → 再次错误提示 → 重复read → edit失败
```

**正确用法**：
```python
import json

# 1. 直接读取
with open('opencode.json', 'r', encoding='utf-8') as f:
    config = json.load(f)

# 2. 直接修改
config['compaction']['reserved'] = 98304

# 3. 直接写回
with open('opencode.json', 'w', encoding='utf-8') as f:
    json.dump(config, f, indent=2, ensure_ascii=False)
```

## 🚫 禁止的操作模式

### 1. 禁止重复 read + edit 循环
```
❌ read(a) → edit(a) → 错误提示 → read(a) → edit(a) → ...
✅ 直接使用Python脚本操作JSON
```

### 2. 禁止在 bash 中创建复杂字符串
```
❌ print(f"复杂字符串\twith\t特殊字符\t{variable}")
✅ print('Simple string', variable)
```

### 3. 禁止混合路径格式
```
❌ path = 'C:\Users\...\opencode.json'
✅ path = r'C:\Users\...\opencode.json'
✅ path = 'C:/Users/.../opencode.json'
```

### 4. 禁止使用 Windows 不支持的 Unicode
```
❌ print('✅', '❌', '⚠️')
✅ print('[OK]', '[FAIL]', '[WARNING]')
```

## 📂 文档存储规则

### ⚠️ 强制要求：默认存储在项目目录

**默认规则**：
> 如果用户没有特殊指定存储位置，必须将生成的文档存储在当前项目根目录下

**正确用法**：
```python
import os

# 获取当前项目目录
project_root = os.getcwd()

# 默认存储位置：项目根目录
default_path = os.path.join(project_root, 'document.md')

# 如果用户指定了路径，使用用户的指定
if user_specified_path:
    output_path = user_specified_path
else:
    output_path = default_path

# 写入文件
with open(output_path, 'w', encoding='utf-8') as f:
    f.write(content)
```

**错误用法**：
```
❌ 默认存储在系统目录 (如 ~/.config/opencode/)
❌ 默认存储在临时目录
❌ 默认存储在工具指定目录
✅ 默认存储在项目根目录
```

**示例对比**：
```python
# user asks: "生成一个技术文章"
# 默认行为：
project_root = os.getcwd()  # 例如：F:\=神灯智库\- 神灯AI·app\-神灯AI·高效阅读和专家学习系统
output_path = os.path.join(project_root, 'TECHNICAL_ARTICLE.md')

# user asks: "生成文档，保存到 docs/ 目录"
# 用户指定行为：
output_path = os.path.join(project_root, 'docs', 'DOCUMENT.md')
```

**例外情况**：
- **系统配置类文档**：如 OpenCode 配置修复脚本、最佳实践指南等，可以存储在相应系统目录
- **临时调试文件**：如日志、测试输出等，可以使用临时目录
- **用户明确指定路径**：优先级最高，直接使用用户指定的路径

**规则优先级**：
1. **用户明确路径**（最高优先级）
2. **当前项目根目录**（默认行为）
3. **系统默认目录**（仅限配置类文档）

## ✅ 强制要求的标准配置编辑流程

### Step 1: 备份文件
```bash
python -c "import shutil, datetime; ts=datetime.datetime.now().strftime('%Y%m%d-%H%M%S'); shutil.copy2('opencode.json', f'opencode.json.bak-{ts}')"
```

### Step 2: Python 脚本配置修改
```python
import json

# 读取
with open('opencode.json', 'r', encoding='utf-8') as f:
    config = json.load(f)

# 修改核心字段
config['compaction']['reserved'] = 98304
config['provider']['lmstudio']['models']['google/gemma-4-e4b-it']['limit']['context'] = 131072

# 写回
with open('opencode.json', 'w', encoding='utf-8') as f:
    json.dump(config, f, indent=2, ensure_ascii=False)
```

### Step 3: 验证修改
```python
import json
with open('opencode.json', 'r', encoding='utf-8') as f:
    result = json.load(f)

assert result['compaction']['reserved'] == 98304
print('[OK] Configuration validated')
```

## 🎯 性能指标要求

| 指标 | 目标值 | 当前最佳实践 |
|------|--------|--------------|
| 配置修改成功率 | >95% | 100% (Python直接操作) |
| Token消耗/次 | <200 | <100 |
| 编辑耗时 | <10秒 | <5秒 |
| 备份可靠性 | 100% | 100% |

## 🚨 紧急修复模板

### 当遇到 edit 工具问题时：
```python
import json, shutil

# 紧急备份
shutil.copy2('opencode.json', 'opencode.json.emergency-bak')

# 直接修复
with open('opencode.json', 'r') as f:
    data = json.load(f)

# 修复具体问题
with open('opencode.json', 'w') as f:
    json.dump(data, f, indent=2)

print('[OK] Emergency fix completed')
```

## 📋 配置文件一致性检查清单

- [ ] JSON 语法正确
- [ ] Schema 字段存在
- [ ] 编码为 UTF-8
- [ ] 使用官方认可的字段名
- [ ] 数值类型正确
- [ ] 路径格式统一为正斜杠
- [ ] 无重复键名
- [ ] 备份文件已创建

## 🔍 故障排除指南

### 问题：edit 工具重复要求 read
**诊断**：OpenCode 内部状态管理缺陷
**解决**：直接使用 Python 操作 JSON
**脚本**：见上方 Step 2

### 问题：PowerShell 转义错误
**诊断**：嵌套引号或特殊字符
**解决**：简化 Python 表达式，避免 f-string
**示例**：`print('value:', key)` 而非 `print(f'value: {key}')`

### 问题：路径转义错误
**诊断**：Windows 路径中的 \U 序列
**解决**：使用原始字符串 `r'...'` 或正斜杠

### 问题：编码崩溃
**诊断**：GBK vs UTF-8 冲突
**解决**：避免 Unicode 特殊字符，使用 ASCII 替代

---

**维护者**：OpenCode 系统管理员
**最后更新**：2026-04-04
**版本**：1.1
**适用**：所有 OpenCode 配置编辑场景和文档生成任务