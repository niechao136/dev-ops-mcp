---
type: testing
title: 验证与质量门禁
description: 诚实的验证现状——不存在自动化测试套件；质量门禁是 src 上的 basedpyright、web 上的 eslint 与 next build，加上定时的 OpenWiki 工作流。记录实际会跑什么以及如何验证变更。
tags: [testing, verification, quality, ci, basedpyright, eslint]
verified:
  - by: openwiki/0.5.2
    at: 2026-09-23T02:41:19.131Z
sources:
  - id: openwiki-source-6d4b4e707b8d60b6ccfa3425
    resource: repo://.github/workflows/openwiki-update.yml
  - id: openwiki-source-20bc5f28277e117acb9c2241
    resource: repo://docs/superpowers/plans/2026-09-22-web-mobile-adaptation.md
  - id: openwiki-source-05ccef8d4cf1698187f20464
    resource: repo://pyproject.toml
  - id: openwiki-source-ef704f47702b6b01a51a44f2
    resource: repo://web/eslint.config.mjs
  - id: openwiki-source-14e56945b7c632a3b335dcec
    resource: repo://web/package.json
generated: { by: "opencode", at: "2026-09-23T02:41:19.131Z" }
---

# 验证与质量门禁

## 直言不讳

**不存在自动化测试套件。** 已对代码树核实：

- 任何位置都没有 `tests/` 或 `test/` 目录。
- Python、TypeScript、JS 中没有 `*.test.*` / `*.spec.*` 文件。
- `pyproject.toml` 依赖或 `web/package.json` devDependencies 中没有 `pytest`、`unittest`、`vitest`、`jest` 或 `playwright`。
- 没有 `[tool.pytest.ini_options]`，没有 `pytest.ini`，没有覆盖率配置。
- 唯一的 GitHub Actions 工作流是定时的 OpenWiki 文档刷新 — **没有构建、lint 或测试 CI**（`.github/workflows/openwiki-update.yml`）。

覆盖率是零。任何变更都必须用下方门禁加上手工验证来确认。

## 实际可运行的门禁

### Python / API（`src/`）

| 门禁 | 命令 | 配置 |
|---|---|---|
| 静态类型检查 | `basedpyright`（或 `uvx basedpyright`） | `pyproject.toml` 中 `[tool.basedpyright]`：`typeCheckingMode = "standard"`、`include = ["src"]`，排除 `web`、`.venv`、`data`（`pyproject.toml#L25-L32`） |

配置中的注释解释了选型：默认 `recommended` 模式会产生数千条风格级诊断（reportAny、reportUnknown* 等）；`standard` 保留真实类型错误（返回类型不匹配、缺失泛型、Optional 成员访问、不兼容实参）并丢弃风格噪音。

未配置任何 linter（ruff/flake8/black）。格式化仅靠约定。

### Web（`web/`）

| 门禁 | 命令 | 配置 |
|---|---|---|
| Lint | `npm run lint`（→ `eslint`） | 扁平配置 `web/eslint.config.mjs`，extends `eslint-config-next/core-web-vitals` + `eslint-config-next/typescript`，忽略 `.next/`、`out/`、`build/`、`next-env.d.ts`（`web/eslint.config.mjs#L5-L16`） |
| 类型感知构建 | `npm run build`（→ `next build`） | Next 16 standalone 构建；TS 错误会使构建失败（`web/package.json#L5-L10`） |

未安装前端单测/E2E 测试运行器（`web/package.json#L32-L42` 只有 eslint/typescript 工具链）。

### 存在的 CI

`.github/workflows/openwiki-update.yml` — **仅文档**：

- 触发：cron `0 8 * * *` + `workflow_dispatch`。
- 完整历史 checkout（`fetch-depth: 0` 使 `openwiki code --update` 能对比上次文档化提交），装 Node 22，安装钉版 `openwiki@0.5.2` + `mermaid` + `jsdom`，跑 `openwiki code --update --print`，删除瞬态 `openwiki/.run.json`，经 `peter-evans/create-pull-request` 开触及 `openwiki/` 与 `AGENTS.md` 的 PR。
- 使用的 secrets：`OPENAI_API_KEY`、可选的 LangSmith keys。
- **不跑 basedpyright、eslint、next build 或任何测试。**

## 如何验证一次变更（手工清单）

因为没有任何东西自动运行，按此阶梯操作：

1. **Python 变更：** 从仓库根跑 `basedpyright` — 在 `standard` 模式下对 `src/` 必须零错误退出。
2. **Web 变更：** `cd web && npm run lint && npm run build`。
3. **行为变更（API/task/SSH）：** 启动栈（`docker compose up -d`），打 `GET /api/health`，然后手工走变更路径（Swagger `/api/docs`、对 `/api/mcp` 的 MCP 客户端、或控制台 UI）。记录变更前后响应。
4. **Schema 变更：** 确认 `python -m src.dbs.migrate` 能在 `data/devops.db` 副本上干净应用且应用仍能启动。
5. **SSH/executor 变更：** 对临时项目跑真实任务并检查 `tasks.output_log`。
6. **文档/计划：** `docs/superpowers/plans/*` 记录每个任务的预期验证（例如移动端适配计划明确写“无前端测试设施；每个任务的测试 = `npm run build` + `npm run lint` + 手工 DevTools 走查”）。

## 缺口与风险

| 缺口 | 后果 |
|---|---|
| 无单测/集成测 | 任务执行、确认流、scope 检查的回归只能在生产或手工 QA 中发现 |
| PR 上无 CI | 若作者不自行跑门禁，带类型错误或 lint 失败的变更也能合入 |
| 无覆盖率度量 | 无法知道哪些路径被行使 |
| basedpyright 只覆盖 `src` | `web/` 的类型安全完全依赖 `next build` |
| 行为检查纯手工 | 非确定性（SSH、调度器、SSE 时序）路径没有回归网 |

## 相关页面

- [系统总览](/openwiki/architecture/system-overview.md) — 门禁在保护什么。
- [部署与主机准备](/openwiki/operations/deployment.md) — 如何为手工检查启动栈。
- [快速开始](/openwiki/quickstart.md) — 最短路径得到可验证的运行环境。
