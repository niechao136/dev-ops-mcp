---
type: architecture
title: 任务执行引擎
description: 每次部署或重启背后的异步任务生命周期——提交、项目级锁、SSH 步骤流式写入 tasks.output_log、取消、超时与熔断、审计写入，以及 offset 轮询与 SSE 如何观察同一行。
tags: [tasks, async, execution, locking, sse, logging]
verified:
  - by: openwiki/0.5.2
    at: 2026-09-23T02:41:19.131Z
sources:
  - id: openwiki-source-963873b186750fe99f1fd465
    resource: repo://src/apis/task.py
  - id: openwiki-source-7a0ea9f915f2a0e821758142
    resource: repo://src/services/project_service.py
  - id: openwiki-source-b2200b4abd7c2422e9a0510d
    resource: repo://src/tools/mcp.py
  - id: openwiki-source-022c79e0982a78ad8f60ba5b
    resource: repo://src/utils/executor.py
  - id: openwiki-source-ae0da53766437d3809458eb4
    resource: repo://src/utils/task_executor.py
generated: { by: "opencode", at: "2026-09-23T02:41:19.131Z" }
---

# 任务执行引擎

## 职责

每个 shell 操作——无论由 AI MCP 调用、Web 控制台还是自动化规则触发——都被转换成**任务**：`tasks` 中的一行，加上经 SSH 回连宿主机执行脚本的 asyncio 协程。引擎负责入队、按项目串行、流式日志持久化、超时/熔断强制、取消，以及最终审计记录。代码分布在 `src/utils/task_executor.py`（队列与生命周期）和 `src/utils/executor.py`（SSH 命令构造，以及健康检查与条件脚本使用的同步风格助手）。

## 生命周期与顺序

```
submit_task()                      run_task_async()
  │                                  │
  ├─ INSERT tasks (status=pending)   ├─ 获取项目锁
  ├─ asyncio.create_task(...)        ├─ status → running（写 start_time）
  ├─ _running_tasks[task_id]=...     ├─ 逐步骤 SSH 执行、流式写日志
  └─ return task_id  ────────────────┤   ├─ 非零退出 → 熔断 → failed
                                     │   └─ 总超时 → killpg → timeout
                                     ├─ status → success|failed|timeout（写 end_time）
                                     ├─ INSERT AuditLog(action_category=execute_cmd)
                                     ├─ 结果缓存进 _task_results
                                     ├─ 捕获 CancelledError → status=cancelled
                                     └─ finally: 删除 _running_tasks[task_id]
```

**状态。** `pending → running → success | failed | timeout | cancelled`（`src/dbs/orm.py#L145`）。`update_task_status()` 在首次迁到 `running` 时打 `start_time`，在任何终态打 `end_time`（`src/utils/task_executor.py#L29-L40`）。

**入队。** `submit_task()` 生成 UUID，提交带 actor 身份与 `command_details`（原始脚本 + 参数）的 `pending` 行，经 `asyncio.create_task` 拉起 `run_task_async`，注册进 `_running_tasks`，同步返回 id——调用方从不等待 SSH（`src/utils/task_executor.py#L196-L242`）。

**串行化。** `run_task_async` 把整个执行包在 `async with get_project_lock(project_name)` 中，因此每个项目最多一个任务在跑；同项目的并发提交更早被 `is_project_locked()` 拒绝而非入队（`src/utils/task_executor.py#L143-L145`、`src/utils/task_executor.py#L292-L305`）。锁检查同时看内存 `asyncio.Lock` 与 `status='running'` 行计数，因此崩溃后残留在 DB 中的 `running` 任务仍会阻塞新任务。

## 脚本如何变成 SSH 步骤

两条入口路径汇聚到同一套机制：

1. **MCP / 服务路径** — `project_service.submit_execute()` 加载活跃项目与匹配命令，合并 `{**default_params, **call_params}`，替换每个 `${key}`，把脚本拆成非空行，再以 `command.work_dir or project.work_dir` 和 `command.timeout` 调用 `submit_task`（`src/services/project_service.py#L291-L345`）。校验失败抛 `ValueError` 交调用方格式化。
2. **REST 路径** — `POST /api/tasks/execute` 内联执行同样的合并/替换/拆分（不调用 `submit_execute`），`actor_type="human"`（`src/apis/task.py#L174-L219`）。语义一致；该重复是改动占位符规则时要记住的维护接缝。

每一步由 `_build_ssh_command()` 包成一次远程 shell 调用（`src/utils/executor.py#L32-L49`）：

```
ssh -i $HOST_SSH_KEY -o StrictHostKeyChecking=no -o ConnectTimeout=10 \
    -p $HOST_SSH_PORT $HOST_SSH_USER@$HOST_SSH_HOST \
    'sudo mkdir -p <work_dir> [&& sudo chown user:user <work_dir>] && cd <work_dir> && <line>'
```

- 工作目录先 `sudo mkdir -p` 创建，再把属主交还 SSH 用户——受保护路径列表（`/`、`/etc`、`/var` 等）除外，跳过 `chown` 以免损坏系统目录（`src/utils/executor.py#L18-L29`、`src/utils/executor.py#L39-L41`）。
- 远程命令以单引号包裹并转义内部引号，防止本地 shell 提前展开变量（`src/utils/executor.py#L34-L35`）。

## 流式、日志持久化与失败语义

`_execute_command_streaming()` 执行各步骤（`src/utils/task_executor.py#L43-L126`）：

