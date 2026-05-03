# 神灯音乐工作台 - 项目文档总览

> **更新日期**：2026-01-25  
> **状态**：准备开发  

---

## 📚 文档导航

### 核心文档

1. **[PRD.md](./PRD.md)** - 产品需求文档
   - 项目愿景与战略定位
   - 为什么选择 VS Code 插件
   - 核心功能范围（MVP）
   - 用户路径与 UI 设计
   - 技术架构（含环境适配）
   - 开发路线图

2. **[suno-api-research.md](./suno-api-research.md)** - Suno API 技术研究
   - suno-api-private 项目分析
   - 认证机制与配额管理
   - API 使用示例
   - VS Code 插件集成方案
   - 成本估算与风险评估

3. **[ide-detection.md](./ide-detection.md)** - IDE 环境检测方案
   - 支持的 IDE 环境（Antigravity/Cursor/Windsurf/VS Code）
   - 环境检测实现
   - AI 能力适配层
   - 配置界面设计
   - 测试策略

4. **[implementation-checklist.md](./implementation-checklist.md)** - 实现清单
   - 分阶段开发任务
   - 技术债务管理
   - 关键决策记录
   - 风险与缓解措施
   - 成功指标

5. **[NEXT-STEPS.md](./NEXT-STEPS.md)** - 下一步开发计划 ⭐
   - 当前进度评估
   - Phase 1-3 详细任务分解
   - 时间估算（7-10 个工作日）
   - 里程碑定义
   - 立即可执行的第一步

---

## 🎯 核心设计理念

### 1. 战略定位

**赌注 AI IDE 的未来**

我们相信 AI IDE（Cursor, Windsurf, Antigravity）将成为下一代创作者的中心工作台。神灯音乐工作台要成为这个生态的一部分。

### 2. 目标用户

**AI 原生创作者**

- 已经在用 AI IDE 写提示词
- 熟悉 ChatGPT/Claude 的工作流
- 需要一个统一的音乐创作工作台
- 重视数据隐私（本地优先）

### 3. 技术优势

**复用 AI IDE 能力**

```
AI IDE 内置能力
    ↓
神灯音乐插件（适配层）
    ↓
用户本地服务（suno-api-private）
    ↓
完整的音乐创作流程
```

### 4. 分发策略

**开源 + 零成本**

- Marketplace 一键安装
- 用户自己的环境，自己的数据
- 社区可以 Fork 和定制
- 可持续的开源项目

---

## 🏗️ 技术架构

### 分层设计

```
┌─────────────────────────────────────────────┐
│   AI IDE Layer (Antigravity/Cursor/VS Code)│
│   - Gemini API (内置，优先使用)             │
│   - Python 环境 (内置)                      │
│   - 文件系统 (内置)                         │
└─────────────────────────────────────────────┘
                    ↕
┌─────────────────────────────────────────────┐
│   神灯音乐插件 (Extension)                  │
│   - 环境检测与能力适配                      │
│   - 音乐工作流 UI (Webview)                 │
│   - 项目状态管理                            │
└─────────────────────────────────────────────┘
                    ↕
┌─────────────────────────────────────────────┐
│   用户本地服务                              │
│   - suno-api-private (用户自己运行)         │
│   - Python 脚本 (插件提供，可选)            │
└─────────────────────────────────────────────┘
```

### 技术栈

**前端 (Webview)**
- React 18 + TypeScript
- Vite (构建工具)
- TailwindCSS (样式)
- Zustand (状态管理)
- Framer Motion (动画)

**后端 (Extension Host)**
- TypeScript
- VS Code Extension API
- Node.js 子进程管理

**外部服务**
- Suno API (音乐生成)
- Gemini API (文本/图像生成)
- 即梦 API (封面生成)

---

## 🎵 核心功能

### MVP 阶段

1. **Lyrics** - 歌词编辑器 + AI 润色
2. **Style** - AI 风格提示词生成
3. **Audio** - Suno 音乐生成 + 播放
4. **Artwork** - 即梦封面生成
5. **Export** - 一键导出资源包

### Post-MVP

1. **Mastering** - 智能母带处理
2. **Factory Toolkit** - 母带特征提取工具
3. **DistroKid** - 自动上传发行

---

## 🚀 开发路线

### Phase 1: 骨架与 UI (Days 1-2)
- 环境检测模块
- 基础架构
- 项目管理

### Phase 2: 文本流 (Days 3-4)
- AI 能力适配层
- 歌词面板
- 风格面板

