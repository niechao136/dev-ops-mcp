# DevOps MCP 运维管理平台

**面向 AI 的运维执行中枢**：把服务器上的项目操作（部署、重启、备份、日志清理……）封装成标准的 **MCP (Model Context Protocol)** 工具，让 Claude、Cursor、GPT 等 AI 助手在**受控、可确认、可审计**的前提下直接完成运维工作。

同时附带一个轻量的 Web 控制台，用于人工配置项目命令、管理权限与兜底操作——**人负责制定与确认，AI 负责执行**。

```
┌──────────────────┐        MCP (HTTP)         ┌───────────────────────────┐
│  Claude / Cursor │ ────────────────────────► │  DevOps MCP 节点           │
│  GPT / 自研 Agent │   execute_action          │  ├─ 项目与命令             │
│                  │ ◄──────────────────────── │  ├─ 任务执行与实时日志      │
└──────────────────┘   task_id / 增量日志       │  ├─ 自动化规则              │
                                                │  └─ 审计与权限             │
┌──────────────────┐                            │            │              │
│   Web 控制台      │ ──── 配置 / 兜底操作 ────► │            ▼              │
└──────────────────┘                            │      SSH 执行 / 服务器      │
                                                └───────────────────────────┘
```

---

## 适用场景

| 场景 | 说明 |
|------|------|
| **让 AI 真正「动手」运维** | 把部署、重启、回滚、备份等操作开放给 AI 助手执行，无需将 SSH 凭据交给模型，也无需开发专用 Agent 工具 |
| **无人值守巡检与自愈** | 通过条件触发的自动化规则周期检查（磁盘占用、服务端口、进程存活等），满足条件时自动执行修复命令，例如日志清理、服务重启 |
| **AI 辅助故障排查** | AI 按「项目全貌 → 服务器资源 → 脚本内容 → 任务日志 → 审计历史」的链路完整排查，定位问题不靠猜 |
| **团队运维经验沉淀** | 常用操作沉淀为公共命令模板并经过人工审核，AI 与人都从模板出发，避免 AI 现场手写危险脚本 |
| **多服务器 / 多项目统一管理** | 每台服务器部署一个节点实例（默认标识为 `devops-node-<主机名>`），在 AI 客户端中配置多个 MCP server 即可统一操作 |
| **有审计与合规要求的团队** | 人工、AI、自动化的一切操作全部留痕，区分操作者身份，可追溯「谁在什么时候改了什么、执行了什么」 |

## 核心优势

- **为 AI 原生设计**
  - 工具语义清晰，描述中内嵌最佳实践（先看全貌、模板优先、增量读日志），AI 上手即会用
  - 任务日志支持**增量读取**（`next_offset`），长任务轮询也不会撑爆模型上下文
  - 长耗时操作（如部署构建）异步执行，AI 不会被 HTTP 超时卡死
- **三层安全防线**
  - 权限层：API Key 的 Scope（执行 / 只读 / 管理写）+ 项目白名单
  - 流程层：高危命令二次确认 + 管理变更两段式确认（先给用户看预览，再携带令牌落库）
  - 审计层：所有操作（含 AI 与自动化）写入审计日志
- **人机同源，不会各管一摊**：Web 与 MCP 共用同一套项目、命令、自动化配置；AI 执行的就是人在网页上审核过的脚本
- **可靠的执行模型**：任务超时控制、随时取消、同一项目串行执行（避免并发冲突）、失败输出完整保留
- **轻量部署**：Docker Compose 一键启动，SQLite 存储，无外部依赖

---

## 工作原理：平台如何连接宿主机

平台自身以 **Docker 容器**运行在宿主机上，**不向宿主机安装任何 Agent**，而是通过 **SSH 回连宿主机**，以一个专用的低权限用户执行运维操作。

### 连接链路

