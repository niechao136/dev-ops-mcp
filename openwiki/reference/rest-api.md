---
type: reference
title: REST API 参考
description: /api 下十个 FastAPI 路由目录——auth、projects、tasks（含 SSE 流）、users、api-keys、审计、公共命令、自动化、终端 WebSocket、dashboard，以及 DataResult/PageResult 信封与各组 JWT vs API key 认证方式。
tags: [rest, api, reference, fastapi, sse, websocket]
verified:
  - by: openwiki/0.5.2
    at: 2026-09-23T02:41:19.131Z
sources:
  - id: openwiki-source-924fc70f3f9009abd60c8060
    resource: repo://src/apis/api_key.py
  - id: openwiki-source-c24578d496c6fb366da3c397
    resource: repo://src/apis/audit_log.py
  - id: openwiki-source-614a27dd345800c754572c92
    resource: repo://src/apis/public_command.py
  - id: openwiki-source-963873b186750fe99f1fd465
    resource: repo://src/apis/task.py
  - id: openwiki-source-c370c7d7b5c67cf07b85dd65
    resource: repo://src/apis/terminal.py
  - id: openwiki-source-11b9d806fcc6dd6e7747ed87
    resource: repo://src/main.py
  - id: openwiki-source-7188431d18b2dcab231df7f8
    resource: repo://src/schemas/api.py
  - id: openwiki-source-33f31d77bd5ec64ff943b83a
    resource: repo://src/utils/auth.py
generated: { by: "opencode", at: "2026-09-23T02:41:19.131Z" }
---

# REST API 参考

## 基础路径与响应信封

FastAPI 以 `root_path="/api"` 创建并挂载全部十个路由（`src/main.py#L36-L61`）；经网关后基础为 `http://<host>:10096/api`。交互式文档：`/api/docs`（Swagger）与 `/api/redoc`。

两种响应信封（`src/schemas/api.py#L26-L36`）：

| 信封 | 形状 | 含义 |
|---|---|---|
| `DataResult[T]` | `{data?, status: 1\|0, msg?}` | 单对象；`status=1` 成功，`status=0` 逻辑失败（HTTP 常仍为 200） |
| `PageResult[T]` | `{total, data[], page, size}` | 分页列表；成功时恒 200 |

通用查询参数（经 `PageParams`）：`page`（≥1）、`size`（1–100）、`order_by`、`direction`（asc/desc）、`keyword`。

## 认证方式

| 方式 | 机制 | 适用 |
|---|---|---|
| **JWT（控制台）** | `Authorization: Bearer <jwt>` → `get_current_user`（任意活跃用户）或 `get_current_admin`（仅 role=admin） | 下方全部 REST 路由 |
| **API key（程序化）** | `X-API-Key` / Bearer / `?token=`/`?api_key=` → `get_api_key` 辅助 | 作为依赖可用；`MCPAuthMiddleware` 额外硬闸仅 `/mcp*` 路径 |
| **WebSocket JWT** | WS 升级时 query `token=` 或 `Authorization` 头 | 仅终端 |

`get_current_user` 从 JWT 载荷加载活跃 `User` 行（`src/utils/auth.py#L16-L54`）；`get_current_admin` 另要求 `UserRole.ADMIN`，否则 403（`src/utils/auth.py#L57-L64`）。写操作（POST/PUT/DELETE）在每个路由均为 admin 门禁；读为用户级。

## 路由目录（10 路由 + health + MCP 挂载）

### Auth — `/api/auth`
| 方法/路径 | 认证 | 说明 |
|---|---|---|
| `POST /auth/login` | 无 | 体 `{username, password}`；返回 `DataResult[str]`（JWT）；bcrypt 校验（`src/apis/auth.py#L18-L34`） |

### Users — `/api/user`
`GET /user`（列表）、`GET /user/count`、`GET /user/me`、`POST /user/me/password`（自助改密）、`GET /user/{id}`、`POST /user`（创建）、`PUT /user/{id}`、`POST /user/{id}/password`（管理员重置）、`PUT /user/{id}/toggle`、`DELETE /user`（按 ids 批量删）。自助端点为用户级；CRUD 为 admin（`src/apis/user.py`）。

### Projects 与 commands — `/api/projects`
| 方法/路径 | 认证 | 说明 |
|---|---|---|
| `GET /projects` | user | 分页 + 每行并行健康检查状态 |
| `GET /projects/count` | user | |
| `GET /projects/{id}` | user | 详情；锁定时含 `running_task` |
| `POST /projects` | admin | 创建（要求 `work_dir`） |
| `PUT /projects/{id}` | admin | |
| `DELETE /projects` | admin | 按 `ids[]` 批量 |
| `GET /projects/{id}/commands` | user | 分页命令 |
| `POST /projects/{id}/commands` | admin | |
| `PUT /projects/commands/{command_id}` | admin | |
| `DELETE /projects/commands` | admin | 批量 |
| `PUT /projects/commands/{id}/health_check` | admin | 切换健康检查标志 |
| `GET /projects/{id}/health_check` | user | 执行检查，返回 `{status, results}` |
| `POST /projects/execute` | admin | 异步提交动作（同路径也见 tasks 路由 — 见下） |

