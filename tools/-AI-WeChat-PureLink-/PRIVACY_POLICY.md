# 隐私政策 (Privacy Policy)

**生效日期**：2026年1月1日  
**产品名称**：神灯AI·净链 (WeChat PureLink)

---

## 1. 承诺摘要
我们非常重视您的隐私。**神灯·净链** 是一款纯本地运行的浏览器扩展，**我们不收集、不存储、不发送任何您的个人数据**。

## 2. 数据处理详情

### 2.1 浏览历史与链接数据
*   **本地处理**：本扩展的所有核心功能（包括 URL 解析、参数提取、自动跳转）完全在您的本地浏览器（Chrome/Edge）中运行。
*   **无数据上传**：我们没有服务器，扩展不会将您访问的 URL、浏览历史或任何页面内容发送给开发者或第三方。

### 2.2 权限使用说明
为了实现功能，本扩展申请了以下最小化权限，仅用于本地操作：
*   `tabs`：用于在您点击扩展图标或右键菜单时，获取当前标签页的 URL 以进行净化处理。
*   `contextMenus`：用于在浏览器右键菜单中添加“净化并打开链接”的选项。
*   `storage`：用于保存您的偏好设置（例如“是否记住上次打开方式”），这些设置仅存储在您的本地浏览器中。
*   `host_permissions` (`*://weixin110.qq.com/*` 等)：仅用于在特定的微信中转页面注入脚本，以实现自动跳转。我们不会请求访问其他无关网站的权限。

### 2.3 剪贴板使用
*   本扩展**不申请**自动读取剪贴板的权限。
*   只有当您在扩展弹窗中主动执行“粘贴”操作时，扩展才会处理您输入的内容。

### 2.4 AI 功能说明

当您使用“AI 分析/情报”功能时：

*   **本地优先**：如浏览器支持本地 AI 能力，分析会在您的设备上完成，数据不会离开您的电脑。
*   **云端可选**：仅当您主动配置第三方 API Key（例如 OpenAI / Gemini / DeepSeek 等）并触发分析时，网页文本才会发送到您指定的服务商接口。本扩展不会将数据发送给开发者或其他未配置的服务器。

## 3. 第三方服务
本扩展不包含任何第三方分析工具（如 Google Analytics）、广告 SDK 或追踪脚本。

## 4. 联系我们
如果您对本隐私政策有任何疑问，或需要查看开源代码以验证上述声明，请访问我们的项目主页。

---

## Privacy Policy (English Summary)

**Effective Date**: January 1, 2026  
**Product**: WeChat PureLink (神灯AI·净链)

We are committed to protecting your privacy. **WeChat PureLink** operates entirely locally on your device. **We do not collect, store, or transmit any of your personal data.**

*   **No Data Collection**: All URL parsing happens locally in your browser. No browsing history is sent to any server.
*   **Permissions**: We only request permissions necessary for the extension to function (accessing specific WeChat redirect pages, context menus, and local storage for settings).
*   **No Tracking**: We do not use any third-party analytics or advertising tracking.

For any questions, please check our open-source repository.
