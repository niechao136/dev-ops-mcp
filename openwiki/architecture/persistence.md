---
type: architecture
title: 持久化与迁移
description: DevOps MCP 如何用单一 SQLite 数据库（data/devops.db）保存持久状态、八张领域表、容器启动时运行的手写迁移脚本，以及补充数据库的进程内存存储。
tags: [persistence, sqlite, migrations, database, schema]
verified:
  - by: openwiki/0.5.2
    at: 2026-09-23T02:41:19.131Z
sources:
  - id: openwiki-source-84f63a65c6b0c17aaa234838
    resource: repo://data/.gitignore
  - id: openwiki-source-bb1ebe868e35e9e500714501
    resource: repo://Dockerfile
  - id: openwiki-source-3b3c2845ec459547b71d8ae5
    resource: repo://src/dbs/db.py
  - id: openwiki-source-6af0883dab8fd643d256cf0a
    resource: repo://src/dbs/migrate.py
  - id: openwiki-source-6af5d811b1a449559052300f
    resource: repo://src/dbs/orm.py
  - id: openwiki-source-11b9d806fcc6dd6e7747ed87
    resource: repo://src/main.py
  - id: openwiki-source-a9c4bf1175e019b61ae70613
    resource: repo://src/utils/confirm_store.py
  - id: openwiki-source-ae0da53766437d3809458eb4
    resource: repo://src/utils/task_executor.py
generated: { by: "opencode", at: "2026-09-23T02:41:19.131Z" }
---

# 持久化与迁移

## 职责

后端把全部持久记录——用户、API 密钥、项目、命令、模板、任务、审计历史、自动化规则——保存在单个 SQLite 文件中。手写迁移脚本在 API 服务器启动前运行，应用 lifespan 启动时再执行 SQLAlchemy `create_all` 与种子数据写入。易变的协调状态（确认令牌、运行中任务句柄、项目锁）刻意放在进程内存而非数据库中。

所有权完全在 `src/dbs/`：`db.py` 负责引擎/会话/种子，`orm.py` 负责模型定义，`migrate.py` 负责 schema 升级。调用方通过 `get_db_session()` 上下文管理器访问数据库。

## 存储位置与引擎

- 库文件是 `<repo>/data/devops.db`，导入时由 `ROOT_DIR` 解析；`data/` 目录按需创建（`src/dbs/db.py#L25-L28`）。
- SQLAlchemy 以 `sqlite:///data/devops.db` 打开，并带 `connect_args={"check_same_thread": False}`，因为 FastAPI 从线程池提供服务（`src/dbs/db.py#L31-L35`）。
- `get_db_session()` 产出会话并始终关闭它（`src/dbs/db.py#L38-L44`）。
- `data/.gitignore` 忽略除自身以外的一切，因此库文件从不入库（`data/.gitignore#L1-L2`）。除在用的 `devops.db` 外，工作副本中还有一个零字节的 `data.db`，没有任何代码路径打开它——应视为来源不明的遗留物，不属于运行时。

备份与恢复因此就是复制 `data/devops.db` 文件（无论栈在运行还是停止；README 运维章节推荐复制该文件）。

## Schema：八张表

在 `src/dbs/orm.py` 中声明式定义：

| 表 | 职责 | 关键列 |
|---|---|---|
| `users` | 控制台人类账号 | 唯一 `username`、bcrypt `password_hash`、`role`（admin/user）（`src/dbs/orm.py#L14-L26`） |
| `api_tokens` | MCP 密钥 | Fernet `encrypted_token`（bytes）、bcrypt `token_hash`（唯一）、展示用 `token_prefix`、JSON 文本 `allowed_projects` 与 `scopes`（`src/dbs/orm.py#L32-L47`） |
| `projects` | 被管理项目 | 唯一 `name`、`work_dir`；级联删除其命令（`src/dbs/orm.py#L53-L64`） |
| `commands` | 项目级 shell 操作 | `shell_command`、`timeout`、`default_params` JSON、可选 `work_dir` 覆盖、`is_health_check`、`requires_confirm`（`src/dbs/orm.py#L70-L85`） |
| `public_commands` | 可复用模板 | 同类脚本字段加逗号分隔 `tags`，导入时复制进项目（`src/dbs/orm.py#L91-L104`） |
| `audit_logs` | 谁做了什么的历史 | `actor_type`（human/ai/automation）、`action_category`、`action_details` JSON、`output_log`（`src/dbs/orm.py#L110-L132`） |
| `tasks` | 异步执行记录 | 唯一 UUID `task_id`、`status`、不断增长的 `output_log` TEXT、`actor_type`/`actor_id`、`command_details` JSON（`src/dbs/orm.py#L138-L153`） |
| `automations` | 定时/条件规则 | `trigger_type`、`cron_expression`/`condition_script`、指向项目与命令的外键、`last_run_*` 反馈（`src/dbs/orm.py#L159-L177`） |

读写行时有两条存储约定值得注意：

- **JSON 作为文本列。** `allowed_projects`、`scopes`、`tags` 是 `Text` 列，存放 JSON 数组或逗号分隔值，而非 SQL JSON 类型；空/NULL `allowed_projects` 表示"全部项目"（`src/dbs/orm.py#L40-L41`）。
- **日志写在行内。** 任务的完整终端输出累积在 `tasks.output_log`，审计条目在 `audit_logs.output_log` 快照输出；没有独立的日志文件存储（`src/dbs/orm.py#L128`、`src/dbs/orm.py#L146`）。

