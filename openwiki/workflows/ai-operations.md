---
type: workflows
title: AI 运维工作流
description: 端到端追踪一次 AI 驱动的操作——客户端配置、API key 认证、execute_action 闸门、任务提交、增量日志轮询、取消、审计轨迹——外加推荐的诊断链，每一跳都带文件引用。
tags: [workflow, ai, mcp, operations, trace]
verified:
  - by: openwiki/0.5.2
    at: 2026-09-23T02:41:19.131Z
sources:
  - id: openwiki-source-963873b186750fe99f1fd465
    resource: repo://src/apis/task.py
  - id: openwiki-source-331bc6f28f42bedc884164a3
    resource: repo://src/middlewares/mcp_auth.py
  - id: openwiki-source-7a0ea9f915f2a0e821758142
    resource: repo://src/services/project_service.py
  - id: openwiki-source-1460c50309a63ff7327aa05f
    resource: repo://src/tools/mcp_manage.py
  - id: openwiki-source-b2200b4abd7c2422e9a0510d
    resource: repo://src/tools/mcp.py
  - id: openwiki-source-ae0da53766437d3809458eb4
    resource: repo://src/utils/task_executor.py
generated: { by: "opencode", at: "2026-09-23T02:41:19.131Z" }
---

# AI 运维工作流

本页追踪一次完整的 AI 驱动操作，从客户端配置到审计轨迹。每一跳都引用拥有它的代码。

## 0. 一次性：客户端配置

运维在控制台注册 API key（`POST /api/api_key`，仅 admin — `src/apis/api_key.py#L25-L73`），记下：
- 明文密钥（仅显示一次），
- `scopes`（默认 `["ops:execute"]`；manage 工具需加 `resources:read`/`resources:write`），
- `allowed_projects`（null = 全部项目）。

客户端配置（Claude Code、Cursor、任意 MCP 客户端）：

```json
{
  "mcpServers": {
    "devops": {
      "url": "http://<host>:10096/api/mcp",
      "headers": { "X-API-Key": "<key>" }
    }
  }
}
```

网关将 `/api/mcp` 重写为 `api:8000/mcp` 且关缓冲（`nginx.conf#L15-L34`）。

## 1. 认证跳

`MCPAuthMiddleware` 拦截每个 `/mcp*` POST（`src/middlewares/mcp_auth.py#L15-L65`）：

1. 提取密钥：`X-API-Key` → `Authorization: Bearer` → query `token`/`api_key`。
2. 前缀查找：前 8 字符 → 活跃 `api_tokens` 行。
3. 对 `token_hash` 校验全量密钥；无匹配则 401。
4. 将行存入 `current_mcp_token` ContextVar；在 `finally` 中重置。

**失败模式：** 凭据缺失 → 401 附中文提示列出可接受方式；密钥禁用/过期 → 401 "无效或已被禁用的 API Key"。

## 2. 发现跳 — 动手前先定向

推荐首调：`get_node_overview`（`src/tools/mcp.py#L38-L95`）。

- 读取经密钥 `allowed_projects` 过滤的活跃 `Project` 行。
- 对每个项目，从 `Command.action_type` 与 `${param}` 占位符提取动作列表。
- 并行扇出 `check_project_health`（`asyncio.gather`）。
- 返回 JSON：项目名、描述、work_dir、available_actions、health_check_action、health_status。

更深的读取（需 `resources:read`）：`list_projects` → `get_project_detail` → `list_project_commands`（`src/tools/mcp_manage.py#L133-L285`）。

## 3. 检视跳 — 读确切的 shell

执行前，检查将要跑什么：

```
inspect_script_content(project_name="prod-api", action="restart")
```

返回描述、超时、健康检查标志、占位符、default_params 与完整 `shell_command`（`src/tools/mcp.py#L270-L310`）。这是面向人的审计点 — 脚本若是新的或有变更，应向用户展示。

## 4. 执行跳 — `execute_action` 闸门

```
execute_action(project_name="prod-api", action="restart", params={"service":"api"})
```

闸门序列（`src/tools/mcp.py#L101-L165`）：

| 闸门 | 检查 | 失败时 |
|---|---|---|
| 调用者身份 | `current_mcp_token` 存在 | "无法获取调用者身份信息" |
| 项目白名单 | `check_project(project_name)` | "权限拒绝: 当前 API Key 无权操作项目 …" |
| 项目锁 | `is_project_locked(project_name)` | 返回运行中 `task_id`，请稍后重试 |
| 高危确认 | `command.requires_confirm and not confirm` | 返回 `{"status":"requires_confirm", …}` — **停下并询问用户** |
| 服务校验 | `project_service.submit_execute` | `ValueError` → "❌ …" |

