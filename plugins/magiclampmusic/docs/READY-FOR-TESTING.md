# 🎉 准备测试！

> **日期**：2026-01-25  
> **状态**：✅ 所有代码已完成并编译通过  
> **下一步**：按 F5 启动调试  

---

## ✅ 编译状态

### Extension 编译
```
✅ webpack 5.104.1 compiled successfully
✅ asset extension.js 25.2 KiB
✅ 无 TypeScript 错误
```

### Webview 编译
```
✅ vite v5.4.21 building for production
✅ index.html, index.css, index.js 生成成功
✅ 无编译错误
```

---

## 🚀 如何开始测试

### 方法 1: 按 F5 调试（推荐）

1. 在 VS Code 中按 `F5`
2. 会打开一个新的 VS Code 窗口（Extension Development Host）
3. 在新窗口中：
   - 点击左侧活动栏的 Magic Lamp 图标（神灯图标）
   - 或者按 `Cmd/Ctrl + Shift + P`，输入 "Start Magic Lamp Studio"

### 方法 2: 打包安装

```bash
# 打包
npx vsce package

# 安装
code --install-extension magiclampmusic-0.0.1.vsix
```

---

## 📋 测试流程

### 第一步：验证环境检测

**预期**：
- 启动后会显示欢迎消息
- 消息中包含当前 IDE 名称（VS Code/Cursor/Antigravity）
- 如果不在 Antigravity，会提示配置 API Key

**如何测试**：
1. 按 F5 启动
2. 查看右下角的通知消息
3. 打开 Output 面板（View > Output），选择 "Extension Host"
4. 查看日志：`[Magic Lamp] Running in VS Code`

---

### 第二步：创建项目

**预期**：
- 可以点击项目选择器
- 可以创建新项目
- 项目名称显示在顶部
- 文件保存到 `.magiclamp/projects/` 目录

**如何测试**：
1. 点击侧边栏顶部的项目选择器（显示 "No Project"）
2. 点击 "+ 创建新项目"
3. 输入项目名称，例如 "测试项目"
4. 点击创建
5. 查看是否显示成功通知
6. 查看项目名称是否更新

**验证文件**：
```bash
# 在工作区根目录查看
ls .magiclamp/projects/
```

---

### 第三步：测试 AI 功能（需要配置）

#### 配置 Gemini API Key

**如果在 VS Code 中**：
1. 按 `Cmd/Ctrl + ,` 打开设置
2. 搜索 "Magic Lamp Studio"
3. 输入 Gemini API Key
4. 获取 API Key：https://makersuite.google.com/app/apikey

**如果在 Antigravity 中**：
- 无需配置，自动使用内置 API

#### 测试歌词优化

**预期**：
- 点击 "AI Optimization" 按钮
- 显示 Loading 状态
- 右侧显示 3 个优化版本

**如何测试**：
1. 点击左侧 "Lyrics Studio"
2. 在左侧输入框输入歌词
3. 点击 "AI Optimization" 按钮
4. 等待响应（约 5-10 秒）
5. 查看右侧是否显示建议

**注意**：目前 UI 是原型，AI 功能已实现但 UI 未完全连接

#### 测试风格生成

**预期**：
- 点击标签选择风格
- 点击 "Generate Suno Prompt" 按钮
- 生成符合 Suno 格式的提示词

**如何测试**：
1. 点击左侧 "Style Director"
2. 点击风格标签（Hardcore Rap, Dark Trap 等）
3. 点击 "Generate Suno Prompt" 按钮
4. 查看生成的提示词

**注意**：目前 UI 是原型，AI 功能已实现但 UI 未完全连接

---

### 第四步：测试音乐生成（需要 Suno 服务）

#### 配置 Suno 服务

**必需步骤**：
```bash
# 1. 克隆 suno-api-private
git clone https://github.com/joeseesun/suno-api-private
cd suno-api-private

# 2. 安装依赖
npm install

# 3. 配置 Token
node setup-cookie.js
# 按提示输入 JWT Token

# 4. 启动服务
npm start
# 服务运行在 http://localhost:3001
```

**获取 JWT Token**：
1. 访问 https://suno.com/create
2. 登录你的 Suno 账号
3. 按 F12 打开开发者工具
4. 切换到 Application > Cookies
5. 找到 `__clerk_db_jwt` 的值
6. 复制完整的 Token

#### 测试音频生成

