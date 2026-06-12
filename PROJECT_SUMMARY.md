# DevOps MCP 项目总结报告

## 1. 项目概述

**项目名称**: DevOps MCP 系统  
**项目类型**: 基于 MCP (Model Context Protocol) 的 DevOps 自动化运维平台  
**技术栈**: Python FastAPI (后端) + Next.js (前端) + Docker Compose (部署)  
**项目路径**: `d:\ai\dev-ops-mcp`

---

## 2. 项目架构

### 2.1 整体架构

```
┌─────────────────────────────────────────────────────────────┐
│                        Nginx Gateway                         │
│                       (端口: 10096)                          │
└───────────────────────┬─────────────────────────────────────┘
                        │
        ┌───────────────┴───────────────┐
        │                               │
┌───────▼─────────┐          ┌─────────▼──────────┐
│  Backend API   │          │    Frontend Web    │
│  (FastAPI)     │          │    (Next.js)       │
│  端口: 10097   │          │    内部服务        │
└───────┬─────────┘          └────────────────────┘
        │
┌───────▼─────────┐
│   MCP Server    │
│  (FastMCP)      │
└───────┬─────────┘
        │
┌───────▼─────────┐
│  SQLite DB      │
│  (data/devops.db)│
└─────────────────┘
```

### 2.2 目录结构

```
dev-ops-mcp/
├── src/                          # 后端源代码
│   ├── api/                      # API 路由
│   │   ├── auth.py               # 认证相关 API
│   │   ├── user.py               # 用户管理 API
│   │   └── api_key.py            # API Key 管理 API
│   ├── db/                       # 数据库相关
│   │   ├── db.py                 # 数据库初始化与会话管理
│   │   └── orm.py                # ORM 模型定义
│   ├── middleware/               # 中间件
│   │   └── mcp_auth.py           # MCP 认证中间件
│   ├── schema/                   # Pydantic 数据模式
│   ├── tool/                     # MCP 工具实现
│   │   └── mcp.py                # 核心 MCP 工具集合
│   ├── util/                     # 工具函数
│   │   ├── auth.py
│   │   ├── jwt.py
│   │   ├── security.py
│   │   ├── executor.py           # 命令执行器
│   │   └── context.py
│   └── main.py                   # 应用入口
├── web/                          # 前端源代码
│   ├── app/                      # Next.js App Router
│   │   ├── login/
│   │   ├── page.tsx
│   │   └── layout.tsx
│   ├── components/               # React 组件
│   ├── hooks/
│   ├── providers/
│   ├── services/
│   ├── stores/
│   ├── types/
│   └── utils/
├── data/                         # 数据目录 (SQLite 数据库)
├── static/                       # 静态文件
├── docker-compose.yml            # Docker 编排配置
├── nginx.conf                    # Nginx 配置
├── Dockerfile                    # 后端 Docker 镜像
├── requirements.txt              # Python 依赖
└── .env.example                  # 环境变量示例
```

---

## 3. 核心功能模块

### 3.1 MCP 工具集合 (src/tool/mcp.py)

该项目提供了 6 个核心 MCP 工具：

| 工具名称 | 功能描述 |
|---------|---------|
| `get_node_overview` | 获取节点上所有被管理的项目列表及可用操作 |
| `execute_action` | 执行指定项目的运维操作 (start/restart/deploy等) |
| `inspect_script_content` | 查看项目操作对应的底层 Shell 脚本 |
| `read_project_file` | 安全读取项目目录下的文件 (配置/日志等) |
| `get_system_metrics` | 获取服务器节点的系统状态 (CPU/内存/磁盘) |
| `query_audit_logs` | 查询指定项目的操作审计日志 |

### 3.2 数据库模型 (src/db/orm.py)

| 表名 | 用途 |
|-----|------|
| `users` | 用户表 (人类管理员) |
| `api_tokens` | API Key 表 (供大模型/MCP使用) |
| `projects` | 项目表 (被管理的物理项目) |
| `commands` | 指令表 (项目对应的操作脚本) |
| `audit_logs` | 审计日志表 (记录所有操作) |

### 3.3 API 接口

- **认证模块**: 用户登录、JWT 令牌管理
- **用户模块**: 用户管理
- **API Key 模块**: 密钥生成、权限配置

---

## 4. 技术栈详情

### 4.1 后端技术栈

| 技术 | 版本/用途 |
|-----|---------|
| Python | 3.11 |
| FastAPI | Web 框架 |
| FastMCP | MCP 服务实现 |
| SQLAlchemy | ORM 框架 |
| SQLite | 数据库 |
| Uvicorn | ASGI 服务器 |
| passlib | 密码哈希 |
| python-jose | JWT 处理 |
| psutil | 系统监控 |

### 4.2 前端技术栈

| 技术 | 版本/用途 |
|-----|---------|
| Next.js | 16.2.6 (React 框架) |
| React | 19.2.4 |
| TypeScript | 5.x |
| Material UI | 9.0.1 (UI 组件库) |
| TanStack Query | 5.100.14 (数据获取) |
| Zustand | 5.0.13 (状态管理) |
| React Hook Form | 7.76.1 (表单处理) |
| Zod | 4.4.3 (数据验证) |
| Tailwind CSS | 4 (样式框架) |

### 4.3 部署技术

- Docker Compose
- Nginx (反向代理)

---

## 5. 当前项目状态

### 5.1 已完成功能

✅ 后端 API 基础框架搭建  
✅ MCP 工具集核心实现  
✅ 数据库模型设计与初始化  
✅ 认证与授权系统 (JWT + API Key)  
✅ Docker 容器化配置  
✅ 前端项目框架初始化 (Next.js + MUI)

### 5.2 待完善功能

❌ 前端管理界面 (项目管理、API Key 管理等)  
❌ 项目配置管理界面  
❌ 审计日志查看界面  
❌ 系统监控可视化  
❌ 完整的错误处理和日志记录  
❌ 单元测试和集成测试  
❌ 文档完善

---

## 6. 关键文件说明

| 文件路径 | 说明 |
|---------|------|
| `src/main.py` | FastAPI 应用入口，路由注册 |
| `src/tool/mcp.py` | MCP 工具核心实现 |
| `src/db/orm.py` | 数据库模型定义 |
| `src/db/db.py` | 数据库初始化与会话管理 |
| `docker-compose.yml` | 容器编排配置 |
| `web/package.json` | 前端依赖配置 |

---

## 7. 安全特性

- API Key 加密存储
- JWT 认证
- 项目级权限控制
- 文件路径安全检查 (防止路径逃逸)
- 操作审计日志
- 文件大小限制

---

**生成时间**: 2026-06-12