### requires_confirm 两段式调用

1. **调用 1**（`confirm` 缺省/为假）：工具返回 `requires_confirm`，消息要求模型解释风险并带 `confirm=true` 重调。模型**不得**未经用户明确同意设 `confirm=true`（`src/tools/mcp.py#L111-L115` 的 docstring 规则）。
2. 用平实语言向用户转述风险（脚本做什么、影响半径）。
3. 用户明确批准。
4. **调用 2** 带 `confirm=true`：进入提交。

### 提交做了什么

`project_service.submit_execute` → `submit_task`（`src/utils/task_executor.py`）：

1. 创建 `Task` 行（`status=pending`、`actor_type="ai"`、`actor_id=<token id>`）。
2. 获取每项目锁。
3. 调度异步执行：对每一行脚本 → 构建 SSH 命令 → 将输出流式写入 `task.output_log`（增量）。
4. 结束：释放锁，置终态（`success`/`failed`/`timeout`/`cancelled`），写 `AuditLog`。

立即返回 `task_id`。

## 5. 观察跳 — 增量轮询

```
get_task_status(task_id="…", log_offset=0)
```

响应含状态 emoji、**`next_offset`**，以及仅日志字节 `[log_offset:next_offset]`（`src/tools/mcp.py#L171-L228`）。轮询循环：

```
offset = 0
loop:
  r = get_task_status(id, offset)
  print(r.output_log)          # 仅新字节
  offset = r.next_offset
  if r.status 终态: break
  sleep
```

REST 同契约：`GET /api/tasks/{id}?log_offset=`（`src/apis/task.py#L27-L41`）。实时流替代：`GET /api/tasks/{id}/stream` SSE（`src/apis/task.py#L109-L147`）— web 控制台用，MCP 客户端不用。

## 6. 取消跳

```
cancel_task_action(task_id="…")
```

- 拒绝终态（`success`/`failed`/`timeout`/`cancelled`）。
- `cancel_task` 杀掉 SSH 进程组（`killpg`）并标记 `cancelled`（`src/tools/mcp.py#L234-L264`、`src/utils/task_executor.py`）。

当从部分日志发现挂起的 SSH 会话或失控脚本时使用。

## 7. 审计跳

每次提交/取消与 manage 变更都写 `AuditLog`：

- MCP 动作：`actor_type="ai"`、`actor_id=<api_token.id>`。
- `action_category`、`target_project`、`status`、可选 `output_log` 摘录。
- MCP 可查：`query_audit_logs(project_name, hours_ago)` — 最新 10 行（`src/tools/mcp.py#L348-L382`）。
- 控制台可查：`GET /api/audit_log` 带过滤。

闭环：任何 AI 动作都能追溯到签发它的那把 API key。

## 推荐诊断链

出问题时按此顺序走（便宜 → 昂贵）：

1. `get_system_metrics` — api 容器内 CPU/内存/磁盘（`src/tools/mcp.py#L316-L342`）。
2. `get_node_overview` — 项目可见吗？health_status？
3. `inspect_script_content` — 脚本是你以为的那样吗？
4. `query_audit_logs(project_name, hours_ago=1)` — 最近跑了什么，谁跑的？
5. 对失败任务 `get_task_status` — 从 offset 0 的完整日志。
6. 宿主侧（仅人类）：Web 终端 `WS /projects/{id}/terminal`，或 `docker compose logs api`。

## 流程图（文本）

```
AI 客户端
  │  POST /api/mcp  (X-API-Key)
  ▼
MCPAuthMiddleware ──401──▶ client
  │  current_mcp_token set
  ▼
execute_action
  ├─ 白名单? ──no──▶ 权限拒绝
  ├─ 锁定? ────yes──▶ 返回运行中 task_id
  ├─ requires_confirm && !confirm ──▶ requires_confirm（问用户）
  ▼
submit_task → Task(pending) + 锁
  │
  ▼
executor: 逐行 ssh → 流式写入 → output_log
  │
  ├─ success / failed / timeout / cancelled
  ▼
AuditLog(actor_type=ai) + 释放锁

AI 轮询 get_task_status(log_offset→next_offset) 直到终态。
```

## 相关页面

- [任务执行引擎](/openwiki/architecture/task-execution.md) — 锁/超时/熔断内部。
- [MCP 工具参考](/openwiki/reference/mcp-tools.md) — 完整工具/scope 目录。
- [安全与授权模型](/openwiki/concepts/security.md) — scopes、确认存储、密钥哈希。
- [项目与命令](/openwiki/concepts/projects-and-commands.md) — 占位符合并顺序、requires_confirm 标志。
- [快速开始](/openwiki/quickstart.md) — 常见目标的任务导向路由。
