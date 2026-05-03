# MagiclampAI Redteam Skill

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Version](https://img.shields.io/badge/Version-1.0-blue.svg)](https://github.com/magiclampai/redteam-skill)
[![Status](https://img.shields.io/badge/Status-Active-success.svg)](https://github.com/magiclampai/redteam-skill)

> **AI时代的红队思维技能** - 分析优先、提问克制、智能辅助、深度洞察

---

## 📖 简介

MagiclampAI Redteam Skill 是基于全球前沿红队思维理论开发的下一代批判性思维辅助工具。

**核心哲学**：
> **"分析优先，提问克制，智能辅助，深度洞察"**

---

## 🎯 核心特性

### ✅ 分析优先（Analysis First）
- 自动扫描项目文档、源代码、配置文件
- 提取关键信息和约束条件
- 尝试自问自答可解答的问题

### ✨ 提问克制（Question Frugality）
- 单轮交互最多1-2个核心问题
- 自动合并零散问题
- 避免重复询问已有信息

### 🛠️ 智能工具
- **价值扫描器**：评估是否解决真问题
- **逻辑检查器**：检查逻辑链条完整性
- **风险雷达**：识别最大风险
- **优化器**：找出改进空间

### 📊 深度分析
- 四维度评分：价值、逻辑、风险、优化
- 结构化审查报告
- 具体可操作建议

---

## 🔬 理论基础

基于三大前沿研究成果：

### 1. 日本AI安全研究所（2024）
- **Guide to Red Teaming Methodology on AI Safety**
- 系统化测试流程
- 多层次攻防模型

### 2. AVID红队框架（2025）
- **Red Teaming is a Critical Thinking Exercise**
- 四步框架：识别、设计、执行、分析
- 批判性思维训练方法

### 3. Promptfoo工具模式
- 动态工具注册机制
- 自动化测试用例生成
- MCP Server架构

---

## 🚀 快速开始

### 安装

```bash
# 克隆仓库
git clone https://github.com/magiclampai/redteam-skill.git

# 进入目录
cd redteam-skill

# 复制到OpenCode技能目录
cp skill/SKILL.md ~/.config/opencode/skills/redteam/
```

### 使用

在 OpenCode 中触发：

```
用户: 红队审阅这本书
AI: [开始5步分析流程]
     [自动收集信息]
     [生成并合并问题]
     [深度分析]
     [输出结构化报告]
```

---

## 📚 使用场景

### 场景1：书籍/文章审阅
- 核心洞察是否独特？
- 逻辑链条是否完整？
- 差异化是否清晰？

### 场景2：PRD评审
- 需求是否真实？
- 优先级是否合理？
- 挑战核心假设

### 场景3：代码审查
- 逻辑正确性
- 边界情况
- 安全风险

### 场景4：通用批判
- 多维度评估
- 用户视角
- 风险识别

---

## 📖 输出格式

```markdown
## 红队审阅报告

### 核心问题
[1个核心问题]

### 深度分析
**价值维度**: [评分/10分]
**逻辑维度**: [评分/10分]
**风险维度**: [评分/10分]
**优化维度**: [评分/10分]

### 发现的要点
- [要点1]
- [要点2]

### 优化建议
**优先级1（关键）**: [具体建议]
**优先级2（重要）**: [具体建议]
```

---

## 📁 项目结构

```
redteam-skill/
├── README.md              # 项目说明
├── docs/
│   ├── PRD.md           # 产品需求文档
│   └── TESTING.md       # 测试文档
├── research/
│   └── 01-调研报告.md   # 理论研究
├── skill/
│   └── SKILL.md         # 核心技能定义
└── tests/
    └── test_cases.md    # 测试用例
```

---

## 🤝 贡献指南

欢迎提交Issue和Pull Request！

### 如何贡献

1. Fork本仓库
2. 创建特性分支 (`git checkout -b feature/AmazingFeature`)
3. 提交更改 (`git commit -m 'Add some AmazingFeature'`)
4. 推送到分支 (`git push origin feature/AmazingFeature`)
5. 开启Pull Request

### 代码规范

- 清晰的代码注释
- 遵循MIT License
- 测试覆盖率 >80%

---

## 📄 License

MIT License - 详见 [LICENSE](LICENSE)

---

## 🌟 致谢

- Japan AI Safety Institute - 红队方法论
- AVID Machine Learning - 批判性思维框架
- Promptfoo Team - 工具注册模式

---

## 📬 联系方式

- **Issues**: https://github.com/magiclampai/redteam-skill/issues
- **Email**: contact@magiclamp.ai
- **Website**: https://magiclamp.ai

---

**Made with ❤️ by MagiclampAI**
