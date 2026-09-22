# Web 端移动端适配设计

日期：2026-09-22
状态：已批准（对话中批准，待实现）

## 1. 背景与目标

DevOps MCP 的 web 端（Next.js 16 + React 19 + MUI v9 + Tailwind 4）目前仅布局层有基础响应式（main-layout 的 temporary/permanent Drawer 切换），表格、对话框、终端在窄屏下不可用。

**目标：完整移动体验**——手机上"好用"而不仅是"能用"。

**范围外**：PWA、后端接口改动、桌面端现状改动（≥900px 一切保持不变）。

## 2. 已确认的决策

| 决策点 | 结论 | 理由 |
|---|---|---|
| 适配目标 | 完整移动体验（最高档） | 用户选择 |
| 终端定位 | 核心功能终端：快捷命令 + 输入框 + 输出流查看 | xterm 移动端全功能适配是深坑，核心功能覆盖移动运维真实场景 |
| 表格策略 | 方案 A：useMediaQuery 分支渲染（Table/Card 双 UI） | 无新依赖、体验最好、逐表迁移可控；DataGrid 迁移不省卡片化工作 |

## 3. 断点约定

使用 MUI 默认断点，**唯一切换点为 900px**：

- `< 900px`（`theme.breakpoints.down('md')`，覆盖手机 + 平板竖屏）：卡片化表格、全屏对话框、终端移动模式、骨架换行
- `≥ 900px`：现状 UI 完全不变

统一封装 `useIsMobile()`，全项目只此一个判定来源，禁止散落各处的裸 `useMediaQuery` 调用产生不一致。

## 4. 基础层

### 4.1 viewport（`web/app/layout.tsx`）

```ts
export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',   // iOS 刘海屏安全区依赖此项
};
```

不禁用缩放（无障碍底线）。

### 4.2 `web/hooks/use-is-mobile.ts`（新建）

```ts
const useIsMobile = () =>
  useMediaQuery('(max-width:899.95px)', { noSsr: true });
```

用原始媒体查询字符串而非 theme 引用，避免 hook 依赖 ThemeProvider 上下文（登录页在 ThemeProvider 之外也可用）。`noSsr: true` 使客户端首帧即用真实匹配结果。

### 4.3 `web/components/base/responsive-dialog.tsx`（新建）

```tsx
interface ResponsiveDialogProps extends Omit<DialogProps, 'fullScreen'> {}
// isMobile ? { fullScreen: true, scroll: 'body' } : 透传 maxWidth/fullWidth
```

- 移动端强制 `fullScreen`，`DialogContent` 承担滚动
- 桌面端行为与现状逐像素一致
- 替换对象（7 处文件）：`api-key-dialogs`、`audit-log-dialogs`、`automation-dialog`、`command-dialog`、`project-dialogs`、`public-command-dialogs`、`user-dialogs`、`main-layout`（修改密码）、`terminal-panel`（重构后自身处理）

### 4.4 iOS 专项 CSS（`web/app/globals.css`）

- 移动端 `input, textarea { font-size: 1rem; }`——MUI TextField 默认 14px，iOS 聚焦时会触发页面自动缩放
- AppBar 底部、终端输入条补 `env(safe-area-inset-bottom)` padding
- 高度敏感容器（终端全屏）使用 `100dvh` 回退 `100vh`

### 4.5 触摸目标

全项目移动端交互元素 ≥ 44px：卡片内操作按钮用正常尺寸 `IconButton`（40px + padding），禁用 `size="small"`；Tooltip 在触屏无意义，卡片模式下操作按钮带文字标签。

## 5. 布局层（`web/components/main-layout.tsx`）

已有响应式抽屉保持不动，仅微调：

- main 区域 padding：`p: { xs: 2, md: 3 }`
- AppBar 标题字号：小屏降为 `variant="subtitle1"`

## 6. 页面骨架层

改造对象分两类：

