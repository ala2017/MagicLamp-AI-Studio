# Magic-lamp-AI-Read-aloud-Genie
# 神灯AI·灵阅 (Magic Lamp AI Reader)

AI增强型网文阅读助手 - 智能连续朗读，沉浸式阅读体验

## 功能特性

- 🔄 **智能连续阅读**: 自动跨章节续读
- 🎯 **精准内容提取**: 基于Readability.js的AI降噪技术
- 🎛️ **极简交互控制**: 侧边栏一体化操作面板
- 🎤 **多语音支持**: Web Speech API语音合成
- 📊 **个性化管理**: 自定义阅读计划与进度追踪

## 开发指南

### 安装依赖

```bash
npm install
```

### 开发模式

```bash
npm run dev
```

### 构建扩展

```bash
npm run build
```

构建完成后，`dist` 目录将包含可加载的浏览器扩展。

### 加载到浏览器

1. 打开 Chrome/Edge 浏览器
2. 访问 `chrome://extensions/` 或 `edge://extensions/`
3. 开启"开发者模式"
4. 点击"加载已解压的扩展程序"
5. 选择项目的 `dist` 目录

## 项目结构

```
src/
├── manifest.json          # 扩展配置文件
├── sidepanel.html         # 侧边栏入口HTML
├── sidepanel/             # 侧边栏UI
│   ├── main.js           # Vue应用入口
│   ├── App.vue           # 主组件
│   ├── style.css         # 全局样式
│   ├── components/       # UI组件
│   │   ├── Header.vue
│   │   ├── UrlInput.vue
│   │   ├── PlaybackControl.vue
│   │   ├── ControlPanel.vue
│   │   └── ChapterInfo.vue
│   └── store/            # 状态管理
│       └── player.js     # Pinia store
├── background/           # 后台服务
│   └── service-worker.js
└── content/              # 内容脚本
    └── content-script.js # 页面内容提取
```

## 技术栈

- **框架**: Vue 3 + Vite
- **状态管理**: Pinia
- **内容提取**: @mozilla/readability
- **语音合成**: Web Speech API
- **扩展开发**: Manifest V3

## 开发状态

- [x] 项目初始化
- [x] UI组件开发
- [x] 内容提取集成
- [x] TTS基础功能
- [x] 隐私政策文档
- [x] 语音设置界面
- [x] 连续章节阅读
- [x] 进度持久化
- [x] 性能优化 (移除切片，零延迟)
- [ ] 应用商店提交

## 文档

- [快速开始指南](QUICKSTART.md)
- [隐私政策](PRIVACY_POLICY.md)
- [应用商店提交指南](STORE_SUBMISSION.md)
- [需求规格说明](灵阅·(需求规格)V1.1.md)

## 隐私与安全

本扩展非常重视用户隐私:
- ✅ 所有数据仅存储在本地
- ✅ 不上传任何信息到服务器
- ✅ 不收集浏览历史
- ✅ 开源透明,代码可审查

详细信息请查看 [隐私政策](PRIVACY_POLICY.md)

## 许可证

MIT

