# 隐私政策 | Privacy Policy

**神灯AI·灵阅** (Magic lamp AI·Read aloud Genie)

**最后更新日期 | Last Updated:** 2025年12月17日 | December 17, 2025

---

## 简体中文版

### 1. 概述

感谢您使用"神灯AI·灵阅"浏览器扩展（以下简称"本扩展"）。我们非常重视您的隐私，并承诺保护您的个人信息。本隐私政策旨在向您说明我们如何收集、使用、存储和保护您的数据。

**重要声明：本扩展完全在本地运行，不会收集、传输或存储任何用户个人信息到外部服务器。**

### 2. 信息收集

#### 2.1 我们收集的信息

本扩展仅在您的本地设备上存储以下数据：

- **用户设置**：包括语音偏好（音色、语速、音调）、播放设置（定时关闭时长）等个性化配置
- **播放历史记录**：包括您阅读过的内容标题、URL、播放进度等，用于恢复播放位置
- **解析的文本内容**：从网页或本地文件中提取的文本内容，用于 TTS 朗读
- **收藏的语音**：您标记为收藏的 TTS 语音模型列表

#### 2.2 我们不收集的信息

本扩展**不会**收集以下信息：

- 个人身份信息（姓名、邮箱、电话等）
- 浏览历史（除非您主动使用朗读功能）
- 设备信息或位置数据
- 任何其他可识别您身份的信息

### 3. 信息使用

所有收集的数据仅用于以下目的：

- **提供核心功能**：实现智能文本朗读、播放控制、进度记忆等功能
- **改善用户体验**：保存您的个性化设置，避免重复配置
- **本地数据管理**：支持播放历史的查看、删除和导出功能

**我们不会将您的数据用于任何营销、广告或第三方分析目的。**

### 4. 数据存储

- **存储位置**：所有数据均通过浏览器的 `chrome.storage.local` API 存储在您的本地设备上
- **数据持久性**：数据不会因扩展卸载或浏览器关闭而自动删除（除非您手动清除浏览器数据）
- **数据安全**：数据受浏览器沙箱机制保护，其他扩展或网站无法访问

### 5. 数据共享

**我们不会与任何第三方共享、出售或披露您的数据。**

本扩展不包含任何数据分析工具、广告服务或第三方跟踪代码。

### 6. 权限说明

本扩展请求以下浏览器权限，仅用于实现核心功能：

| 权限 | 用途 |
|------|------|
| `activeTab` | 读取当前标签页的文本内容，用于朗读功能 |
| `storage` | 在本地存储用户设置和播放历史 |
| `scripting` | 向网页注入内容脚本，用于提取文本 |
| `sidePanel` | 显示侧边栏控制面板 |
| `tts` | 调用浏览器的文本转语音（TTS）引擎 |
| `<all_urls>` | 支持在所有网站上使用朗读功能（仅在您主动激活时） |

**我们不会滥用这些权限收集与功能无关的数据。**

### 7. 用户控制

您拥有对数据的完全控制权：

- **查看数据**：通过扩展的"播放历史"功能查看已保存的记录
- **删除数据**：可单独删除历史记录，或通过浏览器设置清除所有扩展数据
- **导出数据**：支持导出播放历史和解析内容为 JSON 文件
- **卸载扩展**：卸载扩展后，您可以通过浏览器设置手动清除残留数据

### 8. 第三方服务

本扩展**不依赖任何第三方服务**，所有功能均基于浏览器原生 API 实现：

- TTS 功能使用浏览器内置的 `chrome.tts` API
- 文本解析和播放控制完全在本地执行
- 无外部网络请求（除非您访问的网页本身包含外部资源）

### 9. 儿童隐私

本扩展不会主动收集 13 岁以下儿童的信息。如果您是家长并发现您的孩子向我们提供了个人信息，请联系我们，我们将立即删除相关信息。

### 10. 隐私政策更新

我们可能会不定期更新本隐私政策。任何重大变更将通过扩展更新说明通知您。建议您定期查看本政策以了解最新信息。

### 11. 联系我们

如果您对本隐私政策有任何疑问或建议，请通过以下方式联系我们：

