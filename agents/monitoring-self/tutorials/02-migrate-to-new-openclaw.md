# 02 迁移到新 OpenClaw

## 1) 拷贝目录

把 `agents/monitoring-self` 整个目录拷到新工作区。

## 2) 安装

```bash
cd <NEW_WORKSPACE>/agents/monitoring-self
./install.sh
```

## 3) 配置

```bash
./monitor-kit setup
# 或导入旧配置
./monitor-kit import ./toolkit/exports-mvp
```

## 4) 体检与自动修复

```bash
./monitor-kit doctor --fix
./monitor-kit doctor
```

## 5) 应用 OpenClaw 配置补丁

- 生成文件: `toolkit/openclaw.patch.json`
- 模板文件: `toolkit/openclaw.patch.template.json`

把补丁内容手工合并到新环境的 `openclaw.json`。

## 6) 启动验证

```bash
./monitor-kit start
curl http://127.0.0.1:8000/api/health
```
