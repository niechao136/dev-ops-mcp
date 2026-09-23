---
type: architecture
title: 系统总览与架构
description: DevOps MCP 是什么、nginx 背后的三容器拓扑、FastAPI/MCP 入口与 lifespan 启动、AI 与人类的请求路径，以及 src/ 子系统的职责划分。
tags: [architecture, overview, fastapi, mcp, topology]
verified:
  - by: openwiki/0.5.2
    at: 2026-09-23T02:41:19.131Z
sources:
  - id: openwiki-source-b79fbbd921df689b4bbdc82f
    resource: repo://docker-compose.yml
  - id: openwiki-source-bb1ebe868e35e9e500714501
    resource: repo://Dockerfile
  - id: openwiki-source-ca698d0db8d141f7e7059df0
    resource: repo://nginx.conf
  - id: openwiki-source-23775c3de52f3ab95a13cb8b
    resource: repo://README.md
  - id: openwiki-source-11b9d806fcc6dd6e7747ed87
    resource: repo://src/main.py
  - id: openwiki-source-b2200b4abd7c2422e9a0510d
    resource: repo://src/tools/mcp.py
generated: { by: "opencode", at: "2026-09-23T02:41:19.131Z" }
---

# 系统总览与架构

## 它是什么

DevOps MCP 是自托管的 **AI 面向运维的执行中枢**。它把服务端项目操作（部署、重启、备份、日志清理……）包装成 **MCP 工具**，让 Claude、Cursor、GPT 等助手在 scope 权限、确认闸门与完整审计之下执行运维——而从不持有 SSH 凭据；同时提供轻量 **Web 控制台**，供人类配置项目、审阅脚本、管理密钥。分工是明确的：人定义并确认，AI 执行（`README.md#L1-L18`）。

塑造每个子系统的设计属性：

- **单一执行通道。** 人类、AI、自动化触发都提交同一套异步任务机制；只有交互式 Web 终端是独立的 SSH 路径（`README.md#L74-L81`）。
- **SSH 回连宿主机，无 agent。** 平台跑在容器里，以专用低权限 `devops` 用户回连 Linux 宿主机；宿主机上除该用户与 sudo 白名单外不安装任何东西（`README.md#L49-L72`）。
- **仅 SQLite 持久化，无外部服务。** Compose 恰好拉起三个容器，并 bind 挂载 `./data` 卷（`docker-compose.yml`）。

## 运行时拓扑

```
浏览器 / MCP 客户端
        │  :10096
        ▼
┌─ gateway (nginx:alpine) ─────────────────────────────┐
│  /            → web:3000   (Next.js 控制台)           │
│  /api/mcp/*   → api:8000   (MCP HTTP，无缓冲，       │
│                             600s 读/发送超时)         │
│  /api/*       → api:8000   (REST + SSE + WebSocket)  │
└──────────────────────────────────────────────────────┘
        │                          │
   web 容器                   api 容器 (FastAPI + FastMCP)
   Next standalone            ├─ ./data:/app/data  (SQLite)
                              ├─ SSH 密钥只读挂载
                              └─ extra_hosts host.docker.internal:host-gateway
                                       │ SSH :22
                                       ▼
                              以 `devops` 用户访问 Linux 宿主机
```

- 只有网关发布宿主端口：`10096:80`；`api` 与 `web` 留在内部桥接网络 `dev-ops-mcp-network`（`docker-compose.yml#L39-L61`）。
- nginx 用正则 location 特判 MCP：把 `/api/mcp`（无尾斜杠）重写为 `/api/mcp/`、关闭缓冲、允许 600 秒读超时以覆盖长操作；`/api/` 保持缓冲关闭并开启 chunked 编码，使 SSE 流与 WebSocket 升级透传（`nginx.conf#L15-L58`）。
- 前端配置为 `NEXT_PUBLIC_API_URL=/api`，浏览器只与网关路径通信，从不直连 `api:8000`（`docker-compose.yml#L28-L29`）。

## 入口与启动

| 入口 | 位置 | 说明 |
|---|---|---|
| 生产服务器 | `Dockerfile#L48` | `python -m src.dbs.migrate && uvicorn src.main:app --host 0.0.0.0 --port 8000` |
| FastAPI 应用 | `src/main.py#L36` | `root_path="/api"`，lifespan 与 MCP 应用的 lifespan 合并 |
| 本地开发服务器 | `src/main.py#L86-L87` | `uvicorn` 端口 **10097**，开 reload |
| MCP HTTP 应用 | `src/tools/mcp.py#L24-L27` | `FastMCP(f"devops-node-{suffix}")`，后缀为 `MCP_NODE_NAME` 或主机名；`mcp.http_app(path="/")` |
| 迁移 CLI | `src/dbs/migrate.py#L203-L204` | `python -m src.dbs.migrate` |
| 控制台脚本 | — | `pyproject.toml` 未定义 `[project.scripts]` |

应用启动顺序（`src/main.py#L25-L36`）：

