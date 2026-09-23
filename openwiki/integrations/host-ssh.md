---
type: integration
title: 宿主机 SSH 集成
description: 通向被管主机的唯一运维边界——批任务的 OpenSSH CLI 包装、Web 终端的 paramiko PTY、密钥挂载、工作目录创建与受保护路径、sudo 白名单限制，以及为何不存在 docker.sock 或 agent。
tags: [ssh, host, paramiko, openssh, integration, sudo]
verified:
  - by: openwiki/0.5.2
    at: 2026-09-23T02:41:19.131Z
sources:
  - id: openwiki-source-b79fbbd921df689b4bbdc82f
    resource: repo://docker-compose.yml
  - id: openwiki-source-bb1ebe868e35e9e500714501
    resource: repo://Dockerfile
  - id: openwiki-source-be163631251a6e50825b1426
    resource: repo://mcp-init.sh
  - id: openwiki-source-86e198ce7cdf535553f82f94
    resource: repo://mcp-share-keys.sh
  - id: openwiki-source-23775c3de52f3ab95a13cb8b
    resource: repo://README.md
  - id: openwiki-source-c370c7d7b5c67cf07b85dd65
    resource: repo://src/apis/terminal.py
  - id: openwiki-source-022c79e0982a78ad8f60ba5b
    resource: repo://src/utils/executor.py
  - id: openwiki-source-9fcc0ca2c2dacd1cad10a695
    resource: repo://src/utils/ssh_client.py
  - id: openwiki-source-ae0da53766437d3809458eb4
    resource: repo://src/utils/task_executor.py
generated: { by: "opencode", at: "2026-09-23T02:41:19.131Z" }
---

# 宿主机 SSH 集成

## 为何 SSH 是边界

平台完全跑在 Docker 里，刻意**不挂 `docker.sock`、不用特权模式、不装宿主 agent**。对被管机器的每个效果都流经从 api 容器*发起*回宿主 sshd 的 SSH 连接——README 的"无侵入接入"设计（`README.md#L49-L72`、`README.md#L93-L99`）。

连接要素：

| 要素 | 值 | 来源 |
|---|---|---|
| 目标主机 | `HOST_SSH` 默认 `host.docker.internal` | compose `extra_hosts: host-gateway`（`docker-compose.yml#L7-L8`） |
| 端口 / 用户 | `HOST_SSH_PORT=22`、`HOST_SSH_USER=devops` | `.env` / `executor.py` 与 `ssh_client.py` 默认值 |
| 私钥 | `HOST_SSH_KEY=/root/.ssh/id_rsa` | bind 挂载 `/root/mcp_keys/mcp_devops` → 容器，**只读**（`docker-compose.yml#L11`） |
| 宿主准备 | `devops` 用户、密钥对、sudo 白名单 | `mcp-init.sh`（见[安全](/openwiki/concepts/security.md)） |

两个执行模块在导入时读取相同环境默认：`src/utils/executor.py#L12-L15` 与 `src/utils/ssh_client.py#L12-L15`。

## 两套 SSH 客户端，两个职责

代码库刻意保留**两套** SSH 栈：

### 1. OpenSSH CLI 子进程 — 批执行

被任务引擎、健康检查与自动化条件脚本使用。`_build_ssh_command()` 字符串拼装本地 `ssh` 调用（`src/utils/executor.py#L32-L49`）：

```
ssh -i $SSH_KEY -o StrictHostKeyChecking=no -o ConnectTimeout=10 \
    -p $SSH_PORT $SSH_USER@$SSH_HOST \
    '<mkdir/chown> && cd <work_dir> && <command line>'
```

- 经 `asyncio.create_subprocess_shell` 运行，带 `preexec_fn=os.setsid`，超时可对整棵树 `killpg`（[任务执行引擎](/openwiki/architecture/task-execution.md)）。
- `StrictHostKeyChecking=no` — 因目标是 compose 定义的 host-gateway 尚可接受，但意味着客户端不会检测主机键变化。
- 远端是一次非交互 shell 调用；步骤间无持久会话——每行步骤开一条新 SSH 连接。
- 需要运行时镜像中的 `openssh-client` 包（`Dockerfile#L41-L43`）。

### 2. paramiko PTY — 交互式 Web 终端

仅被 `WS /api/projects/{id}/terminal` 使用（`src/apis/terminal.py#L32-L140`、`src/utils/ssh_client.py`）：

- `SSHClient.connect()` 依次尝试 **RSA → Ed25519 → ECDSA** 解析器加载同一密钥文件（文件路径，再内存内容），10 秒超时连接，`invoke_shell(term='xterm', 80×24)` 拿非阻塞 PTY（`src/utils/ssh_client.py#L26-L66`）。
- 连接后发送 `cd <project.work_dir>`，操作者落在项目目录（`src/utils/ssh_client.py#L54-L56`）。
- WebSocket 路由先验 JWT（query `token` 或 `Authorization` 头），拒绝未知项目，再跑两个泵：SSH→WS 读与 WS→SSH 写；`\x00resize:w:h` 控制帧调整 PTY，任一侧断开取消另一侧以防僵尸协程（`src/apis/terminal.py#L40-L132`）。
- **仅人类：** 没有打开交互 shell 的 MCP 工具；终端绕过任务队列、项目锁与逐步审计——这就是它要控制台 JWT 而非 API 密钥的原因。

