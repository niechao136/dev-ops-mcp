---
type: concept
title: 自动化规则与调度器
description: cron 与 condition 自动化规则如何存储、校验，如何经 APScheduler 或 asyncio 检查循环按 UTC 调度，条件脚本的全行 exit-0 语义，以及以 actor_type=automation 提交并带 last_run 反馈的触发路径。
tags: [automation, scheduler, cron, conditions, apscheduler]
verified:
  - by: openwiki/0.5.2
    at: 2026-09-23T02:41:19.131Z
sources:
  - id: openwiki-source-beb9687459b56654c69f92dd
    resource: repo://src/apis/automation.py
  - id: openwiki-source-11b9d806fcc6dd6e7747ed87
    resource: repo://src/main.py
  - id: openwiki-source-4fb44c92303ffb7b27a2e5ee
    resource: repo://src/services/automation_service.py
  - id: openwiki-source-1460c50309a63ff7327aa05f
    resource: repo://src/tools/mcp_manage.py
  - id: openwiki-source-22898bb50e1ac9cb8fc6a9f0
    resource: repo://src/utils/scheduler.py
generated: { by: "opencode", at: "2026-09-23T02:41:19.131Z" }
---

# 自动化规则与调度器

## 职责

自动化规则让项目在无人无 AI 参与下运行其配置的命令之一——要么按 **cron 计划**，要么当**条件脚本**周期性报告健康时。所有权分布在：

- `src/services/automation_service.py` — REST 与 MCP 共享的领域 CRUD 与触发校验。
- `src/apis/automation.py` — JWT 保护的 REST 路由（创建/更新/删除/toggle 需 admin）。
- `src/tools/mcp_manage.py` — `list_automations`（scope `resources:read`）与 `manage_automation`（scope `resources:write`，涉及 `condition_script` 时需两段确认）。
- `src/utils/scheduler.py` — 运行时：cron 用 APScheduler，条件用 asyncio 循环，以及进入共享任务引擎的触发路径。

规则持久化在 `automations` 表，带指向 `projects` 与 `commands` 的外键，以及 `last_run_time` / `last_run_status` 反馈列（[持久化](/openwiki/architecture/persistence.md)）。

## 规则模型与校验

`trigger_type` 恰好是 `cron` 或 `condition`（`src/services/automation_service.py#L13-L23`）：

- **cron** 需要 `cron_expression`。调度器接受 5 段表达式（分 时 日 月 星期几）；其他在调度时被忽略（`src/utils/scheduler.py#L99-L103`、`src/utils/scheduler.py#L109-L124`）。MCP 创建路径在持久化前额外拒绝非 5 或 6 段的表达式（`src/tools/mcp_manage.py#L882-L887`）。
- **condition** 需要 `condition_script`；`condition_interval` 默认 60 秒（`src/services/automation_service.py#L95`）。
- 两类都绑定既有 `command_id`；项目或命令缺失则创建失败（`src/services/automation_service.py#L80-L87`）。

MCP `manage_automation` 工具按 `command_action`（项目内 action_type）镜像该校验，强制项目内规则名唯一，并把 `condition_script` 创建/更新以及每次删除关在基于令牌的两段确认后——因为调度器会周期性真实执行该脚本（`src/tools/mcp_manage.py#L850-L851`、`src/tools/mcp_manage.py#L900-L913`）。

## 运行时：规则如何被调度

```
FastAPI lifespan
  └─ start_scheduler()                 (src/main.py:L29)
       ├─ start_all_automations()      加载 is_enabled 规则 → 逐个 start_automation
       │    ├─ cron      → APScheduler.add_job(execute_automation_command, "cron", …)
       │    └─ condition → asyncio.create_task(condition_checker_loop)
       └─ scheduler.start()            timezone="UTC"
```

- 调度器单例以 **`timezone="UTC"`** 构造，因此 cron 表达式按 UTC 求值而非服务器本地时间（`src/utils/scheduler.py#L16-L20`）。运维人员须把本地墙钟意图（如"北京时间凌晨 3 点"）换算成对应 UTC 字段——README FAQ 明确指出这一点。
- `start_scheduler()` 先注册每个 `is_enabled` 规则，再启动 APScheduler；`stop_scheduler()` 不等待地关停调度器并取消所有条件循环——两者都绑在应用 lifespan 关停上（`src/utils/scheduler.py#L150-L162`、`src/main.py#L25-L33`）。
- 条件循环按 automation id 记在 `_running_checkers`；启动已有循环的规则会先取消旧的（`src/utils/scheduler.py#L126-L131`）。