**页面级（6 个）**：`app/projects/page.tsx`、`users/page.tsx`、`api-keys/page.tsx`、`audit-logs/page.tsx`、`public-commands/page.tsx`、`app/page.tsx`（仪表板）

**表格组件内嵌头部（3 个）**：`automation-table.tsx`、`command-table.tsx`、`public-command-table.tsx` 自带标题按钮区

统一做法：

- 标题行 `flexWrap: 'wrap'`：小屏标题独占一行，按钮组换行且 `gap` 收窄
- "刷新"、"导入"等次要按钮小屏改为 `IconButton`（`aria-label` 必须补全）
- 主操作按钮（新建/导入）保留 startIcon
- 搜索框已是 fullWidth 风格，确认小屏无溢出即可

## 7. 表格卡片化（核心）

### 7.1 实现模式

每个表格组件内：

```tsx
const isMobile = useIsMobile();
// ...
if (isLoading) return <Loading/>;
return isMobile ? <MobileCardList/> : <DesktopTable/>;
```

**不做通用表格抽象**（各表字段差异大，抽象会过度设计），共享的只有：

- `useIsMobile` hook
- `components/base/mobile-field.tsx`（新建）：轻量字段行组件 `<MobileField label value />`（label 灰色小字 + value，单列排布）

### 7.2 统一卡片结构

```
┌─────────────────────────────┐
│ 标题字段            状态Chip │ ← 头部：加粗标题 + 右上角状态
│ （次要副标题，如有）    [☑]  │ ← 多选 checkbox 在右上角
│                             │
│ 字段A: value     字段B: value│ ← MobileField，2 列 grid
│ 字段C: value                │
│ 时间/等宽内容（小字灰色）      │
├─────────────────────────────┤
│ [操作1] [操作2]  [ toggle ] │ ← 底部操作区，正常尺寸
└─────────────────────────────┘
```

### 7.3 各表字段映射

| 表格 | 卡片标题 | 状态 | 主体字段 | 折叠/次要 | 底部操作 |
|---|---|---|---|---|---|
| project-table | 项目名称（描述为副标题） | 启用 Chip + toggle | 工作目录、命令数 | — | 查看 / 编辑 / 删除 |
| user-table | 用户名 | 启用 Chip + toggle | 邮箱、创建时间 | 角色并入头部（Chip） | 修改密码 / 编辑 |
| api-key-table | token_name | 启用 Chip + toggle | 前缀 Chip、创建者、项目权限 Chips、读写权限 Chips | 权限 Chips 超过 3 个折叠"更多" | 复制 Key / 重新生成 / 编辑 |
| audit-log-table | 操作者（+类型副标题） | 状态 Chip | 操作类型、目标项目、操作时间、IP | ID 不展示（详情里看） | 查看详情 |
| automation-table | 规则名称 | Switch（保留交互） | 触发类型 Chip、触发配置（等宽）、最后执行 | 执行命令描述折叠 | 编辑 / 删除（现有一致） |
| command-table | 操作类型 Chip + 描述 | 高危标记 | 超时、命令内容（等宽，可换行不截断） | 健康检查 icon toggle 保留在底部 | 编辑 / 删除 |
| public-command-table | 名称 | — | 操作类型 Chip、描述、标签 Chips、超时 | — | 复制 / 编辑 / 删除 |

### 7.4 多选与分页

- **多选**（project / user / api-key / audit-log 四表）：卡片右上角 checkbox；表头"全选"移到卡片列表上方工具条（全选 + 已选计数 + 删除选中）
- **分页**：现状为自建分页条（"共 X 条" + 页码 input），非 MUI TablePagination。移动端保留该分页条但布局收窄为一行（总条数 + 页码输入 + 页码显示），不重构为 TablePagination

### 7.5 空态与加载态

加载态与空态以 JSX 变量形式定义一次，两个分支共用同一实例引用，避免逻辑漂移：

```tsx
const commonStates = (
  <>
    {isLoading && <LoadingBlock/>}
    {!isLoading && isEmpty && <EmptyAlert text="..."/>}
  </>
);
return isMobile ? <>{commonStates}<MobileCards/></> : <>{commonStates}<Table/></>;
```

