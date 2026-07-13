# DevOps MCP 运维管理平台

基于 MCP (Model Context Protocol) 协议的智能运维管理平台，支持大模型通过 API 进行自动化运维操作。

## 功能特性

### 🎯 核心功能

- **项目管理**: 创建、配置和管理多个运维项目
- **命令编排**: 为每个项目配置自定义的运维命令（start、stop、restart、deploy 等），支持参数占位符和默认值设置
- **公共命令**: 创建可复用的命令模板，在多个项目间共享，支持快速导入和微调
- **API Key 管理**: 生成和管理用于 MCP 调用的 API 密钥，支持项目级权限控制，支持一键复制
- **用户管理**: 管理员和普通用户角色管理，支持修改密码
- **审计日志**: 完整记录所有操作，区分人类和 AI 操作
- **分页支持**: 所有列表页面均支持分页浏览
- **自动化规则**: 支持定时触发（cron）和条件触发（脚本检查），自动执行运维命令
- **Web 终端**: 通过 WebSocket 实现的交互式 SSH 终端，支持实时命令执行和目录导航
- **任务管理**: 异步任务执行、状态查询、增量日志获取、任务取消，支持 SSE 实时日志流

### 🤖 MCP 工具集

| 工具名称 | 功能描述 |
|---------|---------|
| `get_node_overview` | 获取当前服务器节点上所有项目列表及支持的操作（含健康状态） |
| `execute_action` | 执行指定项目的特定运维操作，支持参数占位符替换（异步） |
| `get_task_status` | 查询任务执行状态和输出日志（支持增量日志） |
| `cancel_task_action` | 取消运行中的任务，防止流程卡住 |
| `inspect_script_content` | 查看项目操作对应的底层 Shell 脚本 |
| `get_system_metrics` | 获取服务器 CPU、内存、磁盘使用情况 |
| `query_audit_logs` | 查询项目操作历史日志 |

### 🔒 安全特性

- JWT 认证机制
- API Key 加密存储（Fernet 加密）
- 项目级权限隔离
- 路径安全检查（防止目录遍历攻击）
- 操作审计追踪
- 专用运维用户（devops）和 sudo 白名单
- 高危命令确认机制（requires_confirm），标记为高危的命令需要确认后才能执行

## 技术架构

```
┌─────────────────────────────────────────────────────────────────────┐
│                        Nginx Gateway (端口 10096)                    │
└──────────────────────┬──────────────────────────────────────────────┘
                       │
        ┌──────────────┴──────────────┐
        ▼                             ▼
┌───────────────┐           ┌───────────────────┐
│  Next.js Web  │           │  FastAPI Backend  │
│   (端口 3000)  │           │    (端口 8000)    │
└───────┬───────┘           └─────────┬─────────┘
        │                             │
        ├───────── WebSocket ─────────┤
        │                             │
        └─────────────────────────────┘
                       │
        ┌──────────────┴──────────────┐
        ▼                             ▼
┌─────────────────┐         ┌─────────────────┐
│  SQLite Database │         │   APScheduler   │
│   (data/devops.db)│         │   (定时调度)    │
└─────────────────┘         └─────────────────┘
                       │
                       ▼
             ┌─────────────────┐
             │   SSH 远程执行   │
             │   (Docker Host) │
             └─────────────────┘
```

## 技术栈

### 后端
- **Python 3.x** - 编程语言
- **FastAPI** - Web 框架
- **SQLAlchemy** - ORM 框架
- **FastMCP** - MCP 协议实现
- **SQLite** - 数据库
- **python-jose** - JWT 认证
- **passlib + bcrypt** - 密码加密
- **cryptography** - Fernet 加密（API Key）
- **APScheduler** - 定时任务调度
- **paramiko** - SSH 客户端（支持 RSA、Ed25519、ECDSA 密钥）
- **psutil** - 系统指标监控

### 前端
- **Next.js 16** - React 框架
- **TypeScript** - 类型安全
- **MUI (Material UI)** - UI 组件库
- **React Query** - 数据管理
- **Zustand** - 状态管理
- **Tailwind CSS** - 样式框架

### 部署
- **Docker** - 容器化
- **Docker Compose** - 编排
- **Nginx** - 反向代理

## 快速开始

### 环境要求

- Docker 20.10+
- Docker Compose 2.0+
- Linux 操作系统 (Ubuntu/Debian)
- Root 权限（用于执行初始化脚本）

### 部署步骤

1. **克隆项目**