**实时变更 vs 重启。** `start_automation` / `stop_automation` 只在启动扫描时被调用。REST 与 MCP 的创建/更新/删除/toggle 只落库不注册/注销任务，因此 cron 调度变更在下次进程重启生效。条件循环部分自纠：每轮重读行，`is_enabled` 变 false 即退出（`src/utils/scheduler.py#L85-L88`），但已禁用 **cron** 规则的已注册 APScheduler 任务会继续触发直到重启，因为 `execute_automation_command` 不复查 `is_enabled`（`src/utils/scheduler.py#L23-L56`）。把 cron 规则的 toggle/禁用当作"重启才保证生效"。

## 条件语义

`condition_checker_loop` 每 `condition_interval` 秒（默认 60）运行一次 `check_condition`（`src/utils/scheduler.py#L81-L96`）：

1. 加载 automation；行消失或已禁用则停止循环。
2. 把 `condition_script` 拆成非空行。
3. 每行经 `execute_shell_script(line, project.work_dir, 30)` 执行——每行 30 秒的 SSH 检查（[宿主机 SSH 集成](/openwiki/integrations/host-ssh.md)）。
4. **任一行返回非零退出码即不触发返回** — 每行都须在超时内 exit 0 才开火（`src/utils/scheduler.py#L69-L75`）。
5. 只有全部行通过才运行 `execute_automation_command`。检查中的异常被吞掉，下个周期重试（`src/utils/scheduler.py#L77-L78`、`src/utils/scheduler.py#L95-L96`）。

注意工具 docstring 中较宽松的措辞（"非空/非零输出视为满足"）与实现不符；实现与 README FAQ 一致：**所有条件行必须 exit 0**（`src/tools/mcp_manage.py#L839`、`README.md#L371-L372`）。

## 触发路径

两类触发汇聚到 `execute_automation_command`（`src/utils/scheduler.py#L23-L56`）：

- 按 id 重新加载项目与命令（任一已删除则静默 no-op）。
- 把命令脚本拆行，**不做占位符替换** — `params` 为 `{}`，`command_details` 只记 `default_params`。因此规则应瞄准不依赖运行时 `${placeholders}` 的命令（README FAQ 说明自动化触发不替换占位符）。
- 以 **`actor_type="automation"`** 和 `actor_id=automation.id` 调用共享 `submit_task`，因此执行、锁、流式日志与最终审计行都走正常任务引擎路径并带自动化归属（[任务执行引擎](/openwiki/architecture/task-execution.md)）。
- 立即打 `last_run_time = now` 与 `last_run_status = "running"`；观察者此后读的是任务/审计行上的终态——触发路径不把最终结果回写 automation 行（`src/utils/scheduler.py#L54-L56`）。

因为提交是异步的，项目已被锁定时落地的 cron tick 仍会创建 `pending` 任务在项目锁上等待；同项目的重叠 tick 串行化而非并排运行。

## 配置面

| 面 | 鉴权 | 说明 |
|---|---|---|
| `GET /api/automations/{project_id}` | JWT 用户 | 分页列表，附命令 action 信息与 `last_run_*`（`src/apis/automation.py#L20-L42`） |
| `POST/PUT/DELETE /api/automations…` | JWT **admin** | 创建/更新/删除/toggle（`src/apis/automation.py#L45-L136`） |
| MCP `list_automations` | API key + `resources:read` | 按项目列出（`src/tools/mcp_manage.py#L337`） |
| MCP `manage_automation` | API key + `resources:write` | create/update/delete/toggle，带确认闸门与 `_audit` 写入（`src/tools/mcp_manage.py#L820-L1012`） |

每个 MCP 变更经 `_audit` 以 `actor_type=ai` 写审计；人类 REST 变更通过后续触发的任务/审计历史可见。

## 不变量与失败行为

- 启动只加载 `is_enabled` 规则；进程停机期间在库中被禁用的规则开机后保持休眠（`src/utils/scheduler.py#L143-L147`）。
- 删除项目的命令或项目本身会留下指向悬空外键的 automation 行；触发路径随后安静 no-op（`src/utils/scheduler.py#L28-L29`）。
- 条件脚本作为 SSH 检查跑在项目任务锁**之外**——另一任务持锁时也能执行；只有随后的命令提交才串行化。
- cron 与 condition 执行共享同一个 APScheduler/asyncio 进程：卡住的 SSH 检查会延迟该循环的下个 tick，但除事件循环争用外不阻塞 HTTP 请求处理。

## 相关页面

- [任务执行引擎](/openwiki/architecture/task-execution.md) — 规则触发后发生什么。
- [项目、命令与模板](/openwiki/concepts/projects-and-commands.md) — 规则调用的命令脚本。
- [MCP 工具参考](/openwiki/reference/mcp-tools.md) — `list_automations` / `manage_automation` 参数。
- [REST API 参考](/openwiki/reference/rest-api.md) — 自动化路由与 admin 要求。
