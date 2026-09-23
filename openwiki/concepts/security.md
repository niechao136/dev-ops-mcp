---
type: concept
title: 安全与授权模型
description: 分层控制模型——MCP 的 API 密钥 scope 与项目白名单、控制台的 JWT 角色、两段式确认令牌、bcrypt/Fernet 凭据处理、审计归属，以及经 devops 用户与 sudo 白名单的宿主机最小权限。
tags: [security, auth, scopes, jwt, api-keys, sudo]
verified:
  - by: openwiki/0.5.2
    at: 2026-09-23T02:41:19.131Z
sources:
  - id: openwiki-source-b79fbbd921df689b4bbdc82f
    resource: repo://docker-compose.yml
  - id: openwiki-source-be163631251a6e50825b1426
    resource: repo://mcp-init.sh
  - id: openwiki-source-23775c3de52f3ab95a13cb8b
    resource: repo://README.md
  - id: openwiki-source-963873b186750fe99f1fd465
    resource: repo://src/apis/task.py
  - id: openwiki-source-11b9d806fcc6dd6e7747ed87
    resource: repo://src/main.py
  - id: openwiki-source-331bc6f28f42bedc884164a3
    resource: repo://src/middlewares/mcp_auth.py
  - id: openwiki-source-b2200b4abd7c2422e9a0510d
    resource: repo://src/tools/mcp.py
  - id: openwiki-source-33f31d77bd5ec64ff943b83a
    resource: repo://src/utils/auth.py
  - id: openwiki-source-a9c4bf1175e019b61ae70613
    resource: repo://src/utils/confirm_store.py
  - id: openwiki-source-a4294d957be491a9aa14dc60
    resource: repo://src/utils/context.py
  - id: openwiki-source-022c79e0982a78ad8f60ba5b
    resource: repo://src/utils/executor.py
  - id: openwiki-source-1db72e8ec73cc3ebf8681de8
    resource: repo://src/utils/jwt.py
  - id: openwiki-source-91a2bd6b0c1df66ba8783dec
    resource: repo://src/utils/security.py
generated: { by: "opencode", at: "2026-09-23T02:41:19.131Z" }
---

# 安全与授权模型

## 职责

DevOps MCP 从不把 SSH 凭据交给 AI。它叠加独立的控制层，使即使完全受信的模型也只能在人类设定的策略下触碰人类配置过的东西：

| 层 | 机制 | 拦截 |
|---|---|---|
| 1. 权限 | API 密钥 **scopes** + **项目白名单**（MCP）；JWT **角色**（Web） | 未授权工具/项目/路由 |
| 2. 流程 | 高危 `requires_confirm` + 两段式**确认令牌** | 未审阅的危险动作 |
| 3. 归属 | 带 `human` / `ai` / `automation` 标签的 `AuditLog` 行 | 不可追溯的变更 |
| 4. 宿主 | `devops` 用户、锁密码、**sudo 白名单**、只读密钥挂载 | 容器/AI 提权 |

## 身份面 1：MCP 的 API 密钥

`MCPAuthMiddleware` 守护以 `/mcp` 或 `/api/mcp` 开头的路径（`src/middlewares/mcp_auth.py#L11-L65`）：

1. **提取顺序** — `X-API-Key` 头，然后 `Authorization: Bearer`，再是 query `?token=` / `?api_key=`（`src/middlewares/mcp_auth.py#L16-L27`）。缺凭证 → 401 并带提示。
2. **查找** — 只用前 8 字符（`token_prefix`）找活跃候选，再由 bcrypt `verify_api_key` 对 `token_hash` 校验全量密钥（`src/middlewares/mcp_auth.py#L35-L47`）。明文密钥从不存储；生成为 64 字符 hex，bcrypt 哈希，全值另以 Fernet 加密供控制台展示（`src/utils/security.py#L16-L21`、`src/utils/security.py#L44-L51`）。
3. **上下文** — 命中的 `ApiToken` 行放入 `current_mcp_token` ContextVar，请求后重置，下游工具无需重新认证即可读身份（`src/middlewares/mcp_auth.py#L55-L62`）。

### Scopes（能力轴）

