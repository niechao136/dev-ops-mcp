---
type: reference
title: MCP 工具与资源参考
description: FastMCP 表面目录——ops 执行工具、resources:read 工具、resources:write 管理工具及其 scope 闸门与两段式 confirm_token 要求、devops:// MCP 资源，以及 /api/mcp 客户端连接细节。
tags: [mcp, tools, reference, fastmcp, scopes]
verified:
  - by: openwiki/0.5.2
    at: 2026-09-23T02:41:19.131Z
sources:
  - id: openwiki-source-924fc70f3f9009abd60c8060
    resource: repo://src/apis/api_key.py
  - id: openwiki-source-11b9d806fcc6dd6e7747ed87
    resource: repo://src/main.py
  - id: openwiki-source-331bc6f28f42bedc884164a3
    resource: repo://src/middlewares/mcp_auth.py
  - id: openwiki-source-6d8bb5329d1b7653f820b055
    resource: repo://src/schemas/api_key.py
  - id: openwiki-source-1460c50309a63ff7327aa05f
    resource: repo://src/tools/mcp_manage.py
  - id: openwiki-source-b2200b4abd7c2422e9a0510d
    resource: repo://src/tools/mcp.py
  - id: openwiki-source-a9c4bf1175e019b61ae70613
    resource: repo://src/utils/confirm_store.py
  - id: openwiki-source-a4294d957be491a9aa14dc60
    resource: repo://src/utils/context.py
generated: { by: "opencode", at: "2026-09-23T02:41:19.131Z" }
---

# MCP 工具与资源参考

## 客户端连接

| 设置 | 值 |
|---|---|
| 端点（经网关） | `http://<host>:10096/api/mcp` |
| 端点（网内直连） | `http://api:8000/mcp`（应用把 FastMCP 挂在 `/mcp`；`root_path=/api` 使对外路径为 `/api/mcp`） |
| 传输 | FastMCP streamable HTTP（`mcp.http_app(path="/")`） |
| 服务器名 | `devops-node-<MCP_NODE_NAME or hostname>`（`src/tools/mcp.py#L24-L27`） |
| 认证顺序 | 1) `X-API-Key` 头 → 2) `Authorization: Bearer` → 3) query `token=` 或 `api_key=`（query 会泄进日志 — 避免） |
| 认证强制 | `MCPAuthMiddleware` 作用于以 `/mcp` 或 `/api/mcp` 开头的路径；缺失/无效/禁用时 401（`src/middlewares/mcp_auth.py#L15-L53`） |

密钥校验：前 8 字符作 `token_prefix` 找活跃 `api_tokens` 行，再对全量密钥做 bcrypt 哈希校验；命中行存入请求的 `current_mcp_token` ContextVar（`src/middlewares/mcp_auth.py#L35-L55`）。

示例客户端配置：

```json
{
  "mcpServers": {
    "devops": {
      "url": "http://host:10096/api/mcp",
      "headers": { "X-API-Key": "<api_key>" }
    }
  }
}
```

## 权限模型（两道独立闸门）

每个请求**同时**通过：

1. **Scopes**（`api_tokens.scopes` JSON 数组）— `ops:execute`、`resources:read`、`resources:write`。`scopes` 为 NULL/空（旧密钥）时默认仅 `["ops:execute"]`（`src/utils/context.py#L31-L41`）。manage 工具经工具内 `require_scope()` 强制；ops 工具不调 `require_scope`（中间件认证 + 项目白名单仍适用）。
2. **项目白名单**（`allowed_projects` JSON 数组；`NULL` = 全部项目）— 每个项目级工具由 `check_token()` / `check_project()` 检查（`src/utils/context.py#L11-L24`）。

创建密钥未显式给 scopes 时默认 `scopes=["ops:execute"]`（`src/apis/api_key.py#L48`）。

## 确认（两种）

| 机制 | 使用方 | 行为 |
|---|---|---|
| `confirm: bool` 参数 | `execute_action` | 命令行有 `requires_confirm=true` 且 `confirm` 为假时，工具返回 `{"status":"requires_confirm"}` 且不执行；调用方须先问用户再带 `confirm=true` 重调（`src/tools/mcp.py#L144-L151`） |
| `confirm_token`（两段式） | 全部 manage 写工具 | 首调返回变更**预览** + 一次性 `confirm_token` 且**不落库**；二调带令牌执行。令牌：32-hex、**5 分钟 TTL**、单次、动作绑定；存**进程内存**（重启即丢 — 预览无副作用可重发）（`src/utils/confirm_store.py#L16-L52`、`src/tools/mcp_manage.py#L86-L121`） |

**必须**确认令牌的场景：每次 `delete`、任何设置 `shell_command` 的写（命令/公共命令 create/update）、设置 `condition_script` 的自动化 create/update。直接（无需令牌）：项目 create/update、自动化 `toggle`、公共命令 `import_to_project`。

每次 manage 写还追加 `actor_type=ai` 与 token id 的 `AuditLog` 行（`src/tools/mcp_manage.py#L82-L84`）。