```
宿主机（Linux）
├── sshd :22                       ▲
├── devops 用户（专用，仅密钥登录）  │ SSH 密钥认证
├── 项目目录（work_dir）            │
└── Docker                        │
    ├── gateway / web 容器         │
    └── api 容器 ──────────────────┘
        ├── 环境变量：HOST_SSH=host.docker.internal（指向宿主机）
        └── 挂载：宿主机 /root/mcp_keys/mcp_devops
                  → 容器 /root/.ssh/id_rsa（只读）
```

1. **初始化**：`mcp-init.sh` 在宿主机创建专用 `devops` 用户（禁用密码登录）与 ed25519 密钥对，并将公钥写入该用户
2. **密钥挂载**：`docker-compose.yml` 把宿主机私钥以**只读**方式挂载进 api 容器
3. **容器回连**：api 容器通过 `host.docker.internal`（host-gateway）访问宿主机 22 端口，以密钥登录 `devops` 用户
4. **执行命令**：进入项目 / 命令配置的工作目录（不存在则自动创建并把属主交还给 `devops`），以该用户身份运行脚本；如需提权，只能使用 sudo 白名单内的命令（docker、git、systemctl、journalctl、mkdir 等）
5. **结果回传**：输出实时写入任务日志，供 Web 控制台与 AI（MCP）读取

平台上三类操作的执行通道完全一致（仅 Web 终端例外，见下）：

| 触发方式 | 说明 |
|----------|------|
| Web 控制台「执行」 | 人工触发，任务异步执行 |
| AI 通过 MCP `execute_action` | AI 触发，任务异步执行 |
| 自动化规则（cron / 条件） | 调度器触发，任务异步执行 |
| Web 终端 | 独立通道：paramiko 建立交互式 shell（仅人工可用） |

### 初始化脚本做了什么（`mcp-init.sh`）

| 步骤 | 内容 |
|------|------|
| 用户 | 创建 `devops` 用户并锁定密码登录；加入 `docker`、`systemd-journal`、`adm` 用户组 |
| 密钥 | 生成 ed25519 密钥对（默认 `/root/mcp_keys/mcp_devops`），公钥写入 `authorized_keys`（700 / 600 权限） |
| 权限 | 写入 `/etc/sudoers.d/devops` 白名单：docker、docker compose、git、systemctl（start/stop/restart/status/is-active）、journalctl、mkdir、chown、chmod、at |
| 加固 | 启用 SSH 公钥登录并重启 sshd |
| 验证 | 使用新密钥执行一次真实 SSH 连接，确认连通性 |

### 这样设计的优点

1. **无侵入接入**：宿主机上不需要安装或常驻任何 Agent，仅依赖系统自带的 sshd；卸载即删除容器与用户
2. **凭据与 AI 彻底隔离**：AI 只持有平台 API Key（能力受 Scope 与项目白名单约束），SSH 私钥始终保存在宿主机、容器只读挂载，模型无法读取或导出
3. **最小权限执行**：所有操作以普通用户 `devops` 身份运行，sudo 仅放行白名单命令；即使脚本被篡改，影响面也被限制在该用户的权限范围内
4. **单一通道、天然可审计**：人工、AI、自动化的执行全部经过平台，统一写入任务与审计日志，不存在「绕过平台的暗操作」
5. **容器与宿主机隔离**：平台容器不挂载 `docker.sock`、不需要特权模式；SSH 是唯一的操作路径，边界清晰
6. **健壮的远程执行**：脚本按行拆分为步骤且**前一步失败自动熔断**；超时按进程组整体终止（不留僵尸进程）；工作目录自动创建并修正属主
7. **通用性强**：任何可通过 SSH 访问的 Linux 主机都可作为宿主机，运维对象不限于 Docker 项目，裸机服务同样适用

---

## 快速开始

### 1. 部署服务

环境要求：Linux 服务器（Ubuntu / Debian 等）、Docker 20.10+、Docker Compose 2.0+、Root 权限。

