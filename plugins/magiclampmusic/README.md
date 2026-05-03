# 🎵 神灯音乐工作台 (Magic Lamp Music Studio)

> 为 AI 原生创作者设计的一体化音乐创作 VS Code 插件

[![Version](https://img.shields.io/badge/version-0.0.1-blue.svg)](https://github.com/yourusername/magiclampmusic)
[![License](https://img.shields.io/badge/license-MIT-green.svg)](LICENSE)

---

## ✨ 特性

- 🎯 **完整工作流**：从歌词到音乐，一站式创作
- 🤖 **AI 驱动**：Gemini AI 润色歌词和生成风格
- 🎹 **Suno 集成**：支持 5 个 Suno 模型，生成专业音乐
- 🎨 **可视化界面**：直观的 UI，流畅的操作体验
- 💾 **项目管理**：本地存储，数据安全
- 🔧 **环境自适应**：自动检测 IDE 能力，智能降级

---

## 🚀 快速开始

### 安装

1. 在 VS Code 中打开扩展面板（`Cmd/Ctrl + Shift + X`）
2. 搜索 "Magic Lamp Music Studio"
3. 点击安装

或者从 VSIX 文件安装：

```bash
code --install-extension magiclampmusic-0.0.1.vsix
```

### 配置

#### 1. Gemini API（可选）

如果不在 Antigravity 中使用，需要配置 Gemini API Key：

1. 打开设置：`Cmd/Ctrl + ,`
2. 搜索：`Magic Lamp Studio`
3. 输入 Gemini API Key

获取 API Key：[Google AI Studio](https://makersuite.google.com/app/apikey)

#### 2. Suno 服务（必需）

音乐生成功能需要 suno-api-private 服务：

```bash
# 克隆项目
git clone https://github.com/joeseesun/suno-api-private
cd suno-api-private

# 安装依赖
npm install

# 配置 Token
node setup-cookie.js

# 启动服务
npm start
```

详细配置请参考：[Suno API 研究文档](docs/suno-api-research.md)

---

## 📖 使用指南

### 1. 创建项目

1. 点击侧边栏的 Magic Lamp 图标
2. 点击项目选择器
3. 选择"创建新项目"
4. 输入项目名称

### 2. 创作歌词

1. 进入 Lyrics 面板
2. 在左侧输入框输入歌词
3. 点击"AI Optimization"优化歌词（可选）
4. 选择满意的版本

### 3. 生成风格

1. 进入 Style 面板
2. 选择风格标签（Genre, Mood, Instruments）
3. 点击"Generate Suno Prompt"
4. 查看生成的提示词

### 4. 生成音乐

1. 进入 Audio 面板
2. 选择模型版本（推荐 V5）
3. 选择音乐类型（带人声/纯音乐）
4. 点击"生成音乐"
5. 等待生成完成（约 1-2 分钟）

### 5. 管理音频

- **播放**：点击播放按钮试听
- **收藏**：点击心形按钮收藏
- **下载**：点击下载按钮保存到本地
- **删除**：点击删除按钮移除

---

## 🎯 推荐环境

| 环境 | 体验 | 说明 |
|------|------|------|
| **Antigravity** | ⭐⭐⭐ 最佳 | 内置 Gemini API，零配置 |
| **Cursor** | ⭐⭐ 良好 | 需配置 Gemini API Key |
| **Windsurf** | ⭐⭐ 良好 | 需配置 Gemini API Key |
| **VS Code** | ⭐ 基础 | 需配置所有 API |

---

## 🏗️ 技术架构

```
AI IDE Layer (Antigravity/Cursor/VS Code)
    ↓
Extension Layer (TypeScript)
    - 环境检测
    - 项目管理
    - AI 服务
    - Suno 服务
    ↓
Webview Layer (React + Zustand)
    - UI 组件
    - 状态管理
    ↓
Local Services
    - suno-api-private
```

---

## 📊 功能列表

### ✅ 已实现

- ✅ 环境检测（4 种 IDE）
- ✅ 项目管理（CRUD）
- ✅ 歌词优化（AI）
- ✅ 风格生成（AI）
- ✅ 音乐生成（Suno）
- ✅ 音频播放器
- ✅ 收藏/下载/删除

### ⏳ 计划中

- ⏳ 封面生成（即梦 API）
- ⏳ 母带处理（Python）
- ⏳ 导出功能（ZIP）
- ⏳ DistroKid 上传

---

## 🐛 故障排除

### AI 功能不可用

**问题**：点击 AI 按钮没有反应

**解决**：
1. 检查是否在 Antigravity 中
2. 如果不是，检查 Gemini API Key 配置
3. 查看 VS Code 输出面板的错误信息

### 音乐生成失败

**问题**：点击生成按钮后显示错误

**解决**：
1. 检查 suno-api-private 是否运行
2. 访问 http://localhost:3001 确认服务状态
3. 检查 Suno Token 是否过期

### Token 过期

**问题**：生成失败，提示 401 错误

**解决**：
1. 重新访问 https://suno.com/create
2. 按 F12 打开开发者工具
3. 提取新的 JWT Token
4. 运行 `node setup-cookie.js` 更新配置

---

## 📚 文档

- [产品需求文档](docs/PRD.md)
- [Suno API 研究](docs/suno-api-research.md)
- [IDE 检测方案](docs/ide-detection.md)
- [测试指南](docs/TESTING-GUIDE.md)
- [开发完成报告](docs/DEVELOPMENT-COMPLETE.md)

---

## 🤝 贡献

欢迎贡献！

**可以贡献的方向**：
- 新的风格预设
- UI/UX 改进
- Bug 修复
- 文档翻译
- 功能建议

**贡献流程**：
1. Fork 项目
2. 创建功能分支
3. 提交 Pull Request

---

## 📄 许可证

MIT License - 详见 [LICENSE](LICENSE) 文件

---

## 🙏 致谢

- [VS Code Extension API](https://code.visualstudio.com/api)
- [suno-api-private](https://github.com/joeseesun/suno-api-private)
- [Gemini API](https://ai.google.dev/)
- [React](https://react.dev/)
- [Zustand](https://github.com/pmndrs/zustand)
- [TailwindCSS](https://tailwindcss.com/)

---

## 📞 联系方式

- **Issues**: [GitHub Issues](https://github.com/yourusername/magiclampmusic/issues)
- **Discussions**: [GitHub Discussions](https://github.com/yourusername/magiclampmusic/discussions)

---

**开始创作你的音乐吧！** 🎵✨