`require_scope` / `get_scopes` 实现三种能力（`src/utils/context.py#L27-L59`）：

| Scope | 授予 |
|---|---|
| `ops:execute` | 执行/观测工具（`get_node_overview`、`execute_action`、任务状态/取消、检视、指标、审计查询） |
| `resources:read` | 只读工具与 `devops://` MCP 资源 |
| `resources:write` | `manage_project` / `manage_command` / `manage_public_command` / `manage_automation` |

`scopes = NULL` 的密钥默认**仅 `["ops:execute"]`** — 旧密钥向后兼容，也是新自动化的最小权限默认（`src/utils/context.py#L30-L31`、`src/utils/context.py#L35-L43`）。`scopes` 中非法 JSON 同样回退该默认，而非放行全部。

### 项目白名单（目标轴）

`allowed_projects` 是 JSON 数组文本列；`None` 表示全部项目，否则 `check_project` 要求请求名是成员（`src/utils/context.py#L11-L24`）。每个项目级工具（执行、检视、审计查询、manage_*）在干活前都调用它（`src/tools/mcp.py#L125-L130`）。

**Scope 与白名单独立组合：** 密钥可以持有 `resources:write` 却只白名单一个项目；或列出多个项目却缺 `ops:execute`。确认流是第三条正交轴（见下）。

凭据/密钥管理（创建、轮换、禁用、解密展示）刻意**没有 MCP 工具** — 只有 JWT 控制台用户能管理密钥，AI 无法为自己铸造更宽权限（`README.md#L309-L311`）。

## 身份面 2：Web 控制台的 JWT

- `POST /auth/login` 校验 bcrypt 密码并签发以 `JWT_SECRET`（默认 `dev-ops-mcp`）签名的 **HS256** 令牌，**30 天**过期（`src/utils/jwt.py#L13-L22`）。
- `get_current_user` 要求 `Authorization: Bearer`，验证令牌，加载用户并拒绝禁用账号（`src/utils/auth.py#L16-L54`）。
- `get_current_admin` 额外要求 `role == admin`（否则 403）— 项目/命令/模板/自动化变更与密钥/用户管理在其后（`src/utils/auth.py#L57-L64`）。

没有 refresh-token 流程；轮换 `JWT_SECRET` 一次性作废全部会话。

## 流程层：两套确认机制

### 1. 高危命令确认（`requires_confirm`）

命令被标高危时，MCP `execute_action` 返回 `requires_confirm` 状态且不入队，直到下一次调用带 `confirm=true`（`src/tools/mcp.py#L144-L151`）。工具描述要求模型先向用户复述风险。此闸门只在 MCP 路径上——人类控制台调用方在其 admin 角色边界内被信任。

### 2. 两段式管理确认（`confirm_token`）

`_confirm_or_proceed` 为 MCP 写工具实现 propose-then-commit（`src/utils/confirm_store.py#L1-L9`、`src/tools/mcp_manage.py#L86`）：

- **何时触发：** 每次 `delete`；任何触及 `shell_command` 的 create/update；任何触及 `condition_script` 的自动化 create/update（调度器会真实执行该脚本）。
- **首调** 返回预览加 `confirm_token`，**不写任何东西**。
- **二调** 带令牌才执行变更。

令牌属性（`src/utils/confirm_store.py#L16-L52`）：

- **TTL 300 秒**、**单次使用**（消费时 `pop`）、**绑定动作字符串**，动作 A 的令牌不能确认动作 B。
- 仅存**进程内存** — 重启使未消费令牌失效且无需清理；预览无副作用，重新提议始终安全。

## 凭据材料处理

| 密钥 | 存储 | 用途 |
|---|---|---|
| 用户密码 | bcrypt（`passlib`） | 控制台登录（`src/utils/security.py#L13`） |
| API 密钥 | 验证用 bcrypt `token_hash` + 展示用 Fernet `encrypted_token`；索引用 8 字符前缀 | MCP 认证（`src/utils/security.py#L16-L51`） |
| Fernet 根 | `API_KEY_SECRET` 环境变量，SHA-256 → urlsafe b64 | 未设置则**模块导入硬失败**（`src/utils/security.py#L31-L41`） |
| JWT 密钥 | `JWT_SECRET` 环境变量（弱默认） | HS256 签/验 |
| 宿主 SSH 私钥 | 宿主文件系统 `/root/mcp_keys/mcp_devops`，**只读**挂载进 api 容器 `/root/.ssh/id_rsa` | 本地 `ssh` 子进程（`docker-compose.yml#L11`） |