| | 批任务 | Web 终端 |
|---|---|---|
| 客户端 | 系统 `ssh` 二进制 | paramiko |
| 会话 | 每步一次性 | 长生命周期 PTY |
| 认证 | API 密钥 → 任务提交（间接） | WebSocket 上的 JWT |
| 锁/审计 | 项目锁 + AuditLog | 都没有 |
| 超时 | 总预算 + killpg | 直到 WebSocket 关闭 |

## 工作目录生命周期

每条批 SSH 命令先准备目录（`src/utils/executor.py#L36-L41`）：

1. `sudo mkdir -p <work_dir>` — 即使 `devops` 不能创建父目录也可用（依赖 sudo 白名单中的 `mkdir` 条目）。
2. `sudo chown <user>:<user> <work_dir>` — 恢复属主，使后续 `devops` 属主的操作（终端 `vi`、`cp`）不撞权限拒绝——**受保护路径跳过**。
3. `cd <work_dir> && <command>`。

`_PROTECTED_PATHS` 是固定系统根集合（`/`、`/etc`、`/var`、`/usr` 等）；`work_dir` 归一化落入该集时省略 chown，错误配置的项目不能重属主系统目录（`src/utils/executor.py#L18-L29`）。

生效目录解析：提交时 `command.work_dir or project.work_dir`（`src/services/project_service.py#L340`）；终端用 `project.work_dir or "/"`（`src/apis/terminal.py#L75`）。

## sudo 白名单作为特权下限

运行时命令以 `devops` 身份执行。提权只可能对 `/etc/sudoers.d/devops` 中列出的动词，由 `mcp-init.sh` 写入（`mcp-init.sh#L112-L152`）：

- `docker`、`docker compose`、`docker-compose`
- `git`
- `systemctl start|stop|restart|status|is-active`（`/usr/bin` 与 `/bin` 双拼写）
- `journalctl`
- `mkdir`、`chown`、`chmod`
- `at`

`NOPASSWD: ALL` 只作为注释模板行存在；引导时 `visudo -cf` 校验该文件（`mcp-init.sh#L150-L157`）。需要其他权限的脚本无论平台应用层检查放行什么都必须被此下限拒绝——纵深防御。

## Git 平台的密钥共享

`mcp-share-keys.sh [src] [dst]`（默认 `root → devops`）在用户间复制标准密钥文件（`id_rsa`、`id_ed25519`、`id_ecdsa`、`id_dsa`、`config`、`known_hosts`），把 github.com/gitlab.com/gitee.com `ssh-keyscan` 进目标 `known_hosts`，修正属主与 700/600 权限，并以目标用户探测 GitHub 连通性（`mcp-share-keys.sh#L55-L107`）。宿主已信任的 deploy key 如此变为 `devops` 可用，供基于 git 的部署脚本。

## 故障模式

- **SSH 认证/连接失败** 表现为步骤日志：`ssh` 非零退出 → 熔断把任务标 `failed`，stderr 在 `output_log`（`src/utils/task_executor.py#L106-L109`）。
- **密钥缺失/轮换：** 挂载路径错误或宿主密钥重生成但未更新 `authorized_keys` → 每个任务与终端连接都失败；修宿主侧并重启 api 容器（README 维护说明）。
- **paramiko 密钥类型不匹配：** 客户端试 RSA/Ed25519/ECDSA；奇异密钥格式报"无法加载私钥文件"且 WebSocket 关 `1011`（`src/utils/ssh_client.py#L68-L99`、`src/apis/terminal.py#L80-L83`）。
- **目录创建需 sudo：** 若 sudo 白名单的 `mkdir`/`chown` 条目被删，`devops` 不可写路径的工作目录准备失败。
- **`host.docker.internal` 解析** 依赖 compose `extra_hosts: host-gateway`；脱离 compose 运行需可达的 `HOST_SSH` 值。

## 相关页面

- [安全与授权模型](/openwiki/concepts/security.md) — `devops` 用户与白名单如何构建。
- [任务执行引擎](/openwiki/architecture/task-execution.md) — 批 SSH 步骤如何流式与终止。
- [配置与环境](/openwiki/operations/configuration.md) — `HOST_SSH*` 变量。
- [部署与主机准备](/openwiki/operations/deployment.md) — 挂载、引导顺序、密钥轮换。
- [Web 控制台工作流](/openwiki/workflows/web-console.md) — 该通道之上的终端 UX。