### Phase 3: 音频流 (Days 5-7)
- Suno 服务集成
- 音频面板 UI
- 音频播放器

### Phase 4: 本地处理与图像 (Days 8-10)
- 母带处理（可选）
- 封面生成

### Phase 5: 整合与优化 (Days 11+)
- 导出功能
- 错误处理
- UI 美化
- 文档完善

### Phase 6: 发布与推广 (Days 12+)
- 发布到 Marketplace
- 推广与反馈收集

---

## 🔑 关键决策

### 为什么选择 VS Code 插件？

1. **战略定位**：赌注 AI IDE 的未来
2. **目标用户**：AI 原生创作者
3. **技术优势**：复用 IDE 内置能力
4. **分发策略**：开源 + 零成本
5. **可扩展性**：社区驱动

### 为什么使用 suno-api-private？

1. **更稳定**：JWT Token 认证（vs Clerk session）
2. **成本更低**：无需 2Captcha 付费服务
3. **本地优先**：数据隐私，用户掌控
4. **符合生态**：VS Code 插件的设计理念

### 为什么优先适配 Antigravity？

1. **内置 Gemini**：无需用户配置 API Key
2. **Python 环境**：母带处理无需额外安装
3. **最佳体验**：零配置启动
4. **战略合作**：可能的官方推荐

---

## 📊 支持矩阵

| 功能 | Antigravity | Cursor | Windsurf | VS Code |
|------|-------------|--------|----------|---------|
| 歌词润色 | ✅ 内置 | ⚠️ 需配置 | ⚠️ 需配置 | ⚠️ 需配置 |
| 风格生成 | ✅ 内置 | ⚠️ 需配置 | ⚠️ 需配置 | ⚠️ 需配置 |
| 音乐生成 | ✅ 本地服务 | ✅ 本地服务 | ✅ 本地服务 | ✅ 本地服务 |
| 封面生成 | ✅ API | ✅ API | ✅ API | ✅ API |
| 母带处理 | ✅ 内置环境 | ✅ 内置环境 | ⚠️ 需检测 | ⚠️ 需安装 |

---

## ⚠️ 风险与缓解

| 风险 | 影响 | 概率 | 缓解措施 |
|------|------|------|----------|
| Suno API 变更 | 高 | 中 | 关注社区更新，准备备选方案 |
| Antigravity API 不稳定 | 中 | 低 | 提供降级方案（用户 API Key） |
| 用户配置复杂 | 中 | 高 | 详细教程 + 自动检测 + 友好提示 |
| 性能问题 | 中 | 中 | 代码分割 + 懒加载 + 缓存 |

---

## 📈 成功指标

### MVP 阶段
- ✅ 在 3 个 IDE 环境中正常运行
- ✅ 完整的音乐创作流程
- ✅ 10 分钟内完成首次配置
- ✅ 代码覆盖率 > 60%

### 发布后
- 🎯 Marketplace 安装量 > 100
- 🎯 GitHub Stars > 50
- 🎯 用户反馈 > 10 条
- 🎯 无严重 Bug

---

## 🤝 贡献指南

欢迎社区贡献！

**可以贡献的方向**：
- 新的风格预设
- 母带处理算法
- UI/UX 改进
- 文档翻译
- Bug 修复

**贡献流程**：
1. Fork 项目
2. 创建功能分支
3. 提交 Pull Request
4. 等待 Review

---

## 📞 联系方式

- **GitHub Issues**: [项目地址]
- **讨论区**: [Discussions]
- **邮件**: [联系邮箱]

---

## 📝 更新日志

### 2026-01-25 (下午)
- ✅ 完成 PRD 文档（含战略定位）
- ✅ 完成 Suno API 技术研究
- ✅ 完成 IDE 环境检测方案
- ✅ 完成实现清单
- ✅ 检查代码进度
- ✅ 制定详细开发计划（NEXT-STEPS.md）
- ✅ 项目准备就绪，开始开发

---

## 🚀 立即开始

**当前状态**：Phase 0 完成，UI 原型已搭建

**下一步**：Phase 1 - 基础架构（预计 2-3 天）

**第一个任务**：实现环境检测模块

```bash
# 创建文件
mkdir -p src/utils/__tests__
touch src/utils/ideDetector.ts
touch src/utils/__tests__/ideDetector.test.ts

# 开始编码
code src/utils/ideDetector.ts
```

**详细计划**：查看 [NEXT-STEPS.md](./NEXT-STEPS.md)

---
