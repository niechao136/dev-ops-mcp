---
type: operations
title: 配置与环境
description: 全部环境变量与配置面的参考——.env 字段及其消费模块、默认值与未设置后果（含 API_KEY_SECRET 导入失败）、MCP_NODE_NAME、compose 注入值，以及 Web 构建期 API URL。
tags: [configuration, environment, env, secrets, reference]
verified:
  - by: openwiki/0.5.2
    at: 2026-09-23T02:41:19.131Z
sources:
  - id: openwiki-source-5f5b95b3d6a215fa02ceb945
    resource: repo://.env.example
  - id: openwiki-source-b79fbbd921df689b4bbdc82f
    resource: repo://docker-compose.yml
  - id: openwiki-source-3b3c2845ec459547b71d8ae5
    resource: repo://src/dbs/db.py
  - id: openwiki-source-b2200b4abd7c2422e9a0510d
    resource: repo://src/tools/mcp.py
  - id: openwiki-source-022c79e0982a78ad8f60ba5b
    resource: repo://src/utils/executor.py
  - id: openwiki-source-1db72e8ec73cc3ebf8681de8
    resource: repo://src/utils/jwt.py
  - id: openwiki-source-a74d39396cbc4d7608061c19
    resource: repo://src/utils/path.py
  - id: openwiki-source-91a2bd6b0c1df66ba8783dec
    resource: repo://src/utils/security.py
  - id: openwiki-source-9fcc0ca2c2dacd1cad10a695
    resource: repo://src/utils/ssh_client.py
  - id: openwiki-source-bfae268cbf1ce121dc066697
    resource: repo://web/Dockerfile
  - id: openwiki-source-7e95a9845db9675e0b876a95
    resource: repo://web/services/api.ts
generated: { by: "opencode", at: "2026-09-23T02:41:19.131Z" }
---

# 配置与环境

## 配置如何加载

**没有中央 settings 模块。** 每个相关文件自行调用 `load_dotenv()`，并在**导入时**用 `os.getenv` / `os.environ.get` 读值（模块加载后值即冻结；改 `.env` 需要进程重启）：

| 模块 | 加载 dotenv | 值何时读取 |
|---|---|---|
| `src/dbs/db.py` | 是 | `ADMIN_*` / `DEFAULT_API_KEY` 作为模块级常量 |
| `src/utils/jwt.py` | 是 | 导入时读 `JWT_SECRET` |
| `src/utils/security.py` | 是 | 导入时读 `API_KEY_SECRET` — **缺失则抛错** |
| `src/utils/executor.py` | 是 | 导入时读 `HOST_SSH*` |
| `src/utils/ssh_client.py` | 是 | 相同 `HOST_SSH*` 默认（重复） |
| `src/tools/mcp.py` | 是 | 导入时读 `MCP_NODE_NAME` |
| `src/dbs/migrate.py`、`src/utils/path.py` | 否 | 从 `ROOT_DIR` 推导路径，无环境变量 |

Compose 在 api 服务上通过 `env_file: .env` 供给文件（`docker-compose.yml#L6`），容器内是真实环境变量（不只是 dotenv）；本地开发依赖 `load_dotenv()` 在工作目录找到 `.env`。

## `.env` 参考（来自 `.env.example`）

| 变量 | 消费方 | 未设置默认 | 后果 / 说明 |
|---|---|---|---|
| `ADMIN_USERNAME` | `src/dbs/db.py#L47` | `admin` | 首启种下的管理员用户名 |
| `ADMIN_PASSWORD` | `src/dbs/db.py#L48` | `admin@123` | 种子时 bcrypt 哈希；**首建时打到日志** — 首次登录后立即修改 |
| `DEFAULT_API_KEY` | `src/dbs/db.py#L49` | `default` | 不是密钥本身——是查找/种子默认 MCP 密钥行的 **token_name**；真密钥被生成、日志展示一次、再哈希+加密存储 |
| `JWT_SECRET` | `src/utils/jwt.py#L13` | `dev-ops-mcp` | 控制台会话的 HS256 签名密钥；弱默认 — 生产必须强随机串；轮换使全部 JWT 失效 |
| `API_KEY_SECRET` | `src/utils/security.py#L31-L41` | **无** | 加密存储 API 密钥的 Fernet 根；**未设置则 `get_fernet_cipher()` 在模块导入时抛 `RuntimeError`**，应用启动整体中止 — 硬性要求 |
| `HOST_SSH` | `executor.py#L12`、`ssh_client.py#L12` | `host.docker.internal` | SSH 目标；需 compose `extra_hosts` host-gateway（或脱离 compose 的显式可达地址） |
| `HOST_SSH_PORT` | `executor.py#L13`、`ssh_client.py#L13` | `22` | 远端 sshd 端口（`ssh_client` 转 `int`） |
| `HOST_SSH_USER` | `executor.py#L14`、`ssh_client.py#L14` | `devops` | 远端账号；也用作工作目录 `chown` 属主 |
| `HOST_SSH_KEY` | `executor.py#L15`、`ssh_client.py#L15` | `/root/.ssh/id_rsa` | 只读挂载私钥的容器路径 |