任务 `status` 经过 `pending → running → success | failed | timeout | cancelled`（`src/dbs/orm.py#L145`），状态迁移的归属见[任务执行引擎](/openwiki/architecture/task-execution.md)。

## 启动顺序：先迁移，再种子

每次容器启动都会运行两套独立机制：

1. **先做命令式迁移。** 镜像 `CMD` 执行 `python -m src.dbs.migrate && uvicorn src.main:app --host 0.0.0.0 --port 8000`（`Dockerfile#L48`）。`migrate_database()` 用裸 `sqlite3` 打开文件，若文件尚不存在则打印警告并返回——全新安装交给 `create_all`（`src/dbs/migrate.py#L12-L15`）。
2. **lifespan 中 ORM 建表 + 种子。** FastAPI lifespan 在启动调度器前调用 `init_db()`（`src/main.py#L25-L33`）。`init_db()` 运行 `Base.metadata.create_all`，然后：
   - 若用户名不存在，按 `ADMIN_USERNAME`/`ADMIN_PASSWORD`（默认 `admin` / `admin@123`）创建管理员（`src/dbs/db.py#L47-L74`）；
   - 当没有 `api_tokens` 行的 `token_name == DEFAULT_API_KEY`（默认 `"default"`）时生成默认 MCP API 密钥：明文只展示一次，以 Fernet 加密存储、bcrypt 哈希、加前缀，并绑定到管理员用户（`src/dbs/db.py#L76-L102`）。

健康端点用同一会话助手执行 `SELECT 1` 证明连通性（`src/main.py#L64-L70`）。

## 迁移实际改了什么

没有 Alembic，也没有带版本号的迁移历史。`migrate.py` 检查实时 schema 状态并幂等地应用增量修复：

- 对累积列做 `ALTER TABLE ... ADD COLUMN`：`api_tokens.created_at`/`scopes`、`projects.created_at`、`commands.created_at`/`default_params`/`is_health_check`/`work_dir`/`requires_confirm`（`src/dbs/migrate.py#L24-L108`）；
- 对缺失的表做 `CREATE TABLE`：`public_commands`、`tasks`（外加 `task_id`、`project_name`、`status`、`created_at` 四个索引）以及 `automations`（外键索引）（`src/dbs/migrate.py#L110-L192`）；
- 并发/重复 `ALTER` 引发的 `OperationalError` 被捕获并记为 info；更大的失败会回滚事务并打印错误，而不是让启动崩溃（`src/dbs/migrate.py#L196-L199`）。

后果：迁移从不删除或重命名列、从不降级、从不重写数据。裸 SQL `CREATE TABLE` 默认值与 SQLAlchemy 模型之间对新建表可能存在列类型漂移，因此对全新数据库以 `create_all` 为准，`migrate.py` 只升级已有数据库。

## 从不落 SQLite 的内存状态

三个进程本地存储补充数据库，重启即重置：

| 存储 | 位置 | 生命周期 |
|---|---|---|
| 确认令牌（`_PENDING`） | `src/utils/confirm_store.py#L16-L19` | 5 分钟 TTL、单次使用、绑定一个动作字符串；按设计重启即丢失（`src/utils/confirm_store.py#L1-L9`） |
| 运行中任务注册表、项目锁、结果缓存 | `src/utils/task_executor.py#L14-L16` | 仅进程运行期间存在；任务的持久真相是 `tasks` 行 |
| 调度器任务句柄 | `src/utils/scheduler.py`（APScheduler + asyncio 循环） | lifespan 启动时从 `automations` 行重建 |

因为确认令牌只在内存中，API 重启会使未完成的确认全部失效且无需任何清理——预览无副作用，可安全重新提议。

## 失败行为与运维注意

- 已有卷上缺失或损坏的 `data/devops.db` 会使 `migrate.py` 警告并提前退出；随后 `init_db`/`create_all` 会静默重建空 schema、孤立旧数据——应从备份恢复，不要依赖这条路径。
- 首次启动时种子过程会把默认管理员密码与默认 API 密钥明文打进容器日志（`src/dbs/db.py#L70-L72`、`src/dbs/db.py#L98-L99`）；首次登录后请立即通过控制台与 `.env` 轮换两者。
- 因为 `data/` 是 bind 挂载卷（`docker-compose.yml` 挂载 `./data:/app/data`），数据库持久性依赖宿主机文件系统，而非容器层。

## 相关页面

- [任务执行引擎](/openwiki/architecture/task-execution.md) — 谁迁移 `tasks.status` 并追加 `output_log`。
- [项目、命令与模板](/openwiki/concepts/projects-and-commands.md) — 该 schema 所存行的语义。
- [安全与授权模型](/openwiki/concepts/security.md) — `api_tokens` scopes 与哈希如何被消费。
- [配置与环境](/openwiki/operations/configuration.md) — 种子阶段用到的 `ADMIN_*`、`DEFAULT_API_KEY` 与密钥变量。
- [部署与主机准备](/openwiki/operations/deployment.md) — 卷挂载、启动命令与备份流程。