```bash
# 初始化服务器：创建专用 devops 用户、SSH 密钥、sudo 白名单
sudo bash mcp-init.sh

# 配置环境变量（管理员账号、密钥、SSH 连接信息）
cp .env.example .env

# 启动
docker compose up -d
```

| `.env` 关键变量 | 说明 |
|----------------|------|
| `ADMIN_USERNAME` / `ADMIN_PASSWORD` | 控制台管理员账号（首次启动自动创建） |
| `JWT_SECRET` / `API_KEY_SECRET` | 签名与加密密钥，务必改为强随机字符串 |
| `HOST_SSH` / `HOST_SSH_PORT` / `HOST_SSH_USER` | 被运维服务器 SSH 地址（容器内填 `host.docker.internal`）、端口、用户（默认 `devops`） |
| `HOST_SSH_KEY` | 容器内密钥路径（默认 `/root/.ssh/id_rsa`，对应宿主机 `/root/mcp_keys/mcp_devops`） |
| `MCP_NODE_NAME` | 可选，节点名称（默认取主机名），在 AI 客户端中显示为 `devops-node-<名称>` |

> 需要把已有用户的 SSH 密钥（如 GitHub 部署密钥）共享给 `devops` 用户时：`sudo bash mcp-share-keys.sh root devops`

### 2. 访问入口

| 入口 | 地址 |
|------|------|
| MCP 端点 | `http://<服务器IP>:10096/api/mcp` |
| Web 控制台 | `http://<服务器IP>:10096`（默认账号 `admin` / `admin@123`） |
| API 文档 | `http://<服务器IP>:10096/api/docs` |

### 3. 三步接入 AI

1. **配置项目**：登录控制台，新建项目（填写服务器上的工作目录），在项目内添加命令（可从公共命令库导入模板），并为命令编写/审核 Shell 脚本
2. **创建 Key**：在 API Keys 页面创建密钥，勾选所需 Scope（通常先给 `ops:execute`），复制完整密钥
3. **接入客户端**：按下方「MCP 客户端配置」填入地址与密钥，即可开始对话运维

---

## MCP 使用指南

### 1. 客户端配置

MCP 端点：`http://<服务器IP>:10096/api/mcp`

认证支持三种方式（任选其一）：

- Header：`X-API-Key: <你的API Key>`
- Header：`Authorization: Bearer <你的API Key>`
- URL 参数：`?token=<你的API Key>` 或 `?api_key=<你的API Key>`

以支持远程 HTTP MCP 的客户端（Cursor / VS Code / Windsurf 等）为例：

```json
{
  "mcpServers": {
    "devops": {
      "url": "http://<服务器IP>:10096/api/mcp/",
      "headers": {
        "X-API-Key": "<你的 API Key>"
      }
    }
  }
}
```

> 不同客户端字段名可能略有差异（如 `type: "http"`），请以客户端文档为准；仅支持本地 stdio 的客户端（如 Claude Desktop）可借助 `mcp-remote` 等桥接工具接入同一地址。多台服务器可配置为多个 server（如 `devops-prod`、`devops-test`）。

### 2. 工具参考

#### 执行与观测类（Scope：`ops:execute`）

| 工具 | 参数 | 返回 | 说明 |
|------|------|------|------|
| `get_node_overview` | — | 项目列表：名称、描述、工作目录、可用操作（含参数占位符）、健康状态 | **第一步必调**：让 AI 先了解环境全貌 |
| `execute_action` | `project_name`、`action`、`params?`、`confirm?` | `task_id`，或「项目忙」「需要确认」提示 | 异步提交运维操作；`params` 用于替换 `${占位符}` |
| `get_task_status` | `task_id`、`log_offset=0` | 状态、**增量日志**、`next_offset`、起止时间 | 轮询执行进度；状态：`pending/running/success/failed/timeout/cancelled` |
| `cancel_task_action` | `task_id` | 取消结果 | 任务卡住或误操作时使用 |
| `inspect_script_content` | `project_name`、`action` | 脚本原文、默认参数、占位符、超时、健康检查标记 | 执行前审查脚本 / 排查问题 |
| `get_system_metrics` | — | CPU、内存、磁盘使用率 | 应用异常时先看资源瓶颈 |
| `query_audit_logs` | `project_name`、`hours_ago=24` | 最近操作记录（最新 10 条） | 排查「谁改了什么」 |