`.env.example` 把密钥留空，强迫运维提供（或默默接受上述代码默认）（`.env.example#L1-L12`）。

## 不在 `.env.example` 中的变量

| 变量 | 消费方 | 行为 |
|---|---|---|
| `MCP_NODE_NAME` | `src/tools/mcp.py#L24-L25` | FastMCP 服务器名 `devops-node-<后缀>` 的可选后缀；回退 `socket.gethostname()`（Docker 内除非设置，否则是容器 id/名） |
| `DATA_DIR` | 仅 compose（`docker-compose.yml#L12-L14`） | 默认注入 `/app/data`，但**没有任何 Python 模块读它** — `db.py`/`migrate.py` 改算 `Path(ROOT_DIR)/"data"`（`src/dbs/db.py#L25-L27`、`src/utils/path.py#L4-L7`）。当前把 compose 条目当惰性项 |
| `NEXT_PUBLIC_API_URL` | `web/Dockerfile#L14-L15`、`web/services/api.ts#L15` | Next.js 打包的构建参数/ENV；compose 设 `/api` 使浏览器调网关路径。必须在**构建期**设置（内联进客户端 JS），仅运行时不够 |

## 路径解析

`ROOT_DIR` 从 `src/utils/path.py` 上跳推得（`util → src → 仓库根`）（`src/utils/path.py#L4-L7`）。一切持久物（`data/devops.db`）挂在该根下，因此应用必须带完整仓库/布局运行——只拷 `src/` 到别处会破坏 DB 发现。

## 启动顺序与失败模式

1. **导入链** — 首次导入 `src.utils.security` 要求 `API_KEY_SECRET`，否则进程在 uvicorn 绑端口前就以 `RuntimeError` 死掉。
2. **容器 CMD** — `python -m src.dbs.migrate` 在同一环境下运行；库文件缺失只警告（`src/dbs/migrate.py#L13-L15`）。
3. **Lifespan** — `init_db()` 读 `ADMIN_*`/`DEFAULT_API_KEY`；`start_scheduler()` 不读环境（UTC 硬编码）。

常见错配症状：

| 症状 | 可能原因 |
|---|---|
| 进程立即退出，`API_KEY_SECRET 环境变量未设置` | 空/缺失 `API_KEY_SECRET` |
| 密钥曾可用后全部 AI MCP 调用 401 | 控制台禁用密钥，或 `is_active` false |
| 重部署后登录循环 | `JWT_SECRET` 变了（旧 cookie 失效）或用户被禁用 |
| 任务瞬时 SSH 错误失败 | `HOST_SSH*` 错、密钥未挂载，或 `host.docker.internal` 解不开 |
| 客户端 MCP 服务器名意外 | 未设 `MCP_NODE_NAME` → 容器主机名后缀 |

## 密钥处理清单

- 生产首启前提供强随机 `JWT_SECRET` 与 `API_KEY_SECRET`（README 安全清单）。
- 首启日志含默认管理员密码与生成的 API 密钥明文 — 两者都轮换并限制 `docker compose logs` 访问。
- `.env` 被 git 忽略（根 `.gitignore`）；永不提交真值。`.env.example` 是模板。
- SSH 私钥材料在宿主机与只读挂载上；它不是环境变量，从不出现在 `.env`。

## 相关页面

- [安全与授权模型](/openwiki/concepts/security.md) — 每个密钥在密码学上如何使用。
- [部署与主机准备](/openwiki/operations/deployment.md) — compose 接线与卷。
- [持久化与迁移](/openwiki/architecture/persistence.md) — `data/` 路径如何解析。
- [宿主机 SSH 集成](/openwiki/integrations/host-ssh.md) — 运行时的 `HOST_SSH*`。