- **GitHub Issues**: [项目仓库地址]
- **电子邮件**: [您的联系邮箱]

---

## English Version

### 1. Overview

Thank you for using the "Magic lamp AI·Read aloud Genie" browser extension (hereinafter referred to as "the Extension"). We take your privacy seriously and are committed to protecting your personal information. This Privacy Policy explains how we collect, use, store, and protect your data.

**Important Notice: This Extension operates entirely locally and does NOT collect, transmit, or store any user personal information to external servers.**

### 2. Information Collection

#### 2.1 Information We Collect

The Extension only stores the following data locally on your device:

- **User Settings**: Including voice preferences (voice model, speed, pitch), playback settings (sleep timer duration), and other personalized configurations
- **Playback History**: Including titles, URLs, and playback progress of content you've read, used to resume playback positions
- **Parsed Text Content**: Text extracted from web pages or local files for TTS reading
- **Favorited Voices**: List of TTS voice models you've marked as favorites

#### 2.2 Information We Do NOT Collect

The Extension does **NOT** collect:

- Personal identification information (name, email, phone, etc.)
- Browsing history (unless you actively use the reading function)
- Device information or location data
- Any other information that could identify you

### 3. Information Use

All collected data is used solely for the following purposes:

- **Provide Core Functionality**: Enable intelligent text-to-speech, playback controls, progress memory, etc.
- **Improve User Experience**: Save your personalized settings to avoid repeated configuration
- **Local Data Management**: Support viewing, deleting, and exporting playback history

**We do NOT use your data for marketing, advertising, or third-party analytics.**

### 4. Data Storage

- **Storage Location**: All data is stored locally on your device via the browser's `chrome.storage.local` API
- **Data Persistence**: Data will not be automatically deleted when the extension is uninstalled or the browser is closed (unless you manually clear browser data)
- **Data Security**: Data is protected by the browser's sandbox mechanism and cannot be accessed by other extensions or websites

### 5. Data Sharing

**We do NOT share, sell, or disclose your data to any third parties.**

The Extension does not include any analytics tools, advertising services, or third-party tracking codes.

### 6. Permissions Explanation

The Extension requests the following browser permissions, used solely for core functionality:

| Permission | Purpose |
|------------|---------|
| `activeTab` | Read text content from the current tab for reading functionality |
| `storage` | Store user settings and playback history locally |
| `scripting` | Inject content scripts into web pages to extract text |
| `sidePanel` | Display the sidebar control panel |
| `tts` | Access the browser's text-to-speech (TTS) engine |
| `<all_urls>` | Support reading functionality on all websites (only when you actively enable it) |

**We do NOT abuse these permissions to collect data unrelated to functionality.**

### 7. User Control

You have full control over your data:

- **View Data**: View saved records through the Extension's "Playback History" feature
- **Delete Data**: Delete individual history records or clear all extension data via browser settings
- **Export Data**: Export playback history and parsed content as JSON files
- **Uninstall Extension**: After uninstalling, you can manually clear residual data through browser settings

### 8. Third-Party Services

The Extension **does NOT rely on any third-party services**. All functionality is based on native browser APIs:

- TTS functionality uses the browser's built-in `chrome.tts` API
- Text parsing and playback control execute entirely locally
- No external network requests (unless the web pages you visit contain external resources)

### 9. Children's Privacy

The Extension does not knowingly collect information from children under 13. If you are a parent and discover that your child has provided us with personal information, please contact us, and we will delete the information immediately.

### 10. Privacy Policy Updates

We may update this Privacy Policy from time to time. Any significant changes will be communicated through extension update notes. We recommend reviewing this policy regularly to stay informed.

### 11. Contact Us

If you have any questions or suggestions about this Privacy Policy, please contact us via:

- **GitHub Issues**: [Your Repository URL]
- **Email**: [Your Contact Email]

---

## 版本历史 | Version History

- **v1.0** (2025-12-17): 初始版本 | Initial version

---

**© 2025 神灯AI·灵阅 | Magic lamp AI·Read aloud Genie. All rights reserved.**