#### 资源查询类（Scope：`resources:read`）

| 工具 | 参数 | 用途 |
|------|------|------|
| `list_projects` | `keyword?`、`page`、`size` | 分页查询项目（支持名称 / 描述搜索） |
| `get_project_detail` | `project_name` | 项目完整详情（含全部命令定义与脚本） |
| `list_project_commands` | `project_name`、`keyword?`、`page`、`size` | 项目命令列表（分页） |
| `search_public_commands` | `keyword?`、`tags?`、`page`、`size` | 搜索公共命令模板库 |
| `list_automations` | `project_name`、`page`、`size` | 查询项目自动化规则（含最近执行状态） |

#### 资源管理类（Scope：`resources:write`）

| 工具 | 支持的操作 | 关键参数 |
|------|-----------|----------|
| `manage_project` | `create` / `update` / `delete` | `name`、`work_dir`（创建必填）、`description`、`is_active` |
| `manage_command` | `create` / `update` / `delete` | `project_name`、`action_type`、`shell_command`、`timeout`、`default_params`、`work_dir`、`is_health_check`、`requires_confirm` |
| `manage_public_command` | `create` / `update` / `delete` / `import_to_project` | `name`、`action_type`、`shell_command`、`tags`；导入时传 `command_id` + `project_name` |
| `manage_automation` | `create` / `update` / `delete` / `toggle` | `trigger_type`（`cron` / `condition`）、`cron_expression`、`condition_script`、`condition_interval`、`command_action` |

> 管理类写操作会自动写入审计日志（操作者类型为 `ai`）。`import_to_project`、`toggle` 直接生效；`create/update` 视内容触发两段式确认（见下文「确认机制」）。

### 3. MCP Resources（只读）

支持 Resource 的客户端可直接读取，不消耗工具调用：

| URI | 内容 |
|-----|------|
| `devops://projects` | 当前有权限访问的项目清单（含可用操作与占位符） |
| `devops://projects/{project_name}/commands` | 指定项目的全部命令定义 |
| `devops://public-commands` | 公共命令模板库清单 |
| `devops://public-commands/{name}` | 单个命令模板详情 |

### 4. 典型工作流

**① 日常发布 / 执行操作**

```
get_node_overview                          # 了解项目、可用操作、需要的参数
  → inspect_script_content                 # （推荐）确认将要执行的脚本内容
  → execute_action(project_name, action,
        params={"version": "v1.2.0"})      # 提交任务，返回 task_id
  → get_task_status(task_id, log_offset)   # 轮询 + 增量拉取日志
  → 直到 success / failed / timeout
```

**② 故障排查**

```
get_system_metrics                         # 1. 资源是否瓶颈（CPU/内存/磁盘）
  → get_node_overview                      # 2. 各项目健康状态
  → get_task_status(task_id)               # 3. 拉取失败任务的完整 stderr
  → inspect_script_content                 # 4. 核对脚本是否被改动过
  → query_audit_logs                       # 5. 回溯最近谁执行过什么
```

**③ 从零搭建项目（AI 管理资源）**

```
search_public_commands                     # 1. 先找现成模板（模板优先）
  → manage_public_command(import_to_project)  # 2. 导入模板到项目（直接生效）
  → manage_command(update)                 # 3. 微调脚本（两段式确认）
  → manage_automation(create)              # 4. 配置定时 / 条件触发（条件脚本需确认）
```

