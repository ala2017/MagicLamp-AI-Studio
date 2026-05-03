# MuseCapture 隐私与权限声明 | Privacy & Permissions Statement
更新日期 / Last Updated: 2025-12-11

## 隐私声明 / Privacy
- 我们不收集、不存储、不分享任何个人数据；所有数据仅在您的设备本地处理与保存。
- We do not collect, store, or share any personal data; all processing and storage happen locally on your device.

## 数据收集与存储 / Data Collection & Storage
- 本地存储：采集的图片、来源信息、提示词、个人设置保存在浏览器 LocalStorage/IndexedDB。
- Local Storage: Captured images, source info, prompts, and preferences are stored in the browser’s LocalStorage/IndexedDB.
- 文件系统访问（需用户授权）：您选择本地目录并授权后，插件会将图片文件、Markdown 文档与 `metadata.json` 写入该目录；仅用于个人资料管理，不上传至任何服务器。
- File System Access (user consent required): After you select and grant access to a local folder, the extension writes image files, Markdown documents, and `metadata.json` to that folder for personal library management. No server uploads.
- 剪贴板读取：仅在用户点击“粘贴”等明确操作时读取剪贴板中的图片或链接用于采集；不会后台监控或自动读取。
- Clipboard Reading: Reads images or links from the clipboard only when you explicitly click “Paste” for capture; no background monitoring.

## 远程配置与图标资源 / Remote Config & Icons
- 为提供站点快捷入口，侧边栏会从 GitHub Raw/CDN 拉取公开的站点列表与图标；不包含或发送任何个人数据。
- To power site quick-launch, the side panel fetches public site lists and icons from GitHub Raw/CDN. No personal data is included or sent.

## 第三方服务（可选） / Third-Party Services (Optional)
- Notion 同步：仅在您启用后使用，数据由浏览器直接发送至 Notion 官方 API；您的 Integration Token 仅保存在本地，不会被上传或中转。
- Notion Sync: Used only when enabled. Data is sent directly from the browser to Notion’s official API. Your Integration Token is stored locally and never uploaded or proxied.

## 权限与用途 / Permissions & Usage
- `activeTab` / `tabs`：读取当前活动标签页标题与 URL，用于生成文件名与来源链接；仅本地使用。
- `activeTab` / `tabs`: Read the active tab’s title and URL to generate filenames and source links; used locally only.
- `storage`：保存语言、Notion 配置、库索引与偏好至浏览器本地。
- `storage`: Store language, Notion config, library index, and preferences locally.
- `contextMenus`：提供“采集图片”“设为提示词”等右键菜单入口。
- `contextMenus`: Provide right-click entries like “Capture Image” and “Set as Prompt”.
- `sidePanel`：提供常驻侧边栏界面，用于采集预览、提示词编辑与本地图库管理。
- `sidePanel`: Provide a persistent side panel for preview, prompt editing, and local library management.
- `clipboardRead`：在用户点击“粘贴”时读取剪贴板中的图片或链接，用于采集。
- `clipboardRead`: Read images or links from the clipboard when the user clicks “Paste” for capture.
- `host_permissions`：`<all_urls>` 支撑在任意网站启用采集；`https://api.notion.com/*` 用于 Notion 同步。我们不收集浏览历史、不进行跨站跟踪。
- `host_permissions`: `<all_urls>` to enable capture across sites; `https://api.notion.com/*` for Notion sync. We do not collect browsing history or perform cross-site tracking.
- `unlimitedStorage`：保障本地索引与图片缓存稳定性，支持离线可用；不涉及云端存储。
- `unlimitedStorage`: Ensure stability of local index and image cache for offline use; no cloud storage.

## 远程代码使用 / Remote Code Usage
- 不使用远程代码；扩展不从远程服务器加载或执行代码。逻辑代码随扩展打包分发并在本地执行；仅按需请求公开的静态配置与图标资源用于显示。
- No remote code is used; the extension does not load or execute code from remote servers. All logic is bundled and runs locally; only public static config/icons are requested for display when needed.

## 版本变更 / Version Change
- v0.4.14 权限合规修复：移除未使用的 `scripting` 权限，遵循最小权限原则；不涉及功能变更。
- v0.4.14 Compliance: Removed the unused `scripting` permission to follow the least privilege principle; no functional changes.

## 联系方式 / Contact
- 应用商店反馈渠道或 GitHub Issues。
- App store feedback channels or GitHub Issues.