## Ops 工具（`src/tools/mcp.py`）— 执行与检视

由中间件认证 + `allowed_projects` 闸门；内部无 scope 调用。

| 工具 | 用途 | 说明 |
|---|---|---|
| `get_node_overview()` | 完整节点图：活跃项目、各项目 `available_actions`（含 `${param}` 占位符）与并行健康检查状态 | 推荐首调 |
| `execute_action(project_name, action, params?, confirm?)` | 异步提交一个动作；返回 `task_id` | 项目锁定（`is_project_locked`）、无权限、或 `requires_confirm` 且无 `confirm` 时拒绝；`params` 填 `${name}` 占位符 |
| `get_task_status(task_id, log_offset=0)` | 状态 + **增量**日志；返回 `next_offset` 供轮询 | 状态：pending/running/success/failed/timeout/cancelled |
| `cancel_task_action(task_id)` | 取消非终态任务 | 终态被拒绝 |
| `inspect_script_content(project_name, action)` | 运行前展示完整 `shell_command`、超时、占位符、默认值 | 执行前审计辅助 |
| `get_system_metrics()` | **api 容器**命名空间的 psutil CPU/内存/磁盘 | 任一 > 90% 告警；工具内无项目检查（仍需中间件有效密钥） |
| `query_audit_logs(project_name, hours_ago=24)` | 窗口内项目最新 10 条 `AuditLog` | 区分 human vs AI actor |

## Manage 工具 — 只读（`scope: resources:read`）

由 `register_manage_tools` 注册（`src/tools/mcp_manage.py#L127`）；全部先调 `_check_read_scope()`，适用处再查项目白名单。分页：`page≥1`、`size≤50`、默认 20。

| 工具 | 项目闸门 | 返回 |
|---|---|---|
| `list_projects(keyword?, page, size)` | 查询白名单过滤 | 分页项目，含 `command_count` + `command_actions` |
| `get_project_detail(project_name)` | 是 | 完整项目含每个命令（脚本、超时、占位符、`requires_confirm`、`is_health_check`） |
| `list_project_commands(project_name, keyword?, page, size)` | 是 | 分页命令定义 |
| `search_public_commands(keyword?, tags?, page, size)` | 否 | 活跃公共命令模板（可复用脚本） |
| `list_automations(project_name, page, size)` | 是 | 规则含触发、cron/condition、启用标志、上次运行 |

## Manage 工具 — 写（`scope: resources:write`）

四个全部先调 `_check_write_scope()`；项目级的还强制 `allowed_projects`。

| 工具 | 操作 | 何时需要确认令牌 |
|---|---|---|
| `manage_project` | create / update / delete | `delete`（级联删项目命令配置；服务器文件不动） |
| `manage_command` | create / update / delete | `delete`；任何传 `shell_command` 的调用（create 恒需，update 仅当提供 `shell_command`）。按 `command_id` 或 `action_type` 定位 |
| `manage_public_command` | create / update / delete / **import_to_project** | `delete`；create/update 带 `shell_command` 时。`import_to_project` 立即执行（模板已审）且需 `command_id` + `project_name` |
| `manage_automation` | create / update / delete / **toggle** | `delete`；create/update 带 `condition_script` 时（调度器会执行）。`toggle` 立即翻转 `is_enabled` |

校验要点：`manage_project create` 要求绝对 `work_dir`；`manage_command create` 要求项目内 `action_type` 唯一；自动化 create 校验 5/6 段 cron 并解析 `command_action` → `command_id`。

## `devops://` MCP 资源

供支持资源的客户端使用的只读 JSON；项目资源遵 `allowed_projects`，公共命令资源除 API 密钥认证外无 scope 限制（`src/tools/mcp_manage.py#L1017-L1113`）：

| URI | 内容 |
|---|---|
| `devops://projects` | 全部许可项目，含 `available_actions` + 占位符 |
| `devops://projects/{project_name}/commands` | 单项目完整命令定义 |
| `devops://public-commands` | 活跃公共命令模板 |
| `devops://public-commands/{name}` | 按名单个模板 |

## 典型调用序列

1. `get_node_overview`（密钥有 `resources:read` 则 `list_projects`）— 发现环境。
2. `inspect_script_content` / `get_project_detail` — 行动前读确切 shell。
3. `execute_action` — 对 `requires_confirm` 命令，先向用户转述风险，再带 `confirm=true` 重调。
4. `get_task_status` 以 `log_offset = 上次 next_offset` — 增量流式到终态。
5. 配置变更：manage 写工具 → 给用户看预览 → 5 分钟内带 `confirm_token` 重调。

## 相关页面

- [安全与授权模型](/openwiki/concepts/security.md) — scopes、密钥哈希、确认存储。
- [AI 运维工作流](/openwiki/workflows/ai-operations.md) — 端到端 MCP 使用模式。
- [任务执行引擎](/openwiki/architecture/task-execution.md) — `execute_action` 之后发生什么。
- [项目与命令概念](/openwiki/concepts/projects-and-commands.md) — 工具背后的数据模型。
