# 消息通信调试指南

## 已经修复的问题

1. 使用XMLHttpRequest替代fetch API，在Service Worker中更可靠
2. 增加了更健壮的错误处理和超时处理
3. 添加了大量调试日志便于排查问题
4. 对前端发送消息逻辑进行了防御性编程增强

## 需要检查的项目

1. **确认扩展已重新加载**
   - 打开chrome://extensions
   - 找到"神灯AI书签管理器"扩展
   - 点击"重新加载"按钮
   - 确认版本号显示正确

2. **检查后台脚本加载情况**
   - 打开chrome://extensions
   - 启用"开发者模式"
   - 点击"神灯AI书签管理器"扩展的"检查视图 background page"
   - 查看控制台是否有"神灯AI书签管理器后台脚本已启动"的日志

3. **检查清单文件配置**
   确认manifest.json中包含必要的权限:
   ```json
   "permissions": [
     "bookmarks",
     "storage",
     "tabs",
     "scripting"
   ],
   "host_permissions": [
     "<all_urls>"
   ],
   ```

4. **检查请求头和CORS问题**
   如果仍有问题，可能需要修改background.js中的XMLHttpRequest配置:
   ```javascript
   xhr.setRequestHeader('User-Agent', 'Mozilla/5.0 Chrome Extension Link Checker');
   ```

## 临时解决方案

如果以上方法都不能解决问题，可以尝试临时解决方案：

1. 将链接检查功能转为处理本地书签信息而不实际发送网络请求
2. 使用chrome.tabs.create创建新标签页来检查链接
3. 使用chrome.scripting.executeScript注入内容脚本执行检查

## 报错信息解释

错误 "Could not establish connection. Receiving end does not exist." 表示:
1. 后台脚本可能未加载
2. 扩展可能需要重新安装
3. 消息通信通道可能被破坏

请记得在排查问题后删除此调试文件。 