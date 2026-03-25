# OpenClaw GitHub 挂靠式上线说明

## 版本管理原则

- 本地开发、本地验证
- GitHub 记录每次版本变更
- 服务器只部署已经进入 GitHub 记录的版本
- 不把服务器当主开发面

推荐至少保留这些版本痕迹：

- git commit
- git tag
- release manifest
- GitHub Releases / 仓库树历史

## GitHub 承担什么

- `GitHub Pages`
  - 官网
  - 教程
  - 演示页
- `GitHub Releases`
  - 官方安装包
  - 官方技能包 / SOP / demo
  - 审核通过后的公开社区包
- `GitHub OAuth`
  - 网页端主登录入口
- `GitHub Actions`
  - 自动发布官网
  - 自动发布官方包
  - 自动同步审核通过的公开包

## 仍由 SoloCore Hub 承担什么

- 用户会话
- 邮箱登录回退
- 投稿上传
- 审核后台
- 角色权限
- 审计日志
- 签名下载逻辑
- 社区元数据索引

## 上线建议

### `www.<your-domain>`

- 可直接挂 GitHub Pages
- 用 Cloudflare 做 DNS / CDN

### `app.<your-domain>`

- 指向 `SoloCore Hub`
- 用 Cloudflare/WAF + Nginx 反代

## GitHub Secrets 建议

- `GITHUB_CLIENT_ID`
- `GITHUB_CLIENT_SECRET`
- `GITHUB_TOKEN`
- `GITHUB_RELEASE_REPO`

## GitHub Pages 发布前替换项

发布 `apps/openclaw-github-pages/index.html` 之前，至少替换这些占位值：

- `https://github.com/YOUR_ORG/YOUR_REPO/releases`
- `https://github.com/YOUR_ORG/YOUR_REPO/discussions`
- `https://app.your-domain.example`

建议在公开发布前运行：

```bash
/Users/liumobei/.openclaw/workspace/scripts/deploy_check_openclaw.sh --strict-public
```

## 公开包原则

- GitHub Releases 上的资产视为公开分发
- 私密包 / 企业包 / 内测包不放 GitHub 主下载流

## 本地端衔接

- 用户从 GitHub Releases 或平台下载 zip
- 在本地端 `Community Packages` 工作区导入
- 本地 inspect/install/enable/disable/rollback
