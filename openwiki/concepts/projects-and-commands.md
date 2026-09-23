---
type: concept
title: 项目、命令与模板
description: Web 控制台与 MCP 工具背后的共享领域模型——带工作目录的项目、带 ${param} 占位符与确认/健康标志的命令、默认参数与调用参数的合并顺序，以及可导入的公共命令模板。
tags: [projects, commands, placeholders, templates, domain]
verified:
  - by: openwiki/0.5.2
    at: 2026-09-23T02:41:19.131Z
sources:
  - id: openwiki-source-95bcd55d3a1992a683d27612
    resource: repo://src/apis/project.py
  - id: openwiki-source-614a27dd345800c754572c92
    resource: repo://src/apis/public_command.py
  - id: openwiki-source-963873b186750fe99f1fd465
    resource: repo://src/apis/task.py
  - id: openwiki-source-6af5d811b1a449559052300f
    resource: repo://src/dbs/orm.py
  - id: openwiki-source-7a0ea9f915f2a0e821758142
    resource: repo://src/services/project_service.py
  - id: openwiki-source-e5d5eb5cbccf02d10f7d2f4a
    resource: repo://src/services/public_command_service.py
  - id: openwiki-source-b2200b4abd7c2422e9a0510d
    resource: repo://src/tools/mcp.py
generated: { by: "opencode", at: "2026-09-23T02:41:19.131Z" }
---

# 项目、命令与模板

## 职责

该领域定义**可在被管服务器上执行什么**：项目（命名的工作目录）及其命令（按 `action_type` 索引的已审阅 shell 脚本）。公共命令模板提供可导入项目的可复用起点。Web 控制台写的一切与 AI `manage_*` 工具写的一切都走同一套表和基本相同的服务函数——README 所说的"人机同源"：AI 执行的正是人类在 Web 上审过的脚本。

所有者：

- `src/dbs/orm.py` — `Project`、`Command`、`PublicCommand` 表。
- `src/services/project_service.py` — 项目/命令 CRUD、占位符助手、健康检查、`submit_execute`。
- `src/services/public_command_service.py` — 模板 CRUD、搜索、`import_to_project`。
- `src/apis/project.py`、`src/apis/public_command.py` — REST 路由器。
- `src/tools/mcp_manage.py` — MCP `manage_project` / `manage_command` / `manage_public_command` / `search_public_commands`（见 [MCP 工具参考](/openwiki/reference/mcp-tools.md)）。

## 项目

项目是唯一 `name`、被管主机上必填的 `work_dir`、可选描述与 `is_active` 标志（`src/dbs/orm.py#L53-L64`）：

- **执行锚点。** `work_dir` 是 SSH `cd` 进入的目录（先 `sudo mkdir -p` + 属主恢复），除非命令用自己的 `work_dir` 覆盖（`src/services/project_service.py#L340`）。
- **所有权单元。** 命令属于项目，ORM 关系是 `cascade="all, delete-orphan"`，因此经 ORM 路径（`delete_project_cascade`）删项目会连带删命令（`src/dbs/orm.py#L64`、`src/services/project_service.py#L174-L182`）。注意 REST 批量删（`DELETE /projects` 带 id 列表）用的是 queryset 批量删（`src/services/project_service.py#L168-L171`），不跑 ORM 级联事件——优先用单项目级联路径，或在批量删后核对命令行。
- **可见性过滤。** 执行查找要求 `is_active == True`；未激活项目对 `submit_execute` 与 MCP 概览不可见（`src/services/project_service.py#L306-L311`、`src/tools/mcp.py#L53`）。
- **锁键。** 任务引擎按 `project_name` 串行，唯一名称不只影响展示（`src/utils/task_executor.py#L19-L22`）。

REST 项目变更（创建/更新/删除）需 **admin** JWT；列表与详情为任意已登录用户（`src/apis/project.py#L172-L237`）。

## 命令

命令是项目的一步操作，由项目内 `action_type`（如 `start`、`restart`、`deploy`）标识（`src/dbs/orm.py#L70-L85`）：

| 字段 | 行为 |
|---|---|
| `shell_command` | 多行 shell 脚本；每个非空行成为一个 SSH 步骤 |
| `timeout` | 总执行预算（秒，默认 600） |
| `default_params` | JSON 默认值，在调用参数之下合并 |
| `work_dir` | 可选的命令级目录；回退到项目的 |
| `is_health_check` | 把该命令标为项目健康探针 |
| `requires_confirm` | 高危标志：MCP `execute_action` 先停待用户确认 |

### 占位符提取与替换

占位符用 `${name}` 语法，仅词字符（`\$\{(\w+)\}`）：

- **提取** — `extract_placeholders()` 返回排序去重列表；MCP `get_node_overview` 与 `inspect_script_content` 用同一正则在调用 `execute_action` 前向 AI 公布 `required_params`（`src/services/project_service.py#L45-L47`、`src/tools/mcp.py#L61-L66`）。
- **合并顺序** — 执行时参数按 `{**(command.default_params or {}), **(params or {})}` 合并：**命令默认在先、调用参数在后，键冲突时调用方胜**（`src/services/project_service.py#L321`）。
- **替换** — 对每个合并键，原始脚本中每个 `${key}` 被替换为 `str(value)`；然后脚本拆成非空行交给步骤执行器（`src/services/project_service.py#L322-L328`）。
- **审计细节** — 原始脚本、调用参数与默认参数一起存入 `command_details`，审计者可对照替换前意图与已执行步骤（`src/services/project_service.py#L330-L334`）。

