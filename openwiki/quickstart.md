---
type: navigation
title: 快速开始与任务路由
description: 入口页——简要系统摘要、首次启动命令、紧凑的 wiki 分类地图，以及把读者导向正确深入页面的简短症状或目标条目。
tags: [quickstart, navigation, tasks, routing]
verified:
  - by: openwiki/0.5.2
    at: 2026-09-23T02:41:19.131Z
sources:
  - id: openwiki-source-b79fbbd921df689b4bbdc82f
    resource: repo://docker-compose.yml
  - id: openwiki-source-bb1ebe868e35e9e500714501
    resource: repo://Dockerfile
  - id: openwiki-source-ca698d0db8d141f7e7059df0
    resource: repo://nginx.conf
  - id: openwiki-source-23775c3de52f3ab95a13cb8b
    resource: repo://README.md
  - id: openwiki-source-11b9d806fcc6dd6e7747ed87
    resource: repo://src/main.py
  - id: openwiki-source-331bc6f28f42bedc884164a3
    resource: repo://src/middlewares/mcp_auth.py
  - id: openwiki-source-b2200b4abd7c2422e9a0510d
    resource: repo://src/tools/mcp.py
  - id: openwiki-source-a4294d957be491a9aa14dc60
    resource: repo://src/utils/context.py
  - id: openwiki-source-91a2bd6b0c1df66ba8783dec
    resource: repo://src/utils/security.py
generated: { by: "opencode", at: "2026-09-23T02:41:19.131Z" }
---

# 快速开始与任务路由

## 这是什么（30 秒）

**DevOps MCP** 是一个自托管平台，把受管项目与 shell 命令同时暴露给 **Web 控制台**（人类，JWT）和 **AI 客户端**（MCP，API keys）。三个 Docker 服务：nginx 网关在 **:10096**、Next.js web、带 SQLite 的 FastAPI+FastMCP api。api 只经 SSH 到达宿主机 — 无 docker.sock，无 agent。

## 首次启动（5 条命令）

```bash
sudo bash mcp-init.sh          # devops 用户 + SSH 密钥 + sudo 白名单
cp .env.example .env           # 设置 JWT_SECRET、API_KEY_SECRET、ADMIN_*、HOST_SSH*
docker compose up -d --build   # api CMD 中先跑迁移再起 uvicorn
open http://<host>:10096       # 登录（首启凭据打印在日志里）
# MCP: http://<host>:10096/api/mcp  带 X-API-Key
```

细节见：[部署](/openwiki/operations/deployment.md) · [配置](/openwiki/operations/configuration.md)

## Wiki 地图

```
openwiki/
├── quickstart.md              ← 你在这里
├── architecture/              如何构建
│   ├── system-overview.md     拓扑、入口、请求路径
│   ├── task-execution.md      异步任务生命周期、锁、日志
│   └── persistence.md         SQLite、8 张表、migrate.py、备份
├── concepts/                  领域词汇
│   ├── projects-and-commands.md   work_dir、脚本、${params}、模板
│   ├── automation.md              cron/condition 规则、调度器
│   └── security.md                JWT vs API keys、scopes、确认、sudo
├── workflows/                 端到端追踪
│   ├── ai-operations.md       MCP 调用 → 闸门 → 任务 → 轮询 → 审计
│   └── web-console.md         登录、页面、SSE/轮询、终端
├── reference/                 查阅
│   ├── mcp-tools.md           每个工具、scope、确认、资源
│   └── rest-api.md            每个路由、信封、认证方式
├── operations/                运行它
│   ├── deployment.md          compose、nginx、引导、日常
│   └── configuration.md       每个环境变量及其消费方
├── integrations/
│   └── host-ssh.md            唯一的宿主机边界（subprocess + paramiko）
└── testing/
    └── verification.md        实际存在的门禁（剧透：没有测试）
```

## 任务 → 页面路由

| 我想… | 去这里 |
|---|---|
| 部署或升级栈 | [部署](/openwiki/operations/deployment.md) |
| 设置/轮换密钥或 `HOST_SSH*` | [配置](/openwiki/operations/configuration.md) |
| 连接 Claude/Cursor/任一 MCP 客户端 | [MCP 工具参考](/openwiki/reference/mcp-tools.md) + [AI 运维](/openwiki/workflows/ai-operations.md) |
| 创建项目或添加命令脚本 | [项目与命令](/openwiki/concepts/projects-and-commands.md) |
| 理解 AI 说“重启”时跑了什么 | [AI 运维](/openwiki/workflows/ai-operations.md) |
| 调试失败/挂起的任务 | [任务执行](/openwiki/architecture/task-execution.md) → 查 `output_log`；然后 [宿主机 SSH](/openwiki/integrations/host-ssh.md) |
| 修 SSH / 权限 / sudo 错误 | [宿主机 SSH](/openwiki/integrations/host-ssh.md) + [安全](/openwiki/concepts/security.md) |
| 调度 cron 或健康检查自动化 | [自动化](/openwiki/concepts/automation.md) |
| 用 Web UI 或打开终端 | [Web 控制台](/openwiki/workflows/web-console.md) |
| 查端点或工具名 | [REST API](/openwiki/reference/rest-api.md) / [MCP 工具](/openwiki/reference/mcp-tools.md) |
| 管理 API keys、用户、审计轨迹 | [安全](/openwiki/concepts/security.md) + [REST API](/openwiki/reference/rest-api.md) |
| 备份或恢复数据库 | [持久化](/openwiki/architecture/persistence.md) |
| 知道如何验证变更 | [验证](/openwiki/testing/verification.md) |
| 看整体架构 | [系统总览](/openwiki/architecture/system-overview.md) |

## 常见症状

| 症状 | 可能的页面 |
|---|---|
| 进程退出：`API_KEY_SECRET 环境变量未设置` | [配置](/openwiki/operations/configuration.md) |
| MCP 401 invalid key | [安全](/openwiki/concepts/security.md) — 密钥禁用/过期/头不对 |
| 工具被拒：缺 `resources:write` | [MCP 工具](/openwiki/reference/mcp-tools.md) — 默认 scope 仅 `ops:execute` |
| 任务卡在 `pending`/`running` | [任务执行](/openwiki/architecture/task-execution.md) — 项目锁被持有 |
| `execute_action` 返回 `requires_confirm` | [AI 运维](/openwiki/workflows/ai-operations.md) — 两段式调用 |
| 终端 WS 关闭码 1008/1011 | [Web 控制台](/openwiki/workflows/web-console.md) + [宿主机 SSH](/openwiki/integrations/host-ssh.md) |
| `host.docker.internal` 不可达 | [部署](/openwiki/operations/deployment.md) — extra_hosts / HOST_SSH |
| 重新部署后登录循环 | [配置](/openwiki/operations/configuration.md) — JWT_SECRET 变了 |

## 相关页面

- [系统总览](/openwiki/architecture/system-overview.md) — 架构的深度入口。
- [部署](/openwiki/operations/deployment.md) — 完整引导与日常运维。
- [AI 运维](/openwiki/workflows/ai-operations.md) — 主要的自动化工作流。
