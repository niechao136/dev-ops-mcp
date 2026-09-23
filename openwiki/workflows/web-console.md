---
type: workflows
title: Web 控制台工作流
description: Next.js 控制台端到端——登录与 JWT cookie 处理、受保护路由、实体页（项目、密钥、审计、用户、模板、自动化）、带增量日志轮询与 SSE 的任务执行，以及经 nginx /api 走 WebSocket 的纯人类 SSH 终端面板。
tags: [web, console, nextjs, workflow, terminal, sse]
verified:
  - by: openwiki/0.5.2
    at: 2026-09-23T02:41:19.131Z
sources:
  - id: openwiki-source-c370c7d7b5c67cf07b85dd65
    resource: repo://src/apis/terminal.py
  - id: openwiki-source-9289c127e19a941ee5674e50
    resource: repo://src/services/audit_service.py
  - id: openwiki-source-33f31d77bd5ec64ff943b83a
    resource: repo://src/utils/auth.py
  - id: openwiki-source-13c8fe96d1f680fdc2148610
    resource: repo://web/app/projects/%5Bid%5D/page.tsx
  - id: openwiki-source-0d4d06c5a3f0898a16598229
    resource: repo://web/components/terminal-panel.tsx
  - id: openwiki-source-bfae268cbf1ce121dc066697
    resource: repo://web/Dockerfile
  - id: openwiki-source-f3f1bd7dd54621167419db42
    resource: repo://web/hooks/auth-query.ts
  - id: openwiki-source-44bea851a27a0734d3066b46
    resource: repo://web/hooks/use-api-keys.ts
  - id: openwiki-source-e81cba194745365cb9a5ac87
    resource: repo://web/hooks/use-audit-logs.ts
  - id: openwiki-source-73edc25ffcda5b22e415f527
    resource: repo://web/hooks/use-projects.ts
  - id: openwiki-source-81f54efe25efecfdfd6f3ec5
    resource: repo://web/hooks/use-task-execution.ts
  - id: openwiki-source-14e56945b7c632a3b335dcec
    resource: repo://web/package.json
  - id: openwiki-source-7e95a9845db9675e0b876a95
    resource: repo://web/services/api.ts
  - id: openwiki-source-3ae4ec6674d590dca2c79998
    resource: repo://web/stores/auth.ts
  - id: openwiki-source-9b951330b06a2edb301119c9
    resource: repo://web/stores/paging.ts
  - id: openwiki-source-2256223ae414bf29066ecd05
    resource: repo://web/utils/cookie.ts
generated: { by: "opencode", at: "2026-09-23T02:41:19.131Z" }
---

# Web 控制台工作流

## 技术栈

| 层 | 选型 |
|---|---|
| 框架 | Next.js 16（App Router，standalone 输出）+ React 19 |
| UI | MUI 9 + Tailwind 4 + Emotion；notistack toast；终端用 xterm.js |
| 服务端状态 | TanStack React Query 5（`useQuery`/`useMutation` + 失效） |
| 客户端状态 | Zustand 5（`stores/auth.ts`、`stores/paging.ts` 带 devtools） |
| 表单 | react-hook-form + zod |
| HTTP | `web/services/api.ts` 中包装 `fetch` 的单一 `ApiService` 类 |
| 路由 | `web/app/*` 页面：`/`、`/login`、`/projects`、`/projects/[id]`、`/api-keys`、`/audit-logs`、`/users`、`/public-commands` |

浏览器 → 网关（`:10096`）→ nginx 将 `/` 路由到 `web:3000`、`/api/` 路由到 `api:8000` 并带 WebSocket 升级头（`nginx.conf#L6-L13`、`nginx.conf#L37-L58`）。构建期固化 Base URL：`NEXT_PUBLIC_API_URL` 默认 `/api`（`web/services/api.ts#L15`）。

## 登录与会话

1. `POST /api/auth/login` 体 `{username, password}` — 无认证头（`web/services/api.ts#L55-L64`）。
2. `status=1` 时，JWT 存入 cookie `dev-ops-bot-token`，**1 天过期**，path `/`（`web/utils/cookie.ts#L33-L37`）。
3. Zustand `useAuthStore.login` 随后调 `fetchUser` → `GET /api/user/me` 填充 `user` 与 `isAuthenticated`（`web/stores/auth.ts#L23-L44`）。
4. 之后每次 API 调用经 `ApiService.request` 附 `Authorization: Bearer <token>`（`web/services/api.ts#L35-L40`）。

`useAuthCheck` / `ProtectedRoute`：

- 挂载时，`initializeAuth()` 读 cookie 并重验证 `user/me`。
- 未认证且不在 `/login` → `router.push('/login')`；在 `/login` 已认证 → 重定向 `/`（`web/hooks/auth-query.ts#L29-L53`、`web/components/protected-route.tsx`）。