行内操作的具体图标与回调以各表现有实现为准，卡片化只重排布局、不增删能力。

## 8. 终端移动模式（`web/components/terminal-panel.tsx`）

复用现有 WebSocket 管道，**不碰后端**。组件内按 `isMobile` 分支：

### 移动端结构

```
┌──────────────────────────┐
│ 标题栏（连接状态 + 重连 + 关闭）│ ← 保留现有，去掉最大化按钮
├──────────────────────────┤
│                          │
│  xterm 输出（只读渲染）      │ ← pointerEvents: 'none' 阻止聚焦弹键盘
│                          │
├──────────────────────────┤
│ [Ctrl+C][Tab][↑][ls][df] │ ← 快捷命令 chips，横向滚动
├──────────────────────────┤
│ [输入框___________] [发送] │ ← 底部输入条 + 安全区 padding
└──────────────────────────┘
```

### 关键实现点

- **输出**：`onmessage → terminal.write` 管道完全不动；xterm 容器加 `pointerEvents: 'none'` 阻止其获得焦点弹虚拟键盘；外层容器 `overflow: auto` 兜底滚动
- **输入**：输入框回车/点发送 → `ws.send(input + '\n')`，清空输入框
- **快捷键 chips**（发送 PTY 转义序列，PTY 原生兼容）：
  - `Ctrl+C` → `\x03`、`Tab` → `\x09`、`↑` → `\x1b[A`、`↓` → `\x1b[B`
  - 常用命令：`ls -la`、`df -h`、`free -h`、`systemctl status`、`docker ps`（点击即发送执行）
- **键盘遮挡**：输入条固定底部，虚拟键盘弹起时依赖浏览器视觉视口自然压缩（`100dvh` 容器）；输入框 `autoFocus: false` 避免弹窗打开即弹键盘
- 桌面端终端行为完全不变（含最大化按钮）

## 9. 验收

项目无前端测试基建，本次以**手动验收清单**为主（自动化测响应式 UI 性价比低，不为此引入测试框架）：

**设备矩阵**：375px（iPhone SE）/ 390px（iPhone 15）/ 768px（iPad 竖屏）/ 1280px（桌面）× 明 / 暗主题

**逐项检查**：

- [ ] 6 个页面 + 3 个内嵌头部表格：无横向溢出、按钮可达、文案不截断异常
- [ ] 7 个表格：卡片信息完整、多选与删除流程可用、分页可用
- [ ] 对话框：全屏展示、表单可填写、iOS 不触发页面缩放
- [ ] 终端：连接、快捷命令、输入执行、输出滚动、断线重连
- [ ] 登录页小屏正常
- [ ] `npm run build` 通过、ESLint 无错误

## 10. 风险与 Trade-off

| 风险 | 处理 |
|---|---|
| `noSsr` 下手机用户首帧短暂看到桌面表格（~50ms 闪烁） | 接受；引入全局首帧 skeleton 的复杂度不值得 |
| React hydration mismatch 警告（SSR HTML 为桌面版） | 首帧后自动恢复；如有控制台噪音，接受（内部系统） |
| 双 UI 漂移（桌面改了移动没改） | 字段映射表即规格；code review 按表对照 |
| xterm `pointerEvents: none` 后选择复制不可用 | 移动端明确放弃；桌面不受影响 |

## 11. 实施顺序与估算

| 阶段 | 内容 | 估算 |
|---|---|---|
| 1 | 基础层：viewport、useIsMobile、ResponsiveDialog、iOS CSS | 0.5 天 |
| 2 | 布局层 + 页面骨架（6 页 + 3 内嵌头部） | 1 天 |
| 3 | 7 表格卡片化 | 2-3 天 |
| 4 | 终端移动模式 | 1 天 |
| 5 | 验收走查与打磨 | 0.5 天 |

合计 5-6 天。
