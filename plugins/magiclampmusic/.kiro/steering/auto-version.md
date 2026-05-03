# 自动版本号管理规则

每次打包插件前，自动执行版本号更新。

## 打包流程（按顺序执行）

1. **更新版本号** - `npm version patch --no-git-tag-version`
2. **构建 webview** - `npm run build:webview`
3. **编译扩展** - `npm run compile`
4. **打包 vsix** - `npx vsce package`
5. **Git 提交推送** - 按 auto-git.md 规则执行

## 版本类型选择

- **patch** (默认): 小修复、bug 修复 → 0.1.4 → 0.1.5
- **minor**: 新功能 → 0.1.4 → 0.2.0
- **major**: 重大更新、破坏性变更 → 0.1.4 → 1.0.0

用户未指定时默认使用 patch。

## 一键打包命令

当用户说"打包"、"发布"、"package"时，执行：

```powershell
# 1. 删除旧的 vsix 包
Remove-Item *.vsix -Force -ErrorAction SilentlyContinue

# 2. 更新版本号
npm version patch --no-git-tag-version

# 3. 构建
npm run build:webview
npm run compile

# 4. 打包
npx vsce package

# 5. Git 提交推送
git add .
git commit -m "v{新版本号}: {变更描述}"
git push
```