关键隔离属性：SSH 私钥只被容器内执行器的 `ssh -i` 命令行读取。它不由任何 MCP 工具或 REST 端点返回、不落日志、模型上下文不可及——AI 只持有能力被 scope/白名单/确认限定的 API 密钥（`README.md#L93-L99`）。

## 宿主机侧最小权限（`mcp-init.sh`）

引导脚本在宿主机上构建执行身份（`mcp-init.sh`）：

1. 创建**密码已锁**（仅密钥登录）的用户 `devops`，在存在时加入 `docker`、`systemd-journal`、`adm` 组（`mcp-init.sh#L38-L57`）。
2. 在 `/root/mcp_keys/mcp_devops` 生成 **ed25519 密钥对**（目录 `700`），公钥追加进 `authorized_keys`（`600`）（`mcp-init.sh#L70-L103`）。
3. 写入带 **NOPASSWD 白名单**的 `/etc/sudoers.d/devops`：docker/compose、git、systemctl start/stop/restart/status/is-active（`/usr/bin` 与 `/bin` 双路径）、journalctl、mkdir/chown/chmod 与 `at` — 显式 `ALL` 行存在但被注释（`mcp-init.sh#L112-L152`）。完成前用 `visudo -cf` 校验（`mcp-init.sh#L157`）。
4. 加固 sshd（开公钥认证）、重启，并用新密钥**验证回环 SSH**（`mcp-init.sh#L168-L212`）。

后果：即使通过所有应用检查的恶意脚本也只能以 `devops` 权限加白名单 sudo 动词行动——除非运维故意启用，没有无限制 root，没有 `NOPASSWD: ALL`。

## 审计归属

- 任务完成写 `AuditLog(action_category="execute_cmd", actor_type=…)`（`src/utils/task_executor.py#L158-L169`）。
- MCP 管理工具以 AI 身份写 `_audit(...)` 条目（`src/tools/mcp_manage.py` 全文）。
- 自动化触发带 `actor_type="automation"` 与 automation id。
- 人类显示为 `actor_type="human"`（控制台用户 id / token id）。

`audit_service.log_action` 设计为不抛错，审计从不打断主操作；控制台与 MCP `query_audit_logs` 读取该轨迹。

## 已知弱点（有据）

- **默认密钥：** `JWT_SECRET` 默认 `dev-ops-mcp`，`API_KEY_SECRET`/`ADMIN_PASSWORD` 有文档化的弱默认 — 生产必须经 `.env` 覆盖（`src/utils/jwt.py#L13`、`src/dbs/db.py#L47-L48`、README 安全清单）。
- **URL query 中的密钥：** MCP 接受 `?token=`，密钥可泄漏进代理/访问日志与浏览器历史；优先 header 传输（`src/middlewares/mcp_auth.py#L24-L27`）。
- **30 天 JWT 生命周期**且无吊销表，只能禁用用户行。
- API 上 **CORS `allow_origins=["*"]` 且开了凭据**（`src/main.py#L39-L45`）— 仅因令牌是 bearer 式才可接受，但值得重审。
- 高危确认与白名单在各工具处理器中执行，而非共享卡点 — 新 MCP 工具须自行接线 `check_project` / `require_scope` / `_confirm_or_proceed`。

## 相关页面

- [宿主机 SSH 集成](/openwiki/integrations/host-ssh.md) — SSH 密钥与 sudo 白名单在运行时如何被行使。
- [配置与环境](/openwiki/operations/configuration.md) — 密钥从哪里供给。
- [MCP 工具参考](/openwiki/reference/mcp-tools.md) — 哪个工具需要哪个 scope/确认。
- [AI 运维工作流](/openwiki/workflows/ai-operations.md) — 上下文中的确认流。
- [持久化与迁移](/openwiki/architecture/persistence.md) — `api_tokens` / `users` 存储。
