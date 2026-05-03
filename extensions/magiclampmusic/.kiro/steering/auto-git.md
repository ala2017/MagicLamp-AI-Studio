# 自动 Git 规则

每次完成以下操作后，自动执行 git commit 和 push：

1. **打包插件后** - 执行 `npx vsce package` 成功后
2. **修复 bug 后** - 完成代码修改并确认无误后
3. **新增功能后** - 功能开发完成后
4. **版本号更新后** - package.json 版本变更后

## 自动执行命令

```powershell
git add .
git commit -m "自动生成的提交信息"
git push
```

## 提交信息格式

- 打包: `v{版本号}: 打包发布`
- 修复: `fix: {修复内容简述}`
- 功能: `feat: {功能简述}`
- 其他: `chore: {变更简述}`