登出清 cookie 并重置 store（`web/stores/auth.ts#L46-L49`）。SSR 的服务端 cookie 辅助经 `next/headers`（`web/utils/cookie.ts#L12-L26`）。

## 实体页

| 路由 | 主 hook(s) | 后端 |
|---|---|---|
| `/` 仪表盘 | `useQuery` ×3 | `/dashboard/stats`、`/dashboard/metrics`、`/projects` |
| `/projects` | `use-projects` | CRUD `/projects`，执行 `/tasks/execute` |
| `/projects/[id]` | `use-project` | 项目详情、命令、公共命令导入、自动化、终端 |
| `/api-keys` | `use-api-keys` | `/api_key` 含 regenerate/get_key |
| `/audit-logs` | `use-audit-logs` | `/audit_log` 带过滤 |
| `/users` | `use-users` | `/user` CRUD |
| `/public-commands` | `use-public-commands` | `/public_commands` + 导入 |

模式：每个 hook 持有列表的 `useQuery` 与写后调 `queryClient.invalidateQueries` 的 `useMutation`；snackbar 经 notistack。分页状态经 Zustand `paging` store 共享。

## 任务执行（人类路径）

`useTaskExecution`（`web/hooks/use-task-execution.ts`）驱动执行对话框：

1. **打开** — 从 `shell_command` 提取 `${placeholder}` 名，用 `default_params` 预填。
2. **提交** — `POST /api/tasks/execute`（不是 `/projects/execute`）体 `{project_name, action, params}`；存 `task_id`，日志偏移复位 0。
3. **轮询** — 每 **2 秒**，`GET /api/tasks/{id}?log_offset=<ref>`；把返回 `output_log` 增量追加到本地状态并把 `logOffsetRef` 推进到 `next_offset`。
4. **终态**（`success`/`failed`/`timeout`/`cancelled`）— 清 interval，toast 结果。
5. **取消** — `POST /api/tasks/{id}/cancel`，乐观置状态 `cancelled`。

注意：尽管 SSE 端点存在，**此 hook 走 REST 轮询**；`ApiService.subscribeTaskStream` 对想要推送的调用方开 `EventSource` 于 `/tasks/{id}/stream?token=<jwt>`（`web/services/api.ts#L453-L483`）。

## 终端（纯人类，独立通道）

`TerminalPanel`（`web/components/terminal-panel.tsx`）— 渲染在 `/projects/[id]`：

1. 创建 xterm.js `Terminal` + `FitAddon`，接线 `onData` → WS 发送，`onResize` → `\x00resize:cols:rows`。
2. 打开 `ws(s)://<host>/api/projects/{id}/terminal?token=<jwt>` — token 在 **query string** 因浏览器无法设 WS 头（`web/components/terminal-panel.tsx#L104-L111`）。
3. 服务端（`src/apis/terminal.py`）：验证 JWT → 加载项目 → `SSHClient.connect(work_dir)` → 双向泵；任一侧结束则取消另一侧。
4. 以非 1000 码关闭时，向终端打印 `连接已断开`。

**隔离：** 此通道从不触碰任务队列、项目锁或 AuditLog。专供交互式人类使用；MCP 无等价工具。见[宿主机 SSH 集成](/openwiki/integrations/host-ssh.md)。

## 同一后端的 Auth 对比：控制台 vs MCP

| 关注点 | 控制台 | MCP |
|---|---|---|
| 凭据 | JWT cookie（`dev-ops-bot-token`，1 天） | API key 头（除 key `expires_at` 外 UI 不管理过期） |
| 角色闸门 | 变更上的 `get_current_admin` | scopes + `allowed_projects` |
| 高危脚本 | UI 对话框（无两段式 confirm token） | `requires_confirm` / `confirm_token` 流 |
| 审计 actor | `actor_type="human"` | `actor_type="ai"` |

两者都打 `/api` 下的相同路由；只有凭据与闸门不同。

## 经 nginx 的路径（回顾）

```
浏览器
  ├─ GET /            → web:3000（Next，WS 升级头）
  ├─ fetch /api/...   → api:8000（关缓冲，600s 超时，chunked）
  ├─ EventSource /api/tasks/{id}/stream  → SSE 走同一 /api location
  └─ WS  /api/projects/{id}/terminal     → / location 上的 WebSocket 升级
```

## 相关页面

- [REST API 参考](/openwiki/reference/rest-api.md) — UI 调用的每个端点。
- [任务执行引擎](/openwiki/architecture/task-execution.md) — 轮询循环的服务端。
- [安全与授权模型](/openwiki/concepts/security.md) — JWT 生命周期与 admin 闸门。
- [部署与主机准备](/openwiki/operations/deployment.md) — web 如何构建与路由。