```bash
git clone <repository-url>
cd dev-ops-mcp
```

2. **初始化服务器环境**

在服务器上执行初始化脚本，创建专用的运维用户和 SSH 密钥：

```bash
sudo bash mcp-init.sh
```

> **脚本功能说明**:
> - 创建 `devops` 用户（用于 SSH 连接和运维操作）
> - 生成 SSH 密钥对（保存在 `/root/mcp_keys/mcp_devops`）
> - 配置 sudo 权限（Docker、Git、服务管理、目录创建等命令）
> - 加固 SSH 配置（启用公钥登录）
> - 配置 Git 全局安全目录白名单
> - 验证 SSH 连接

3. **配置环境变量**

```bash
cp .env.example .env
```

编辑 `.env` 文件：

```env
# 管理员账号配置
ADMIN_USERNAME=admin
ADMIN_PASSWORD=admin@123

# 默认 API Key 名称（用于 MCP 调用）
DEFAULT_API_KEY=default

# 密钥配置（请更换为安全的随机字符串）
JWT_SECRET=your-jwt-secret-key
API_KEY_SECRET=your-api-key-secret

# SSH 连接配置（用于远程执行命令）
HOST_SSH=host.docker.internal
HOST_SSH_PORT=22
HOST_SSH_USER=devops
HOST_SSH_KEY=/root/.ssh/id_rsa
```

4. **启动服务**

```bash
docker compose up -d
```

5. **访问平台**

- Web 界面: `http://localhost:10096`
- API 文档: `http://localhost:10096/api/docs`
- MCP 端点: `http://localhost:10096/api/mcp`

### 默认账号

- **用户名**: `admin`
- **密码**: `admin@123`

> ⚠️ **首次登录后请立即修改默认密码！**

## 项目结构

```
dev-ops-mcp/
├── src/                    # 后端 Python 代码
│   ├── apis/               # API 路由
│   │   ├── api_key.py      # API Key 管理接口
│   │   ├── auth.py         # 认证接口
│   │   ├── project.py      # 项目管理接口
│   │   ├── user.py         # 用户管理接口
│   │   ├── audit_log.py    # 审计日志接口
│   │   ├── dashboard.py    # 仪表盘接口
│   │   ├── public_command.py # 公共命令接口
│   │   ├── task.py         # 任务管理接口（异步执行、状态查询、取消）
│   │   ├── terminal.py     # WebSocket 终端接口
│   │   └── automation.py   # 自动化规则接口
│   ├── dbs/                # 数据库层
│   │   ├── db.py           # 数据库连接与初始化
│   │   ├── orm.py          # ORM 模型定义
│   │   └── migrate.py      # 数据库迁移脚本
│   ├── schemas/            # Pydantic 数据模型
│   ├── tools/              # MCP 工具定义
│   │   └── mcp.py          # MCP 工具实现
│   ├── middlewares/        # 中间件
│   │   └── mcp_auth.py     # MCP 认证中间件
│   ├── utils/              # 工具函数
│   │   ├── auth.py         # 认证工具
│   │   ├── jwt.py          # JWT 工具
│   │   ├── security.py     # 安全工具
│   │   ├── executor.py     # 命令执行器（含自动创建目录）
│   │   ├── task_executor.py # 异步任务执行器
│   │   ├── ssh_client.py   # SSH 客户端（支持多密钥类型）
│   │   ├── scheduler.py    # APScheduler 定时调度
│   │   ├── path.py         # 路径安全检查
│   │   └── context.py      # 上下文管理
│   └── main.py             # FastAPI 入口
├── web/                    # 前端 Next.js 代码
│   ├── app/                # 应用页面
│   │   ├── login/          # 登录页
│   │   ├── projects/       # 项目管理页
│   │   │   └── [id]/       # 项目详情页（含命令管理、自动化规则）
│   │   ├── public-commands/ # 公共命令管理页
│   │   ├── api-keys/       # API Key 管理页
│   │   ├── users/          # 用户管理页
│   │   └── audit-logs/     # 审计日志页
│   ├── components/         # 组件
│   │   ├── base/           # 基础组件
│   │   ├── main-layout.tsx # 主布局（侧边栏导航）
│   │   ├── protected-route.tsx # 路由保护
│   │   ├── terminal-panel.tsx # Web 终端面板（含重连按钮）
│   │   ├── automation-table.tsx # 自动化规则表格
│   │   ├── automation-dialog.tsx # 自动化规则对话框
│   │   ├── execute-dialog.tsx # 命令执行对话框
│   │   └── ...             # 其他业务组件
│   ├── hooks/              # React Hooks
│   │   ├── auth-query.ts   # 认证相关查询
│   │   ├── use-project.ts  # 项目相关查询
│   │   ├── use-task-execution.ts # 任务执行状态管理
│   │   └── ...             # 其他自定义 hooks
│   ├── providers/          # 全局 Provider
│   │   ├── query-provider.tsx # React Query Provider
│   │   └── root-provider.tsx # 根 Provider
│   ├── services/           # API 服务
│   ├── stores/             # 状态管理（Zustand）
│   ├── types/              # 类型定义
│   └── utils/              # 工具函数
├── data/                   # SQLite 数据库存储目录
├── docker-compose.yml      # Docker Compose 配置
├── nginx.conf              # Nginx 配置
├── mcp-init.sh             # 服务器初始化脚本
├── mcp-share-keys.sh       # 密钥共享脚本
└── .env.example            # 环境变量模板
```

