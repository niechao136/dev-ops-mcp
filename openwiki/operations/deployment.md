---
type: operations
title: 部署与主机准备
description: 端到端部署——mcp-init.sh 主机引导、三个 compose 服务及其挂载、镜像构建选择、nginx 10096 端口路由、健康检查、日志、备份与日常升级流程。
tags: [deployment, docker, compose, nginx, operations, bootstrap]
verified:
  - by: openwiki/0.5.2
    at: 2026-09-23T02:41:19.131Z
sources:
  - id: openwiki-source-6d4b4e707b8d60b6ccfa3425
    resource: repo://.github/workflows/openwiki-update.yml
  - id: openwiki-source-b79fbbd921df689b4bbdc82f
    resource: repo://docker-compose.yml
  - id: openwiki-source-bb1ebe868e35e9e500714501
    resource: repo://Dockerfile
  - id: openwiki-source-be163631251a6e50825b1426
    resource: repo://mcp-init.sh
  - id: openwiki-source-ca698d0db8d141f7e7059df0
    resource: repo://nginx.conf
  - id: openwiki-source-23775c3de52f3ab95a13cb8b
    resource: repo://README.md
  - id: openwiki-source-6af0883dab8fd643d256cf0a
    resource: repo://src/dbs/migrate.py
  - id: openwiki-source-11b9d806fcc6dd6e7747ed87
    resource: repo://src/main.py
  - id: openwiki-source-bfae268cbf1ce121dc066697
    resource: repo://web/Dockerfile
generated: { by: "opencode", at: "2026-09-23T02:41:19.131Z" }
---

# 部署与主机准备

## 拓扑回顾

一台 Linux 宿主机、三个容器、一个发布端口：

| 服务 | 镜像 | 暴露 | 角色 |
|---|---|---|---|
| `gateway` | `nginx:alpine` | **宿主 `10096` → 80** | 单一入口：Web UI、REST/SSE/WS、MCP |
| `web` | 构建 `./web` | 内部 `3000` | Next.js 控制台（standalone） |
| `api` | 构建 `.`（仓库根） | 内部 `8000` | FastAPI + FastMCP + SQLite |

三者共享 `dev-ops-mcp-network` 桥接；只有网关发布宿主端口（`docker-compose.yml#L39-L61`）。重启策略 `unless-stopped`，每容器 json-file 日志轮转上限 50 MB × 5 文件（`docker-compose.yml#L17-L22`）。

具体端口/路径图：

| 位置 | 值 |
|---|---|
| 宿主 HTTP 入口 | `http://<ip>:10096` |
| MCP 端点 | `http://<ip>:10096/api/mcp` |
| Swagger | `http://<ip>:10096/api/docs` |
| compose 内 api | `:8000`，FastAPI `root_path=/api` |
| compose 内 web | `:3000` |
| 本地开发 uvicorn | `:10097`（`src/main.py#L86-L87`） |

## 引导顺序（首次安装）

要求：Ubuntu/Debian 类宿主机、Docker 20.10+、Compose 2.0+、root（`README.md#L107-L120`）。

```bash
sudo bash mcp-init.sh          # 1. devops 用户 + SSH 密钥 + sudo 白名单 + sshd 检查
cp .env.example .env           # 2. 按需填密钥与 HOST_SSH*
docker compose up -d           # 3. 构建/拉取并启动 gateway+web+api
```

**`mcp-init.sh` 步骤**（全 root、`set -e`、自验证）— 详见[宿主机 SSH 集成](/openwiki/integrations/host-ssh.md)与[安全](/openwiki/concepts/security.md)：

1. 创建 `devops` 用户，锁密码，加入 docker/systemd-journal/adm。
2. 为该用户配置 Git `safe.directory '*'`。
3. 在 `/root/mcp_keys/mcp_devops` 生成 ed25519 密钥对。
4. 公钥装入 `authorized_keys`（700/600）。
5. 写入 + `visudo -cf` sudo 白名单。
6. 加固 sshd（公钥认证）、重启、回环 SSH 验证。

`mcp-share-keys.sh root devops` 可选：复制既有 git deploy 密钥并为 github/gitlab/gitee 播种 `known_hosts`。

compose 期望密钥在 `/root/mcp_keys/mcp_devops` 并**只读**挂载到 `/root/.ssh/id_rsa`（`docker-compose.yml#L11`）——先 `up` 后 `mcp-init.sh` 会让 api 容器没有密钥（SSH 步骤失败直到修复）。

## api 镜像（根 `Dockerfile`）

基于 uv 的两阶段构建：