**预期**：
- 可以选择模型和参数
- 点击生成按钮
- 显示生成进度
- 自动更新状态
- 完成后可以播放

**如何测试**：
1. 确保 suno-api-private 服务已启动
2. 点击左侧 "Audio Generation"
3. 输入歌词和风格提示词
4. 选择模型（推荐 V5）
5. 选择"带人声"或"纯音乐"
6. 点击"生成音乐"按钮
7. 等待生成完成（约 1-2 分钟）

**验证**：
- 生成列表中出现新卡片
- 卡片显示状态变化：排队中 → 生成中 → 完成
- 完成后显示音频 URL
- 可以点击播放按钮

#### 测试音频操作

**预期**：
- 可以播放/暂停
- 可以拖动进度条
- 可以收藏
- 可以下载
- 可以删除

**如何测试**：
1. 等待音乐生成完成
2. 点击播放按钮 ▶️
3. 拖动进度条跳转
4. 点击收藏按钮 ❤️（变红色）
5. 点击下载按钮 ⬇️
6. 点击删除按钮 🗑️

**验证下载**：
```bash
# 查看下载的文件
ls .magiclamp/audio/
```

---

## 🐛 常见问题

### 问题 1: 按 F5 后没有反应

**解决**：
1. 检查是否安装了推荐的扩展
2. 查看 Output 面板的错误信息
3. 尝试重新编译：`npm run compile`

### 问题 2: Webview 显示空白

**解决**：
1. 检查 webview 是否编译：`cd webview && npm run build`
2. 查看浏览器控制台（Help > Toggle Developer Tools）
3. 检查 CSP 错误

### 问题 3: AI 功能不工作

**解决**：
1. 检查 API Key 配置
2. 查看 Output 面板的错误信息
3. 确认网络连接正常
4. 检查 API 配额是否用完

### 问题 4: 音乐生成失败

**解决**：
1. 确认 suno-api-private 服务已启动
2. 访问 http://localhost:3001 检查服务状态
3. 检查 Suno Token 是否过期
4. 查看 suno-api-private 的日志

### 问题 5: Token 过期

**解决**：
1. 重新访问 https://suno.com/create
2. 提取新的 JWT Token
3. 运行 `node setup-cookie.js` 更新配置
4. 重启 suno-api-private 服务

---

## 📊 测试检查清单

### 基础功能
- [ ] 插件成功启动
- [ ] 显示欢迎消息
- [ ] 侧边栏正常显示
- [ ] 可以切换不同面板

### 项目管理
- [ ] 可以创建项目
- [ ] 项目名称正确显示
- [ ] 可以切换项目
- [ ] 项目文件正确保存

### AI 功能（需要 API Key）
- [ ] 歌词优化功能工作
- [ ] 风格生成功能工作
- [ ] AI 响应正常
- [ ] 错误处理正确

### 音乐生成（需要 Suno 服务）
- [ ] 服务状态检测正常
- [ ] 可以生成音乐
- [ ] 状态更新正常
- [ ] 可以播放音频
- [ ] 可以下载音频
- [ ] 可以删除音频

---

## 📝 测试报告模板

### 测试环境
- **操作系统**：Windows/Mac/Linux
- **IDE**：VS Code/Cursor/Antigravity
- **IDE 版本**：
- **Node.js 版本**：
- **插件版本**：0.0.1

### 测试结果

| 功能 | 状态 | 备注 |
|------|------|------|
| 插件启动 | ⬜ | |
| 环境检测 | ⬜ | |
| 项目创建 | ⬜ | |
| 项目切换 | ⬜ | |
| 歌词优化 | ⬜ | |
| 风格生成 | ⬜ | |
| 音乐生成 | ⬜ | |
| 音频播放 | ⬜ | |
| 音频下载 | ⬜ | |

### 发现的问题
1. 
2. 
3. 

### 改进建议
1. 
2. 
3. 

---

## 🎯 下一步开发

如果测试发现问题，我会立即修复。

如果测试通过，可以继续开发：
- Phase 4: 封面生成（即梦 API）
- Phase 5: 整合优化和导出功能

---

## 📞 需要帮助？

如果遇到问题：
1. 查看 Output 面板的日志
2. 查看浏览器控制台（Help > Toggle Developer Tools）
3. 告诉我具体的错误信息
4. 我会立即帮你解决

---

**准备好了！按 F5 开始测试吧！** 🚀