## API 接口

### 认证模块

| 方法 | 路径 | 描述 |
|-----|------|------|
| POST | `/api/auth/login` | 用户登录 |

### 用户管理

| 方法 | 路径 | 描述 |
|-----|------|------|
| GET | `/api/user` | 获取用户列表（分页） |
| POST | `/api/user` | 创建用户 |
| GET | `/api/user/me` | 获取当前用户 |
| PUT | `/api/user/{id}` | 更新用户 |
| DELETE | `/api/user` | 删除用户 |
| POST | `/api/user/change_password` | 修改当前用户密码 |

### 项目管理

| 方法 | 路径 | 描述 |
|-----|------|------|
| GET | `/api/projects` | 获取项目列表（分页） |
| POST | `/api/projects` | 创建项目 |
| GET | `/api/projects/{id}` | 获取项目详情 |
| PUT | `/api/projects/{id}` | 更新项目 |
| DELETE | `/api/projects` | 删除项目 |
| GET | `/api/projects/{id}/commands` | 获取项目命令（分页） |
| POST | `/api/projects/{id}/commands` | 添加命令 |
| PUT | `/api/projects/{id}/commands/{command_id}` | 更新命令 |
| DELETE | `/api/projects/{id}/commands/{command_id}` | 删除命令 |
| POST | `/api/projects/execute` | 执行命令 |

### 公共命令

| 方法 | 路径 | 描述 |
|-----|------|------|
| GET | `/api/public_commands` | 获取公共命令列表（分页、搜索、标签筛选） |
| GET | `/api/public_commands/{id}` | 获取公共命令详情 |
| POST | `/api/public_commands` | 创建公共命令（管理员） |
| PUT | `/api/public_commands/{id}` | 更新公共命令（管理员） |
| DELETE | `/api/public_commands` | 批量删除公共命令（管理员） |
| POST | `/api/public_commands/import` | 导入公共命令到项目 |

### API Key 管理

| 方法 | 路径 | 描述 |
|-----|------|------|
| GET | `/api/api_key` | 获取密钥列表（分页） |
| POST | `/api/api_key` | 创建密钥 |
| GET | `/api/api_key/{id}` | 获取密钥详情 |
| PUT | `/api/api_key/{id}` | 更新密钥 |
| DELETE | `/api/api_key` | 删除密钥 |
| POST | `/api/api_key/{id}/regenerate` | 重新生成密钥 |
| POST | `/api/api_key/{id}/get_key` | 获取完整密钥（用于复制） |

### 审计日志

| 方法 | 路径 | 描述 |
|-----|------|------|
| GET | `/api/audit_log` | 获取日志列表（分页、搜索） |
| GET | `/api/audit_log/{id}` | 获取日志详情 |
| DELETE | `/api/audit_log` | 删除日志 |

### 仪表盘

| 方法 | 路径 | 描述 |
|-----|------|------|
| GET | `/api/dashboard/stats` | 获取统计数据 |

### 任务管理

| 方法 | 路径 | 描述 |
|-----|------|------|
| GET | `/api/tasks/{task_id}` | 查询任务状态（支持增量日志） |
| GET | `/api/tasks` | 获取任务列表（分页、项目/状态筛选） |
| POST | `/api/tasks/{task_id}/cancel` | 取消任务 |
| GET | `/api/tasks/{task_id}/stream` | SSE 实时日志流 |
| POST | `/api/tasks/execute` | 提交执行任务（异步） |

