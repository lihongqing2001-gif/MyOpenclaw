# OpenClaw GitHub 挂靠式上线说明

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

## 仍由 OpenClaw Web Platform 承担什么

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

- 指向 `OpenClaw Web Platform`
- 用 Cloudflare/WAF + Nginx 反代

## GitHub Secrets 建议

- `GITHUB_CLIENT_ID`
- `GITHUB_CLIENT_SECRET`
- `GITHUB_TOKEN`
- `GITHUB_RELEASE_REPO`

## 公开包原则

- GitHub Releases 上的资产视为公开分发
- 私密包 / 企业包 / 内测包不放 GitHub 主下载流

## 本地端衔接

- 用户从 GitHub Releases 或平台下载 zip
- 在本地端 `Community Packages` 工作区导入
- 本地 inspect/install/enable/disable/rollback