1. Lifespan 运行 `init_db()`（建表 + 种管理员 + 默认 API 密钥）与 `start_scheduler()`（APScheduler 任务与自动化条件循环）。
2. CORS 中间件允许所有来源并携带凭据。
3. 全局安装 `MCPAuthMiddleware` 为 MCP 路径做认证。
4. 注入十个 REST 路由器，再把 MCP 应用挂载到 `/mcp`——配合 FastAPI 的 `root_path="/api"`，对外 MCP 端点是 **`/api/mcp`**（`src/main.py#L51-L61`）。
5. `GET /api/health` 用数据库 `SELECT 1` 证明存活（`src/main.py#L64-L70`）。

## 三条请求路径

1. **MCP（AI）。** 客户端以 API 密钥（header、bearer 或 query token）调用 `http://host:10096/api/mcp/`。中间件校验密钥并存入上下文变量；FastMCP 分发到 `src/tools/mcp.py`（运维/观测）与 `src/tools/mcp_manage.py`（受 scope 与两段确认闸门的资源 CRUD）。执行 shell 的工具调用会立即返回 `task_id`——执行是异步的。
2. **REST（Web 控制台与集成）。** `/api/*` 下 JWT 保护的路由器镜像控制台能力：认证、项目、任务（含 SSE 日志流）、用户、API 密钥、审计日志、公共命令、自动化、仪表板，以及终端 WebSocket。响应信封为 `DataResult`/`PageResult`（`src/schemas/api.py`）。
3. **WebSocket（仅交互终端）。** `WS /api/projects/{id}/terminal` 校验 JWT，把浏览器桥接到交互式 paramiko SSH 会话——唯一不经过任务队列的路径（`src/apis/terminal.py`）。

三者共享同一套领域服务、数据库与审计流；拆分在于传输与身份（带 scope 的 API 密钥 vs JWT 控制台用户 vs 自动化 actor），而非重复业务逻辑。

## `src/` 模块图

按 `src/main.py` 的接线划分职责：

| 包 | 职责 | 关键文件 |
|---|---|---|
| `src/tools/` | MCP 面：ops 工具、manage 工具、MCP 资源 | `mcp.py`、`mcp_manage.py` |
| `src/apis/` | REST 路由器与终端 WebSocket | 每资源一个模块（`project`、`task`、`auth`……） |
| `src/services/` | REST 与 MCP 共享的领域逻辑（项目/命令、模板、自动化、审计） | `project_service.py`、`automation_service.py`、`audit_service.py` |
| `src/dbs/` | SQLAlchemy 模型、引擎/会话、种子、启动迁移 | `orm.py`、`db.py`、`migrate.py` |
| `src/utils/` | 任务执行器、SSH/执行器、调度器、auth/JWT/security、确认令牌 | `task_executor.py`、`executor.py`、`scheduler.py` |
| `src/middlewares/` | MCP 路径的 API 密钥认证 | `mcp_auth.py` |
| `src/schemas/` | Pydantic 请求/响应模型与结果信封 | `api.py` 及各资源一个文件 |

`src/` 之外的配套材料：

- `web/` — Next.js 控制台（App Router、MUI、Tailwind、react-query、zustand），自带 Dockerfile；见 [Web 控制台工作流](/openwiki/workflows/web-console.md)。
- `mcp-init.sh` / `mcp-share-keys.sh` — `devops` 用户、SSH 密钥对与 sudo 白名单的宿主机引导；见 [宿主机 SSH 集成](/openwiki/integrations/host-ssh.md)。
- `docs/superpowers/` — 带日期的设计/计划文档（目前仅移动端适配）。
- **`static/` 是遗留物，不属于运行产品。** 其中是一个无关的约 1500 行 Express 代理（`static/server.js`），没有任何 compose 服务或 Dockerfile 引用；它被排除在上述架构之外，不应假定会运行（`docker-compose.yml#L1-L57` 只构建 `api`、`web`、`gateway`）。

## 并发与失败形态

- 每个项目同时只跑一个任务（项目级 asyncio 锁）；其他提交在锁释放前以"项目忙"被拒绝（`src/tools/mcp.py#L132-L134`）。
- shell 步骤流式写入 `tasks.output_log`；客户端增量轮询（`log_offset`/`next_offset`）或订阅 SSE，因此长构建从不阻塞请求（`src/tools/mcp.py#L206-L208`）。
- 高危命令（`requires_confirm`）在任何执行前停在确认闸门；管理写入使用另一套基于令牌的两段确认（`README.md#L269-L283`）。
- 每次执行以带 `human`、`ai` 或 `automation` 标签的审计行收尾，无论触发来源，给出单一取证流。

## 下一步

- 追踪一次完整的 AI 操作：[AI 运维工作流](/openwiki/workflows/ai-operations.md)。
- 理解队列与锁：[任务执行引擎](/openwiki/architecture/task-execution.md)。
- 部署这套栈：[部署与主机准备](/openwiki/operations/deployment.md)。
- 工具级与路由级目录：[MCP 工具参考](/openwiki/reference/mcp-tools.md)、[REST API 参考](/openwiki/reference/rest-api.md)。