### 自动化规则

| 方法 | 路径 | 描述 |
|-----|------|------|
| GET | `/api/automations/{project_id}` | 获取项目的自动化规则列表（分页） |
| POST | `/api/automations` | 创建自动化规则 |
| PUT | `/api/automations/{automation_id}` | 更新自动化规则 |
| DELETE | `/api/automations/{automation_id}` | 删除自动化规则 |
| PUT | `/api/automations/{automation_id}/toggle` | 启用/禁用自动化规则 |

### Web 终端

| 方法 | 路径 | 描述 |
|-----|------|------|
| WebSocket | `/api/projects/{project_id}/terminal` | 建立交互式终端连接 |

## MCP 使用示例

### 配置 MCP 客户端

```python
from mcp import Client

client = Client("http://localhost:10096/api/mcp")
client.set_api_key("your-api-key-here")
```

### 获取节点概览

```python
result = await client.call_tool("get_node_overview")
print(result)
```

### 执行项目操作

```python
result = await client.call_tool(
    "execute_action",
    project_name="my-project",
    action="deploy",
    params={"version": "v1.0.0"}
)
print(result)
```

> **参数说明**: 如果命令配置了 `default_params`，未传入的参数会自动使用默认值。传入的参数会覆盖默认值。

### 查看脚本内容

```python
result = await client.call_tool(
    "inspect_script_content",
    project_name="my-project",
    action="start"
)
print(result)
```

### 查询任务状态（增量日志）

```python
# 首次查询，log_offset=0
result = await client.call_tool(
    "get_task_status",
    task_id="task-uuid-123",
    log_offset=0
)
print(result)

# 后续轮询，传入上次返回的 next_offset
result = await client.call_tool(
    "get_task_status",
    task_id="task-uuid-123",
    log_offset=1000
)
print(result)
```

### 取消任务

```python
result = await client.call_tool(
    "cancel_task_action",
    task_id="task-uuid-123"
)
print(result)
```

### 获取系统指标

```python
result = await client.call_tool("get_system_metrics")
print(result)
```

### 查询审计日志

```python
result = await client.call_tool(
    "query_audit_logs",
    project_name="my-project",
    hours_ago=24
)
print(result)
```

## 数据库模型

### 用户表 (users)
| 字段 | 类型 | 描述 |
|-----|------|------|
| id | int | 主键 |
| username | varchar(50) | 用户名 |
| password_hash | varchar(255) | 密码哈希 |
| role | varchar(20) | 角色 (admin/user) |
| email | varchar(100) | 邮箱 |
| is_active | bool | 是否激活 |

### API 密钥表 (api_tokens)
| 字段 | 类型 | 描述 |
|-----|------|------|
| id | int | 主键 |
| token_name | varchar(100) | 密钥名称 |
| encrypted_token | blob | 加密后的密钥 |
| token_hash | varchar(255) | 密钥哈希 |
| token_prefix | varchar(20) | 密钥前缀（用于快速识别） |
| allowed_projects | text | 允许访问的项目列表 (JSON) |
| is_active | bool | 是否激活 |
| created_by | int | 创建者用户 ID |
| created_at | datetime | 创建时间 |

### 项目表 (projects)
| 字段 | 类型 | 描述 |
|-----|------|------|
| id | int | 主键 |
| name | varchar(100) | 项目名称 |
| description | text | 项目描述 |
| work_dir | varchar(255) | 工作目录 |
| is_active | bool | 是否激活 |

### 命令表 (commands)
| 字段 | 类型 | 描述 |
|-----|------|------|
| id | int | 主键 |
| project_id | int | 所属项目 ID |
| action_type | varchar(50) | 操作类型 |
| description | text | 命令描述 |
| shell_command | text | Shell 脚本内容 |
| timeout | int | 超时时间（秒） |
| default_params | json | 可选参数默认值（JSON 格式） |
| work_dir | varchar(255) | 命令级工作目录（为空则使用项目 work_dir） |
| is_health_check | bool | 是否为健康检查命令 |
| requires_confirm | bool | 是否为高危命令，需要确认 |
| created_at | datetime | 创建时间 |

### 公共命令表 (public_commands)
| 字段 | 类型 | 描述 |
|-----|------|------|
| id | int | 主键 |
| name | varchar(100) | 命令名称 |
| action_type | varchar(50) | 操作类型 |
| description | text | 命令描述 |
| shell_command | text | Shell 脚本内容 |
| timeout | int | 超时时间（秒） |
| default_params | json | 可选参数默认值（JSON 格式） |
| tags | text | 标签（逗号分隔） |
| is_active | bool | 是否启用 |
| updated_at | datetime | 更新时间 |