### 5. 增量日志轮询

长任务不要反复全量拉日志，标准姿势：

```
# 第一次
get_task_status(task_id="xxx", log_offset=0)     → 返回日志 + next_offset=1000

# 后续每次
get_task_status(task_id="xxx", log_offset=1000)  → 只返回新增内容 + 新的 next_offset
```

AI 助手会被引导按此方式轮询，直到任务进入终态（`success` / `failed` / `timeout` / `cancelled`），避免上下文被重复日志占满。

### 6. 确认机制（人工兜底）

平台为 AI 操作设置了两层人工确认，AI 会在执行前向用户复述风险：

**① 高危命令确认**：被标记为高危（`requires_confirm`）的命令，`execute_action` 不会直接执行，而是返回 `requires_confirm` 状态；用户明确同意后，AI 携带 `confirm=true` 重新调用才会执行。适用于重启生产服务、数据清理、回滚等操作。

**② 两段式变更确认**：以下 MCP 写操作第一次调用只返回**变更预览 + `confirm_token`**，不会落库；用户确认后携带令牌二次调用才真正生效：

- 所有 `delete` 操作（项目 / 命令 / 公共命令 / 自动化规则）
- 涉及 `shell_command` 的写入（命令、公共命令的创建与修改）
- 涉及 `condition_script` 的自动化规则写入

`confirm_token` 有效期 5 分钟、一次性使用，且与操作类型绑定。

> 示例：AI 请求创建一条备份命令 → 返回预览（含最终脚本全文）→ 用户确认 → AI 携带 `confirm_token` 重试 → 创建成功。

### 7. 你可以这样对 AI 说

| 你说 | AI 会做什么 |
|------|------------|
| 「看一下有哪些项目，都健康吗？」 | `get_node_overview` → 汇总项目、健康状态与可用操作 |
| 「把 my-project 部署到 v1.2.0」 | 确认脚本 → `execute_action(params={"version": "v1.2.0"})` → 轮询日志直到完成 |
| 「my-project 刚才为什么部署失败？」 | 拉取任务 stderr → 检查系统资源 → 核对脚本与审计日志 |
| 「给我看一下 restart 到底执行的是什么脚本」 | `inspect_script_content` → 展示脚本原文与默认参数 |
| 「重启一下 my-project，这个操作要小心」 | 高危命令返回 `requires_confirm` → 用户确认后带 `confirm=true` 执行 |
| 「帮 my-project 加一个每天凌晨 3 点的备份任务」 | 搜索模板 → 导入 → 微调（两段式确认）→ 创建 cron 自动化规则 |
| 「这个任务卡太久了，取消掉」 | `cancel_task_action` |

---

## 权限与安全

### Scope 权限模型

| Scope | 覆盖范围 |
|-------|----------|
| `ops:execute` | 执行与观测类工具（默认勾选；旧密钥默认仅有此项） |
| `resources:read` | 资源查询工具 + MCP Resources |
| `resources:write` | 资源管理写工具（项目 / 命令 / 公共命令 / 自动化规则） |

- 所有按项目操作的读写还会受 Key 的**项目白名单**约束；建议为 AI 使用最小必要权限
- **凭证与身份管理不对 AI 开放**：API Key 管理、用户管理、审计日志删除没有 MCP 工具，只能通过控制台（JWT 登录）操作
- 全部 MCP 写操作写入审计日志（`actor_type=ai`），自动化触发记录为 `automation`

### 其他安全机制

- 高危命令二次确认 + 管理变更两段式确认（人工与 AI 一致）
- API Key 加密存储（Fernet），列表仅显示前缀
- 专用运维用户 `devops` + sudo 命令白名单，AI 无法通过提权执行白名单外的特权命令
- 路径安全检查（防目录遍历）

---

## Web 控制台（简要）

控制台主要用于**配置与兜底**，与 MCP 共用同一套数据：