- 每步以 `asyncio.create_subprocess_shell` 生成，POSIX 下带 `preexec_fn=os.setsid`，使 SSH 客户端及其派生进程处于独立**进程组**——超时可对整棵树 `killpg(SIGKILL)` 而不留僵尸（`src/utils/task_executor.py#L62-L66`、`src/utils/task_executor.py#L111-L119`）。
- stdout/stderr 行加 `[STDOUT]` / `[STDERR]` 前缀，追加进内存缓冲，并**每行一次**经 `update_task_status` 刷入 `tasks.output_log`，观察者在任务仍在跑时即可看到进度（`src/utils/task_executor.py#L71-L81`）。
- **熔断：** 任一步非零退出即追加失败横幅并立即返回 `failed`——后续步骤永不执行（`src/utils/task_executor.py#L106-L109`）。
- **预算超时：** 命令的 `timeout` 是总预算而非每步；每步前重算剩余时间，耗尽时（或一步的 `asyncio.wait` 超时）杀进程组并返回 `timeout`（`src/utils/task_executor.py#L84-L90`、`src/utils/task_executor.py#L95-L119`）。
- 步骤跑完后写入最终状态，并插入一行 **`AuditLog`**，含 `action_category="execute_cmd"`、触发方 `actor_type`（`ai` / `human` / `automation`）、合并后的 `action_details`、状态与完整输出（`src/utils/task_executor.py#L156-L169`）。取消与意外异常走各自分支，写 `cancelled` / `failed`（`src/utils/task_executor.py#L177-L190`）。

`executor.execute_shell_script()` / `execute_shell_commands_chain()` 是非队列变体，共享同样的 SSH 包装、进程组杀与按行熔断；健康检查与自动化条件脚本直接使用它们而非创建任务（`src/utils/executor.py#L52-L186`）。

## 观察任务：offset 轮询与 SSE 是同一行

所有观察者都读 `get_task_info(task_id)`，即对 `tasks` 行的普通 SELECT（`src/utils/task_executor.py#L245-L264`）：

| 观察者 | 机制 |
|---|---|
| MCP `get_task_status(task_id, log_offset)` | 切片 `output_log[log_offset:]`，返回 `next_offset = len(full_log)`，每次轮询只传新字节（`src/tools/mcp.py#L206-L215`） |
| REST `GET /tasks/{id}?log_offset=` | 同一切片，响应带 `next_offset`（`src/apis/task.py#L36-L41`） |
| REST SSE `GET /tasks/{id}/stream` | 每秒循环，发出自上次长度以来的增量，终态时以 `{status, end: true}` 帧结束（`src/apis/task.py#L118-L137`） |
| Web 控制台 | 以 JWT 作为 query `token` 打开 SSE 端点（见 [Web 控制台工作流](/openwiki/workflows/web-console.md)） |

没有独立日志文件或 pub/sub 总线：`tasks.output_log` 是唯一事实源，`next_offset` 记账防止长构建淹没 AI 上下文（`README.md#L255-L267`）。

## 取消

`cancel_task(task_id)`（`src/utils/task_executor.py#L267-L289`）：

1. 协程仍在 `_running_tasks` 中则取消它——`run_task_async` 捕获 `asyncio.CancelledError`，持久化 `cancelled` 并存占位结果。
2. 否则若 DB 行是 `pending`/`running`，翻转为 `cancelled` 并写 `end_time`（覆盖协程已消失的行，例如重启后）。
3. 终态返回成功（幂等 no-op）。

MCP 工具 `cancel_task_action` 与 REST `POST /tasks/{id}/cancel` 都汇聚于此；MCP 额外拒绝对已处于终态的任务取消（`src/tools/mcp.py#L253-L254`）。

## 不变量与失败行为

- **每项目一个活动任务** — 由 asyncio 锁强制；`execute_action` 与 `/tasks/execute` 在锁定时都返回当前运行中的 task id 并拒绝（`src/tools/mcp.py#L132-L134`、`src/apis/task.py#L166-L172`）。
- **立即拒绝而非静默排队** — pending 任务只存在于已被接受的工作；调用方被告知"项目忙"而非等待。
- **进程重启丢协程，不丢历史。** `_running_tasks`、`_project_locks`、`_task_results` 仅在内存；卡在 `running` 的行仍通过 `is_project_locked` 的 DB 半边阻塞项目，直到运维人员取消它们。
- **审计只在 `run_task_async` 自然完成时写入**（成功/失败/超时分支）；经 `CancelledError` 分支的取消不插审计行——被取消的工作查任务行。
- Actor 身份在提交时捕获（AI 提交 `actor_id` = API token id，REST 为控制台用户或 `0`），并同时打在任务与最终审计条目上。

## 代表性测试

本仓库没有自动化测试套件（见[验证与质量闸门](/openwiki/testing/verification.md)）。引擎的可观察契约通过 MCP 工具响应、REST/SSE 端点，以及对 `src/` 的 `basedpyright` 类型检查间接验证。

## 相关页面

- [持久化与迁移](/openwiki/architecture/persistence.md) — `tasks` 表 schema。
- [宿主机 SSH 集成](/openwiki/integrations/host-ssh.md) — `_build_ssh_command` 连到何处以及 sudo 边界。
- [AI 运维工作流](/openwiki/workflows/ai-operations.md) — MCP 驱动的端到端流。
- [Web 控制台工作流](/openwiki/workflows/web-console.md) — 人类触发的执行与 SSE 日志。
- [安全与授权模型](/openwiki/concepts/security.md) — 入队前运行的锁/权限检查。