自动化触发**不**替换占位符（automation 传 `params={}` 且不合并调用参数——见[自动化](/openwiki/concepts/automation.md)），因此绑到规则的命令应仅依赖默认值或没有占位符。

### 确认闸门

仅对 MCP 执行，`execute_action` 在调服务前预检 `command.requires_confirm`：标志为真且 `confirm` 为假时，工具返回 `requires_confirm` JSON 且不入队；带 `confirm=true` 的第二次调用才继续（`src/tools/mcp.py#L144-L151`）。REST `POST /tasks/execute` 与 `POST /projects/execute` **不**复查该标志——高危强制是面向 AI 的控制，控制台上的人类 REST 调用方被信任（见[安全](/openwiki/concepts/security.md)）。

### 健康检查

- 每项目至多**一个**命令可为健康检查；`set_health_check()` 在设置新标志前清除先前标志（若已设置则为取消切换）（`src/services/project_service.py#L268-L285`）。
- **快速检查**（用于项目列表与 MCP 概览）：每行以 `min(command.timeout, 30)` 秒 SSH 超时执行，外层 35 秒封顶；返回 `healthy` / `unhealthy`，无健康命令/行时为 `unknown`（`src/services/project_service.py#L53-L82`）。
- **详细检查**（`GET /projects/{id}/health_check`）：每行用命令完整超时，首败即停，返回逐步 command/status/exit_code/output（`src/services/project_service.py#L85-L115`）。
- 两条路径都经 `execute_shell_script` 同步执行——健康探针绕过任务队列与项目锁。

### 共享配置（Web ↔ MCP）

| 关注点 | REST（Web） | MCP（AI） |
|---|---|---|
| 项目/命令 CRUD | `apis/project.py` 走 `project_service.*`，admin JWT | `manage_project` / `manage_command` 同服务，scope `resources:write` + 确认闸门 |
| 执行 | `POST /projects/execute` → `submit_execute`；`POST /tasks/execute` → 内联重复逻辑 | `execute_action` → `submit_execute` |
| 健康 | 列表/详情/健康端点 | `get_node_overview` 内嵌快速健康 |

因为两侧读同一批 `projects`/`commands` 行，AI 只能跑控制台配置里存在的脚本——模型临场编造 shell 的反模式被设计阻断（概览只公布已配置的 `action_type`）。

## 公共命令模板

模板（`public_commands`）是全局库：`name`、`action_type`、脚本字段、逗号分隔 `tags`、`is_active` 与 `updated_at`（`src/dbs/orm.py#L91-L104`）。

- **搜索** 只列 `is_active` 模板；关键词匹配 name/description/action_type，每个逗号分隔的标签过滤成为额外 `ilike` 子句（标签间 AND）（`src/services/public_command_service.py#L16-L49`）。
- **导入**（`import_to_project`）把模板**复制**成真实 `Command`：相同 `action_type` 与脚本、可选描述/超时覆盖、继承 `default_params`；模板非链接——后续模板修改不传播（`src/services/public_command_service.py#L117-L155`）。
- MCP 导入路径传 `check_duplicate_action=True`，项目不会因导入出现两个相同 `action_type` 的命令；REST 导入/批量导入不强制该校验，批量模式静默跳过无效 id（`src/services/public_command_service.py#L137-L141`、`src/apis/public_command.py#L185-L209`）。
- 模板 CRUD 需 admin JWT；**导入**对任意已登录用户可用（`src/apis/public_command.py#L88-L176`）。MCP `manage_public_command` 镜像 CRUD，脚本写入带确认闸门，`import_to_project` 操作按 AI 活动审计。

## 失败行为

- 创建重名项目抛 `ValueError` → REST `DataResult(status=0)` / MCP 错误文本（`src/services/project_service.py#L128-L129`）。
- 执行未知项目/动作，或替换后为空的脚本，在任何任务行存在之前由 `submit_execute` 抛 `ValueError`（`src/services/project_service.py#L310-L328`）。
- 未配置时健康检查降级为 `unknown`（快速）或 `ValueError` 形状消息（详细）——绝不假 `healthy`（`src/services/project_service.py#L58-L64`、`src/services/project_service.py#L91-L97`）。

## 相关页面

- [持久化与迁移](/openwiki/architecture/persistence.md) — 该领域的表 schema。
- [任务执行引擎](/openwiki/architecture/task-execution.md) — `submit_execute` 之后发生什么。
- [安全与授权模型](/openwiki/concepts/security.md) — admin/scope 闸门与确认流。
- [AI 运维工作流](/openwiki/workflows/ai-operations.md) — 发现 → 检视 → 执行循环。
- [Web 控制台工作流](/openwiki/workflows/web-console.md) — 人类配置 UI。
