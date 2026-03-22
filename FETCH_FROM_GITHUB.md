抓取并在微信开发者工具中打开本项目的步骤

1) 克隆仓库到本地

- HTTPS:
```
git clone https://github.com/USERNAME/REPO.git
```
- SSH（已配置 SSH key）:
```
git clone git@github.com:USERNAME/REPO.git
```

2) 进入项目并拉取最新
```
cd REPO
git checkout main
git pull origin main
```

3) 若使用 Git LFS（有大文件）
```
git lfs install
git lfs pull
```

4) 安装 cloudfunctions 的依赖（若存在 package.json）
```
cd cloudfunctions/aiParseAsset
npm install
```
或在 PowerShell 中批量安装：
```
Get-ChildItem cloudfunctions -Directory | ForEach-Object {
  if (Test-Path "$($_.FullName)\package.json") {
    Push-Location $_.FullName
    npm install
    Pop-Location
  }
}
```

5) 放置私有配置（如果需要）
- 从项目负责人处安全获取被忽略的私有文件（例如 `project.private.config.json`），放到项目根。

6) 在微信开发者工具中打开项目
- 打开微信开发者工具 → 打开项目 → 选择项目根目录（包含 `app.json` 的目录）。
- 如无 AppID，可使用测试号或选择不校验 AppID。

7) 部署/调试云函数（如需）
- 在微信开发者工具的“云函数”面板中选择对应函数并上传/部署。

8) 后续同步与协作
```
git pull origin main
# 新分支
git checkout -b feature/xxx
git add .
git commit -m "feat: 描述"
git push -u origin feature/xxx
```

注意事项：
- 私密配置不要通过公开渠道传输；如需传输请使用安全共享方式。
- 大文件请使用 Git LFS，避免直接提交到仓库。
