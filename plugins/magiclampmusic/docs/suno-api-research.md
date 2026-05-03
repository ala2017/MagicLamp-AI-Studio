# Suno API 技术研究报告

> **项目**: joeseesun/suno-api-private  
> **研究日期**: 2026-01-25  
> **目的**: 为神灯音乐工作台选择合适的 Suno API 集成方案  

---

## 1. 项目概述

**suno-api-private** 是基于 [gcui-art/suno-api](https://github.com/gcui-art/suno-api) 的改进版本，主要解决了原版依赖 Clerk session 认证不稳定的问题。

### 核心改进

- ✅ **JWT Token 直接认证**：跳过 Clerk API，直接使用从浏览器提取的 JWT Token
- ✅ **更稳定**：解决了 Clerk API 频繁返回空 session 导致的 401 错误
- ✅ **简化配置**：提供交互式脚本自动提取和配置 Token

---

## 2. 技术架构对比

### 2.1 原版 gcui-art/suno-api

**认证方式**:
- 依赖 Clerk session cookie
- 需要 2Captcha 服务解决 hCaptcha 验证（付费）
- Session 经常失效，稳定性差

**技术栈**:
- Node.js + Express/Fastify
- 支持 Vercel 部署
- 提供完整的 REST API

**主要功能**:
- `/api/generate` - 通过 prompt 生成音乐
- `/api/custom_generate` - 自定义歌词和风格生成
- `/api/extend_audio` - 延长音频
- `/api/get` - 获取生成状态和结果
- `/api/get_limit` - 查询配额
- `/api/concat` - 合并音频片段

### 2.2 改进版 joeseesun/suno-api-private

**认证方式**:
- 直接使用 JWT Token（从浏览器 Authorization header 提取）
- 不需要 2Captcha 服务
- Token 有效期更长（几小时到几天）

**配置流程**:
```bash
# 1. 访问 https://suno.com/create 并登录
# 2. F12 打开开发者工具 → Network 标签
# 3. 触发任意 API 请求
# 4. 找到 studio-api.prod.suno.com 的请求
# 5. 复制 Authorization header 中的 JWT token
# 6. 运行配置脚本
node setup-cookie.js
```

**环境变量**:
```env
SUNO_COOKIE=__session=<JWT_TOKEN>
SUNO_2CAPTCHA_KEY=  # 可选，不需要
```

---

## 3. Suno 模型版本

| 版本 | 模型名称 | 常量名 | 说明 |
|------|---------|--------|------|
| V3.5 | chirp-v3-5 | SUNO_MODELS.V3_5 | 旧版本 |
| V4 | chirp-v4 | SUNO_MODELS.V4 | - |
| V4.5+ | chirp-bluejay | SUNO_MODELS.V4_5_PLUS | 蓝松鸦 🐦 |
| V4.5 Pro | chirp-auk | SUNO_MODELS.V4_5_PRO | 海雀 🐧 |
| V5 | chirp-crow | SUNO_MODELS.V5 | 乌鸦 🦅（默认） |

---

## 4. API 使用示例

### 4.1 生成音乐（通过 Prompt）

```javascript
const response = await fetch('http://localhost:3001/api/generate', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    prompt: "A dark hardcore rap with heavy 808 bass",
    make_instrumental: false,
    wait_audio: false,
    model: "chirp-crow"  // V5
  })
});

const data = await response.json();
// 返回: [{ id: "...", status: "queued" }, ...]
```

### 4.2 自定义生成（歌词 + 风格）

```javascript
const response = await fetch('http://localhost:3001/api/custom_generate', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    prompt: "[Verse 1]\n他们说我不够好\n他们说我该放弃\n...",
    tags: "hardcore rap, dark, 808 bass",
    title: "他们说",
    make_instrumental: false,
    wait_audio: false,
    model: "chirp-crow"
  })
});
```

### 4.3 查询生成状态

```javascript
const ids = "gen_id_1,gen_id_2";
const response = await fetch(`http://localhost:3001/api/get?ids=${ids}`);
const data = await response.json();

// 状态流转: queued → streaming → complete
if (data[0].status === 'streaming' || data[0].status === 'complete') {
  console.log('音频 URL:', data[0].audio_url);
  console.log('视频 URL:', data[0].video_url);
}
```

### 4.4 查询配额

```javascript
const response = await fetch('http://localhost:3001/api/get_limit');
const quota = await response.json();

console.log('剩余点数:', quota.credits_left);
console.log('总点数:', quota.total_credits_left);
```

---

## 5. 集成建议（针对神灯音乐工作台）

### 5.1 推荐方案：使用 suno-api-private

**理由**:
1. ✅ **更稳定**：JWT Token 认证比 Clerk session 可靠
2. ✅ **成本更低**：不需要 2Captcha 付费服务
3. ✅ **配置简单**：一次性提取 Token 即可
4. ✅ **完全兼容**：API 接口与原版一致
5. ✅ **本地优先**：符合 VS Code 插件的设计理念

### 5.2 部署方式（针对 VS Code 插件）

**推荐方案：用户本地运行（MVP）**

这是最符合 VS Code 插件生态的方案：

```bash
# 用户在本地运行 suno-api-private
git clone https://github.com/joeseesun/suno-api-private
cd suno-api-private
npm install
node setup-cookie.js  # 配置 JWT Token
npm start  # 启动在 localhost:3001
```

**优势**：
- ✅ 数据隐私：Token 和音频都在用户本地
- ✅ 零成本：不需要服务器
- ✅ 灵活性：用户可以自己修改代码
- ✅ 符合开源精神：用户掌控一切

**用户体验优化**：
```typescript
// 插件启动时检测本地服务
async function checkSunoService() {
  try {
    const response = await fetch('http://localhost:3001/api/get_limit');
    if (response.ok) {
      return { status: 'connected', ...await response.json() };
    }
  } catch (error) {
    return { 
      status: 'not_running',
      message: '请先启动 suno-api-private 服务',
      action: 'showSetupGuide'
    };
  }
}
```

**首次使用引导**：
```
┌─────────────────────────────────────┐
│  🎵 首次使用 Suno 服务              │
│                                     │
│  需要在本地运行 suno-api-private    │
│                                     │
│  [📖 查看配置教程]                  │
│  [📦 下载 suno-api-private]         │
│  [✅ 我已经启动了]                  │
│                                     │
│  配置后即可开始创作 🚀              │
└─────────────────────────────────────┘
```

### 5.3 VS Code 插件集成架构（更新版）

```
┌─────────────────────────────────────────────┐
│   AI IDE (Antigravity/Cursor/VS Code)      │
│  ┌───────────────────────────────────────┐  │
│  │  Extension Host (TypeScript)          │  │
│  │  ┌─────────────────────────────────┐  │  │
│  │  │  环境检测模块                   │  │  │
│  │  │  - 识别 IDE 类型                │  │  │
│  │  │  - 检测本地服务状态             │  │  │
│  │  └─────────────────────────────────┘  │  │
│  │  ┌─────────────────────────────────┐  │  │
│  │  │  SunoService                    │  │  │
│  │  │  - API 调用封装                 │  │  │
│  │  │  - 文件下载管理                 │  │  │
│  │  │  - 状态轮询                     │  │  │
│  │  └─────────────────────────────────┘  │  │
│  └───────────────────────────────────────┘  │
│              ↕ postMessage                  │
│  ┌───────────────────────────────────────┐  │
│  │  Webview (React)                      │  │
│  │  - Audio 面板                         │  │
│  │  - 生成按钮                           │  │
│  │  - 播放器                             │  │
│  │  - 配额显示                           │  │
│  └───────────────────────────────────────┘  │
└─────────────────────────────────────────────┘
              ↕ HTTP (localhost:3001)
┌─────────────────────────────────────────────┐
│   suno-api-private (用户本地运行)           │
│   - JWT Token 认证                          │
│   - Suno API 代理                           │
│   - 用户自己的 Suno 账号配额                │
└─────────────────────────────────────────────┘
```

**关键设计点**：

1. **本地优先**：所有数据都在用户本地，插件不需要服务器
2. **智能检测**：自动检测 suno-api-private 是否运行
3. **友好提示**：首次使用时提供详细的配置指南
4. **配额透明**：实时显示用户的 Suno 账号配额

### 5.4 代码实现示例

**Extension 端封装**:
```typescript
// src/services/sunoService.ts
export class SunoService {
  private baseUrl: string;
  
  constructor(baseUrl: string = 'http://localhost:3001') {
    this.baseUrl = baseUrl;
  }

  async generate(params: {
    prompt: string;
    tags?: string;
    title?: string;
    model?: string;
  }) {
    const response = await fetch(`${this.baseUrl}/api/custom_generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...params,
        make_instrumental: false,
        wait_audio: false
      })
    });
    return response.json();
  }

  async getStatus(ids: string[]) {
    const idsStr = ids.join(',');
    const response = await fetch(`${this.baseUrl}/api/get?ids=${idsStr}`);
    return response.json();
  }

  async pollUntilComplete(ids: string[], maxAttempts = 60) {
    for (let i = 0; i < maxAttempts; i++) {
      const data = await this.getStatus(ids);
      if (data.every(item => item.status === 'complete')) {
        return data;
      }
      await new Promise(resolve => setTimeout(resolve, 5000));
    }
    throw new Error('Generation timeout');
  }
}
```

**Webview 端调用**:
```typescript
// webview/src/components/AudioPanel.tsx
const handleGenerate = async () => {
  setLoading(true);
  
  // 通过 postMessage 调用 Extension
  vscode.postMessage({
    command: 'suno.generate',
    payload: {
      prompt: lyrics,
      tags: stylePrompt,
      title: projectName,
      model: 'chirp-crow'
    }
  });
};

// 监听 Extension 返回
window.addEventListener('message', (event) => {
  const { command, data } = event.data;
  
  if (command === 'suno.generationComplete') {
    setGenerations(prev => [...prev, ...data]);
    setLoading(false);
  }
});
```

---

## 6. 注意事项与风险

### 6.1 Token 管理

**问题**: JWT Token 会过期（几小时到几天）

**解决方案**:
1. 在插件设置中提供"更新 Token"按钮
2. 检测到 401 错误时提示用户重新配置
3. 提供详细的 Token 提取教程（带截图）

### 6.2 API 稳定性

**风险**: Suno 官方可能随时更改 API 或封禁逆向工程

**缓解措施**:
1. 在文档中明确说明这是非官方 API
2. 关注 suno-api-private 项目更新
3. 考虑支持多个 API 后端（如 gcui-art/suno-api 作为备选）

### 6.3 用户体验

**挑战**: 需要用户手动配置本地服务

**改进方向**:
1. MVP 阶段：提供详细的一键配置脚本
2. Post-MVP：考虑将 suno-api-private 打包进插件（Electron 子进程）
3. 终极方案：提供官方托管的 API 服务（需要商业化考虑）

---

## 7. 成本估算

### 7.1 Suno 官方定价（参考）

- **Free Plan**: 50 credits/day（约 10 首歌）
- **Pro Plan**: $10/月，2500 credits/月
- **Premier Plan**: $30/月，10000 credits/月

### 7.2 API 服务成本

**suno-api-private**:
- ✅ 无额外成本（不需要 2Captcha）
- ✅ 只需 Suno 账号本身的订阅费用

**gcui-art/suno-api**:
- ❌ 需要 2Captcha 服务（约 $3/1000 次验证）
- ❌ 每次生成可能触发多次验证

---

## 8. 结论与行动计划

### ✅ 推荐使用 suno-api-private

**理由总结**:
1. 认证更稳定（JWT Token vs Clerk session）
2. 成本更低（无需 2Captcha）
3. 配置更简单（一次性提取 Token）
4. API 完全兼容原版

### 📋 集成步骤（MVP Phase）

**Week 1**:
- [ ] Fork suno-api-private 到团队仓库
- [ ] 编写用户配置指南（中文 + 截图）
- [ ] 在 Extension 中实现 SunoService 封装

**Week 2**:
- [ ] 在 Audio 面板实现生成 UI
- [ ] 实现状态轮询和进度显示
- [ ] 实现音频下载和本地缓存

**Week 3**:
- [ ] 集成播放器（支持试听）
- [ ] 实现收藏/标记功能
- [ ] 错误处理和 Token 过期提示

### 🚀 未来优化方向

1. **自动化 Token 刷新**：研究 Suno 的 Token 刷新机制
2. **内置 API 服务**：将 suno-api-private 打包进插件
3. **多账号支持**：允许用户配置多个 Suno 账号轮换使用
4. **官方 API 迁移**：一旦 Suno 发布官方 API，立即迁移

---

## 9. 参考资源

- [suno-api-private GitHub](https://github.com/joeseesun/suno-api-private)
- [gcui-art/suno-api GitHub](https://github.com/gcui-art/suno-api)
- [Suno 官方文档](https://suno.com/create)
- [JWT 认证最佳实践](https://jwt.io/introduction)

---

**研究完成** ✅  
下一步：开始实现 SunoService 封装层