- **仪表板**：系统资源监控（CPU / 内存 / 磁盘）与项目健康状态
- **项目管理**：创建项目、维护命令（脚本、参数占位符、超时、默认参数、健康检查、高危标记）
- **公共命令库**：沉淀可复用模板，一键导入项目（AI 也会优先从这里选模板）
- **自动化规则**：定时触发（cron，按 UTC 时间）或条件触发（周期执行检查脚本，**全部成功**时触发命令）
- **执行与日志**：网页执行命令并实时查看输出，可取消运行中任务（同项目任务串行）
- **Web 终端**：浏览器直连服务器 SSH，自动进入项目目录，支持断线重连（仅人工可用）
- **API Keys**：创建密钥、勾选 Scope、限定可操作项目、随时禁用
- **用户与审计日志**：用户 / 角色管理，追溯人工与 AI 的全部操作

---

## REST API（简要）

所有控制台能力均有 REST 接口，供自有系统集成。完整文档（Swagger UI）见 `http://<服务器IP>:10096/api/docs`。

常用端点：`POST /api/tasks/execute`（提交任务）、`GET /api/tasks/{task_id}`（查询状态，支持 `log_offset` 增量日志）、`GET /api/tasks/{task_id}/stream`（SSE 实时日志）、`POST /api/auth/login`（登录）、`GET /api/dashboard/stats`（统计）、`GET /api/health`（健康检查）。

---

## 运维与维护

```bash
docker compose logs -f api       # 查看后端日志
git pull && docker compose up -d --build   # 更新部署
```

- 数据库为 SQLite，位于宿主机 `./data` 目录；备份直接复制 `data/devops.db`
- SSH 密钥默认位于 `/root/mcp_keys/mcp_devops`，容器以只读方式挂载；更换后重启 api 容器生效

---

## 常见问题

**Q：MCP 调用返回 401？**
确认请求携带了 API Key（Header `X-API-Key` / `Authorization: Bearer` / URL `?token=`），且 Key 未被禁用。

**Q：AI 提示权限不足或工具不可用？**
检查 Key 的 Scopes：执行需 `ops:execute`，查询资源需 `resources:read`，管理资源需 `resources:write`；同时确认 Key 的项目白名单包含目标项目。

**Q：AI 执行高危命令被要求确认？**
这是预期行为。命令被标记为高危时，需要用户明确同意后 AI 才会带 `confirm=true` 重新执行。

**Q：AI 说项目「有任务正在执行」？**
同一项目任务串行。等待当前任务结束，或让 AI 取消运行中的任务后重试。

**Q：自动化规则没有按预期触发？**
定时规则使用 **UTC 时间**，请换算本地时区；条件规则要求检查脚本**全部执行成功（退出码为 0）**才触发；另外建议关联不依赖运行时参数的命令（自动化触发不会替换占位符）。

**Q：任务执行失败，如何排查？**
让 AI 拉取任务日志中的 `[STDERR]` 输出，结合 `get_system_metrics` 确认资源，必要时通过 Web 终端登录服务器手动复现。

**Q：项目健康状态一直是「未知」？**
该项目未配置健康检查命令。在命令管理中把某条命令勾选为「健康检查」即可。

---

## 安全建议

1. 首次登录后立即修改默认管理员密码
2. 生产环境务必使用强随机的 `JWT_SECRET` 与 `API_KEY_SECRET`
3. 为 AI 助手使用最小权限的 API Key（通常只需 `ops:execute`），并限制可操作项目
4. 影响面大的操作（重启、清理、回滚）一律标记为高危命令
5. SSH 密钥文件权限保持 `600`；sudo 白名单只授予必要命令，避免 `NOPASSWD: ALL`
6. 限制 10096 端口只允许内网或授信网络访问，生产环境启用 HTTPS
7. 定期备份 `data/devops.db`

---

## License

MIT License