### Tasks — `/api/tasks`
| 方法/路径 | 认证 | 说明 |
|---|---|---|
| `GET /tasks/{id}` | user | 支持 `log_offset` → 返回切片 `output_log` + `next_offset` |
| `GET /tasks` | user | 按 `project_name`、`status` 过滤；分页 |
| `POST /tasks/{id}/cancel` | user | |
| **`GET /tasks/{id}/stream`** | user | **SSE**：`text/event-stream`，每 1 秒轮询，发出 `data: <新日志块>` 后终止 `{status, end:true}`；需 `Transfer-Encoding: chunked` + no-cache 头（`src/apis/task.py#L109-L147`） |
| `POST /tasks/execute` | user | 体 `{project_name, action, params?}`；检查项目锁、合并 `default_params`、按行拆分脚本，调 `submit_task` 且 `actor_type="human"`（`src/apis/task.py#L150-L229`） |

### Terminal — WebSocket
`WS /projects/{project_id}/terminal?token=<jwt>`（`src/apis/terminal.py#L32`）。query 或头验证 JWT；未知项目以 1008 关闭。成功后：paramiko PTY 桥接；客户端可发 `\x00resize:w:h`。无对应 HTTP REST 端点。

### API keys — `/api/api_key`（路由级 admin 依赖）
`POST /api_key`（创建 → 明文仅一次）、`GET /api_key`（列表）、`GET /api_key/{id}`、`PUT /api_key/{id}`、`DELETE /api_key`（批量）、`GET /api_key/count`、`POST /api_key/{id}/get_key`（取回解密）、`POST /api_key/{id}/regenerate`（轮换 → 新明文仅一次）。整路由包 `dependencies=[Depends(get_current_admin)]`（`src/apis/api_key.py#L16-L18`）。

### Audit logs — `/api/audit_log`
`GET /audit_log`（分页，过滤：keyword、actor_type、action_category、status、target_project — 前端 `user`/`api_key` 映射到 DB `human`/`ai`）、`GET /audit_log/{id}`、`GET /audit_log/categories/list`、`GET /audit_log/projects/list`、`DELETE /audit_log`（admin 批量）、`GET /audit_log/count`。

### Public commands — `/api/public_commands`
`GET`（列表，keyword+tags）、`GET /{id}`、`POST`（admin）、`PUT /{id}`（admin）、`DELETE`（admin 批量）、`POST /import`（user — 拷贝模板进项目）、`POST /batch_import`（user — 多个 id；跳过失败）。

### Automations — `/api/automations`
`GET /automations/{project_id}`（user，分页）、`POST`（admin）、`PUT /{id}`（admin）、`DELETE /{id}`（admin）、`PUT /{id}/toggle`（admin）。

### Dashboard — `/api/dashboard`
`GET /dashboard/stats` → 项目/密钥/用户/审计行计数；`GET /dashboard/metrics` → psutil CPU/内存/磁盘 + `node_name`（容器主机名）。均为用户级。

### Health 与 MCP
- `GET /health` — 无认证；执行 `SELECT 1`，返回 `healthy|unhealthy`（`src/main.py#L64-L83`）。
- `POST /mcp*`（外部 `/api/mcp*`）— FastMCP 应用，**API key 中间件**（非 JWT）— 见 [MCP 工具参考](/openwiki/reference/mcp-tools.md)。

## CORS

`CORSMiddleware` 允许 `allow_origins=["*"]` 附凭据及全部方法/头（`src/main.py#L39-L45`）— `:3000` 上的控制台经网关调用无 origin 摩擦。

## 传输特例

1. **SSE**（`/api/tasks/{id}/stream`）：nginx 对 `/api/` 关缓冲并启 chunked transfer，使流不被缓冲；客户端也不得缓冲。
2. **WebSocket**（`/api/projects/{id}/terminal`）：`/` 上的 nginx `Upgrade`/`Connection` 头；token 在 query string — 浏览器无法设 WS 头 — 短时 JWT 可接受，但会出现在访问日志。
3. **MCP streamable HTTP**：独立中间件路径；JSON-RPC POST 始终带 `Accept: application/json, text/event-stream`。

## 相关页面

- [系统总览](/openwiki/architecture/system-overview.md) — 这些路由如何位于 nginx 之后。
- [任务执行引擎](/openwiki/architecture/task-execution.md) — `POST /tasks/execute` 调度了什么。
- [安全与授权模型](/openwiki/concepts/security.md) — JWT/API key 细节。
- [MCP 工具参考](/openwiki/reference/mcp-tools.md) — `/api/mcp` 上的并行工具面。
- [Web 控制台工作流](/openwiki/workflows/web-console.md) — UI 调了哪些端点。
