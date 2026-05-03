# 书签链接检查功能

本模块用于检查书签链接的有效性，通过发送网络请求，确定链接是否可访问、需要授权或已失效。

## 功能特点

- 支持批量检查书签链接
- 识别多种链接状态：有效、可能可用、需要授权、超时、无效
- 显示有问题的链接，并提供删除选项
- 实时显示检查进度和发现的问题数量
- 支持暂停/继续检查过程

## 技术实现

链接检查使用标准的`fetch` API发送请求，通过设置以下选项提高兼容性和安全性：

```javascript
const response = await fetch(link, {
    method: 'HEAD',
    mode: 'no-cors',
    signal: controller.signal,
    cache: 'no-store',
    credentials: 'omit',
    redirect: 'follow',
});
```

为了确保跨域请求正常工作，页面使用了适当的内容安全策略(CSP)设置：

```html
<meta http-equiv="Content-Security-Policy" content="default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; img-src 'self' https: http: data:; font-src 'self' https://fonts.gstatic.com; connect-src 'self' http: https: chrome-extension:;">
```

## 状态分类

链接检查结果分为以下几类：

1. **有效** (状态码 200-299) - 链接正常可访问
2. **需要授权** (状态码 401/403) - 链接可访问但需要登录/验证
3. **无效** (其他状态码) - 链接已失效或服务器返回错误
4. **超时** - 请求超过10秒无响应
5. **可能可用** - 由于CORS限制无法确认状态，但链接可能是有效的

## 测试

提供了测试页面(`test.html`)用于快速测试不同类型的链接状态，包括多个预设测试链接和自定义URL输入框。

## 最近更新

- 修复了跨域请求限制问题
- 改进了错误处理和状态显示
- 优化了UI展示效果
- 添加了链接测试工具页面

## 注意事项

由于浏览器安全策略限制，某些链接可能无法准确检测状态（显示为"可能可用"）。这是正常的，因为浏览器扩展无法完全绕过CORS策略。 