- **Builder** — 从 PyPI 装 `uv`（非 ghcr，其拒绝匿名拉取），**先只拷 `pyproject.toml`** 以利层缓存，刻意**不拷 `uv.lock`** 并钉 `UV_INDEX_URL=https://pypi.org/simple`，因海外构建机对锁文件镜像超时；再拷 `src/` 并 sync（`Dockerfile#L10-L30`）。
- **Runtime** — `python:3.11-slim-bookworm` 加 **`openssh-client`**（执行器需要），只拷 venv 与 `src/`（`Dockerfile#L33-L47`）。
- **CMD** — `python -m src.dbs.migrate && uvicorn src.main:app --host 0.0.0.0 --port 8000`：schema 迁移总在服务器接流量前运行（`Dockerfile#L48`）。

跳过 `uv.lock` 的后果：镜像构建从 `pyproject.toml` 范围全新解析依赖——在重新引入锁文件前构建不完全可复现。

api 上的卷：

- `./data:/app/data` — SQLite 数据库目录（备份见下）。
- `/root/mcp_keys/mcp_devops:/root/.ssh/id_rsa:ro` — SSH 私钥，只读。
- `extra_hosts: host.docker.internal:host-gateway` — SSH 从容器内到达宿主机的方式。
- `env_file: .env` 加 `DATA_DIR`（当前代码未用——见[配置](/openwiki/operations/configuration.md)）。

## web 镜像（`web/Dockerfile`）

- Builder：`node:20-alpine`、`npm ci`、`NEXT_PUBLIC_API_URL` ARG（默认 `/api`）、`npm run build` 产出 Next standalone（`web/Dockerfile#L1-L22`）。
- Runner：只拷 standalone 输出 + static + public，以非 root `nextjs`（uid 1001）运行，`CMD ["node", "server.js"]` 监听 3000（`web/Dockerfile#L25-L46`）。

## 网关路由（`nginx.conf`）

:80 上三个 location：

1. `location /` → `web:3000`，带 WebSocket 升级头（控制台 SPA + HMR 式升级）（`nginx.conf#L6-L13`）。
2. `location ~ ^/api/mcp(?:/(.*))?$` → 重写到 `/api/mcp/…` 再到 `api:8000`，**缓冲关**，读/发 600 秒超时，chunked 开 — 为长 MCP 调用调优（`nginx.conf#L15-L34`）。
3. `location /api/` → `api:8000`，缓冲关，600 秒超时，**chunked_transfer_encoding on** 并避开 gzip-chunk 冲突，使 SSE（`/tasks/{id}/stream`）与终端 WebSocket 透传（`nginx.conf#L37-L58`）。

配置只读 bind 挂载：`./nginx.conf:/etc/nginx/conf.d/default.conf:ro`（`docker-compose.yml#L45-L46`）。

## 健康、日志与日常运维

- **健康：** `GET :10096/api/health` → api 跑 `SELECT 1` 并返回 `status: healthy|unhealthy`（`src/main.py#L64-L83`）。
- **日志：** `docker compose logs -f api`（README 运维章节）；容器用轮转 json-file 驱动。
- **升级部署：**
  ```bash
  git pull && docker compose up -d --build
  ```
  api 重建在启动时重跑迁移；web 重建重新内联 `NEXT_PUBLIC_API_URL`。
- **备份：** 复制 `./data/devops.db`（可选先停 api 拿干净快照）。恢复：停栈、替换文件、再启动（`README.md#L345-L353`）。
- **SSH 密钥轮换：** 在 `/root/mcp_keys/mcp_devops` 生成新宿主密钥对，更新 `authorized_keys`，再重启 api 容器使挂载与进程拾取。
- **升级时数据库迁移：** 经 CMD 自动；盯 `docker compose logs api` 看 `Checking database structure...` / `Database migration completed!`（`src/dbs/migrate.py#L21-L194`）。

## CI/CD 现实

唯一 GitHub Actions 工作流是 **OpenWiki 文档刷新** — cron `0 8 * * *` + 手动触发；安装 `openwiki@0.5.2`，跑 `openwiki code --update`，开一个触及 `openwiki/` 与 `AGENTS.md` 的 PR（`.github/workflows/openwiki-update.yml`）。**没有构建、测试或部署流水线**；镜像在宿主机（或调用 `docker compose build` 的地方）构建。

## 安全相关部署注意

- 只把 `10096` 绑到受信网络，并在边缘代理加 TLS；compose 栈自身讲纯 HTTP（`README.md#L382-L390`）。
- 限制 `docker compose logs` 读访问 — 首启会打印种子凭据。
- `/root/mcp_keys` 保持 `700`、私钥 `600`（`mcp-init.sh` 强制）。
- 不要启用被注释的 `NOPASSWD: ALL` sudoers 行。

## 相关页面

- [系统总览](/openwiki/architecture/system-overview.md) — 经此拓扑的请求路径。
- [宿主机 SSH 集成](/openwiki/integrations/host-ssh.md) — 密钥挂载使能什么。
- [配置与环境](/openwiki/operations/configuration.md) — 这些容器消费的 `.env` 字段。
- [持久化与迁移](/openwiki/architecture/persistence.md) — `./data` 里有什么。
- [快速开始](/openwiki/quickstart.md) — 常见运维的任务导向路由。