### 审计日志表 (audit_logs)
| 字段 | 类型 | 描述 |
|-----|------|------|
| id | int | 主键 |
| actor_type | varchar(20) | 操作者类型 (human/ai) |
| actor_id | int | 操作者 ID |
| action_category | varchar(50) | 操作分类 |
| target_project | varchar(100) | 目标项目 |
| action_details | json | 操作详情 |
| status | varchar(20) | 状态 (success/failed/timeout) |
| output_log | text | 输出日志 |
| ip_address | varchar(50) | 操作者 IP 地址 |
| created_at | datetime | 创建时间 |

### 任务表 (tasks)
| 字段 | 类型 | 描述 |
|-----|------|------|
| id | int | 主键 |
| task_id | varchar(64) | 任务 UUID |
| project_name | varchar(100) | 项目名称 |
| action | varchar(50) | 操作类型 |
| status | varchar(20) | 状态 (pending/running/success/failed/timeout/cancelled) |
| output_log | text | 输出日志 |
| start_time | datetime | 开始时间 |
| end_time | datetime | 结束时间 |
| timeout | int | 超时时间（秒） |
| actor_type | varchar(20) | 操作者类型 (human/ai) |
| actor_id | int | 操作者 ID |
| command_details | json | 命令详情 |
| created_at | datetime | 创建时间 |

### 自动化规则表 (automations)
| 字段 | 类型 | 描述 |
|-----|------|------|
| id | int | 主键 |
| project_id | int | 所属项目 ID |
| name | varchar(100) | 规则名称 |
| trigger_type | varchar(20) | 触发类型 (cron/condition) |
| cron_expression | varchar(100) | Cron 表达式（定时触发） |
| condition_script | text | 条件检查脚本（条件触发） |
| condition_interval | int | 条件检查间隔（秒） |
| command_id | int | 关联命令 ID |
| is_enabled | bool | 是否启用 |
| last_run_time | datetime | 上次执行时间 |
| last_run_status | varchar(20) | 上次执行状态 |
| created_at | datetime | 创建时间 |
| updated_at | datetime | 更新时间 |

## 开发指南

### 本地开发

**后端开发**:

```bash
# 进入目录
cd dev-ops-mcp
# 创建虚拟环境
python -m venv .venv
# 进入 venv
.venv\Scripts\activate
# 安装依赖
uv sync
# 运行项目
python -m src.main 
```

**前端开发**:

```bash
cd web
npm install
npm run dev
```

### 工具脚本

#### `mcp-init.sh` - 服务器初始化脚本

用于初始化服务器环境，创建专用运维用户和 SSH 密钥：

```bash
sudo bash mcp-init.sh
```

功能：
- 创建 `devops` 用户
- 生成 SSH 密钥对
- 配置 sudo 权限
- 加固 SSH 配置
- 配置 Git 全局安全目录白名单

#### `mcp-share-keys.sh` - SSH 密钥共享脚本

用于将 SSH 密钥从一个用户安全复制到另一个用户，支持自动配置 known_hosts：

```bash
# 将 root 用户的 SSH 密钥共享给 devops 用户
sudo bash mcp-share-keys.sh root devops
```

功能：
- 批量复制 SSH 密钥（支持 rsa、ed25519、ecdsa、dsa）
- 自动补充 GitHub/GitLab/Gitee 的 known_hosts 指纹
- 自动修正文件权限（700、600、644）
- 验证 GitHub 连通性

### 代码规范

- Python: 使用 `black` 和 `flake8` 进行代码格式化和检查
- TypeScript: 使用 ESLint 进行代码检查

### 测试

```bash
# 运行后端测试
python -m pytest

# 运行前端测试
cd web
npm test
```

## 安全建议

1. **环境变量**: 生产环境中务必使用强随机密钥
2. **SSH 密钥**: 将 SSH 密钥文件权限设置为 `600`
3. **防火墙**: 限制 API 端口只允许内网访问
4. **HTTPS**: 生产环境启用 HTTPS
5. **备份**: 定期备份数据库文件
6. **sudo 权限**: 只授予必要的命令权限，避免使用 `NOPASSWD: ALL`

## 许可证

MIT License

## 贡献

欢迎提交 Issue 和 Pull Request！
