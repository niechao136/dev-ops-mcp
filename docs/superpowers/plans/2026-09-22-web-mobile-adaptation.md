# Web 端移动端适配实现计划

> **面向 AI 代理的工作者：** 必需子技能：使用 subagent-driven-development（推荐）或 executing-plans 逐任务实现此计划。步骤使用复选框（`- [ ]`）语法来跟踪进度。

**目标：** 为 DevOps MCP web 端（Next.js 16 + MUI v9）提供完整移动体验：卡片化表格、全屏对话框、移动模式终端。

**架构：** 以 900px 为唯一断点，通过 `useIsMobile` hook 在组件内分支渲染两套 UI（桌面原样 / 移动端卡片式）；共享 4 个轻量 base 组件（MobileCard、MobileField、MobileSelectionBar、MobilePagination）保证 7 个表格卡片化的一致性；终端复用现有 WebSocket 管道，移动端转为"只读 xterm 输出 + 快捷命令条 + 输入框"。

**技术栈：** Next.js 16 App Router、React 19、TypeScript、MUI v9（@mui/material）、Emotion。

**规格：** `docs/superpowers/specs/2026-09-22-web-mobile-adaptation-design.md`（本计划的论证依据，执行者两份都读）。

## 全局约束

- 断点唯一：`< 900px`（媒体查询字符串 `(max-width:899.95px)`）为移动模式，`≥ 900px` 保持现状完全不变
- `useIsMobile` 是全项目唯一的移动端判定来源，禁止在其他地方裸写 `useMediaQuery`
- 桌面 UI 的 DOM 结构、样式、交互逐像素不变；所有响应式改动只允许出现在 `isMobile` 分支或新增的 `@media` 块中
- 移动端交互元素触摸目标 ≥ 44px：卡片内 `IconButton` 一律不写 `size="small"`，且必须带 `aria-label`
- 移动端操作按钮带文字（Tooltip 在触屏无效），`IconButton` 仅用于纯图标语义明确的场景
- 项目无前端测试基建（无 vitest/jest），每个任务的"测试"= `npm run build` + `npm run lint` 通过 + 手动走查（DevTools 设备模拟），不引入测试框架
- commit message 用中文 Conventional Commits，风格如 `feat(web): ...`
- 工作目录：web 子项目在 `d:\ai\dev-ops-mcp\web`，所有 npm 命令在该目录执行

---

## 文件结构

**新建（5 个）：**

| 文件 | 职责 |
|---|---|
| `web/hooks/use-is-mobile.ts` | 唯一的移动端判定 hook |
| `web/components/base/mobile-card.tsx` | `MobileCard`（卡片布局壳）+ `MobileField`（label-value 字段行） |
| `web/components/base/mobile-selection-bar.tsx` | 多选表格的移动端全选工具条 |
| `web/components/base/mobile-pagination.tsx` | 移动端分页条（替代桌面"页码 input + TablePagination"双件套） |
| `web/components/base/responsive-dialog.tsx` | 移动端强制全屏的 Dialog 包装 |

**修改：**

| 文件 | 改动 | 任务 |
|---|---|---|
| `web/app/layout.tsx` | 增加 viewport 导出 | 1 |
| `web/app/globals.css` | iOS 防缩放等移动 CSS | 1 |
| `web/app/api-key-dialogs.tsx` 等 7 个 `*-dialogs.tsx` / `automation-dialog.tsx` / `command-dialog.tsx` | `Dialog` → `ResponsiveDialog` | 3 |
| `web/components/main-layout.tsx` | 密码对话框替换 + padding/字号微调 | 3、4 |
| `web/app/projects/page.tsx` | 标题行响应式 | 5 |
| `web/app/users/page.tsx` | 标题行响应式 | 5 |
| `web/app/api-keys/page.tsx` | 标题行响应式 | 5 |
| `web/app/audit-logs/page.tsx` | 标题行响应式 | 6 |
| `web/app/public-commands/page.tsx` | 标题行响应式 + 搜索框宽度 | 6 |
| `web/app/page.tsx` | 仪表板走查确认 | 6 |
| `web/components/project-table.tsx` | 卡片化（蓝本） | 7 |
| `web/components/user-table.tsx` | 卡片化 | 8 |
| `web/components/api-key-table.tsx` | 卡片化 | 9 |
| `web/components/audit-log-table.tsx` | 卡片化 | 10 |
| `web/components/automation-table.tsx` | 卡片化 + 内嵌头部响应式 | 11 |
| `web/components/command-table.tsx` | 卡片化 + 内嵌头部响应式 | 12 |
| `web/components/public-command-table.tsx` | 卡片化 | 13 |
| `web/components/terminal-panel.tsx` | 移动端终端模式 | 14 |

**登录页**（`web/app/login/page.tsx`）为 `maxWidth="xs"` 居中卡片 + fullWidth 表单，天然响应式，只在任务 15 验收走查，无需改代码。

---

### 任务 1：基础基建（viewport / useIsMobile / 移动 CSS）

**文件：**
- 修改：`web/app/layout.tsx:1-10`
- 创建：`web/hooks/use-is-mobile.ts`
- 修改：`web/app/globals.css`（文件末尾追加）

- [ ] **步骤 1：layout.tsx 增加 viewport 导出**

在 `web/app/layout.tsx` 中，把第 1 行改为：

```tsx
import type { Metadata, Viewport } from 'next';
```

在 `export const metadata` 块（第 7-10 行）之后新增：

```tsx
export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
};
```

- [ ] **步骤 2：创建 useIsMobile hook**

新建 `web/hooks/use-is-mobile.ts`，完整内容：

```ts
'use client';

import { useMediaQuery } from '@mui/material';

/**
 * 全项目唯一的移动端判定来源。
 * 断点约定：< 900px 为移动模式（见 docs/superpowers/specs/2026-09-22-web-mobile-adaptation-design.md 第 3 节）。
 * noSsr: 客户端首帧即用真实匹配结果，代价是手机首帧可能短暂闪现桌面布局（已接受的 trade-off）。
 */
export function useIsMobile(): boolean {
  return useMediaQuery('(max-width:899.95px)', { noSsr: true });
}
```

- [ ] **步骤 3：globals.css 追加移动端 CSS**

在 `web/app/globals.css` 文件末尾追加：

```css
/* ===== 移动端适配（规格：docs/superpowers/specs/2026-09-22-web-mobile-adaptation-design.md 第 4.4 节） ===== */

/* 防止 iOS 聚焦输入框时页面自动缩放：MUI TextField 默认 14px，iOS 视为过小会强制放大视口。
   !important 必须保留：MUI 的 .MuiInputBase-input 类选择器优先级高于标签选择器。 */
@media (max-width: 899.95px) {
  input,
  textarea,
  select {
    font-size: 1rem !important;
  }
}
```

- [ ] **步骤 4：验证**

```powershell
cd d:\ai\dev-ops-mcp\web
npm run build
npm run lint
```

预期：build 成功、lint 无错误。手动验证：`npm run dev` 后 DevTools 切 iPhone SE（375px），控制台 Elements 中确认 `<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">` 存在。

- [ ] **步骤 5：Commit**

```powershell
git add web/app/layout.tsx web/hooks/use-is-mobile.ts web/app/globals.css
git commit -m "feat(web): 移动端适配基础层——viewport、useIsMobile hook、iOS 防缩放 CSS"
```

---

### 任务 2：共享移动端布局组件

**文件：**
- 创建：`web/components/base/mobile-card.tsx`
- 创建：`web/components/base/mobile-selection-bar.tsx`
- 创建：`web/components/base/mobile-pagination.tsx`

- [ ] **步骤 1：创建 mobile-card.tsx（MobileCard + MobileField）**

完整内容：

```tsx
'use client';

import { ReactNode } from 'react';
import { Box, Card, CardActions, CardContent, Typography } from '@mui/material';

interface MobileCardProps {
  title: ReactNode;
  subtitle?: ReactNode;
  /** 右上角区域：状态 Chip 或多选 Checkbox */
  headerRight?: ReactNode;
  /** 主体：放置 MobileField，自动 2 列网格 */
  children?: ReactNode;
  /** 底部操作区 */
  footer?: ReactNode;
}

/** 移动端卡片布局壳：头部(标题/副标题/右侧) + 2 列字段网格 + 底部操作区（规格第 7.2 节结构） */
export function MobileCard({ title, subtitle, headerRight, children, footer }: MobileCardProps) {
  return (
    <Card sx={{ mb: 1.5 }}>
      <CardContent sx={{ pb: footer ? 1 : 2 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 1 }}>
          <Box sx={{ minWidth: 0 }}>
            <Typography sx={{ fontWeight: 500, wordBreak: 'break-all' }}>{title}</Typography>
            {subtitle != null && subtitle !== '' && (
              <Typography variant="body2" color="text.secondary" sx={{ wordBreak: 'break-all' }}>
                {subtitle}
              </Typography>
            )}
          </Box>
          {headerRight}
        </Box>
        {children != null && (
          <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1.5, mt: 1.5 }}>{children}</Box>
        )}
      </CardContent>
      {footer != null && (
        <CardActions sx={{ justifyContent: 'flex-end', pt: 0, px: 2, pb: 1.5 }}>{footer}</CardActions>
      )}
    </Card>
  );
}

interface MobileFieldProps {
  label: string;
  value: ReactNode;
  /** 2 = 独占整行（长内容如路径、命令），默认 1 = 半行 */
  span?: 1 | 2;
}

/** 移动端字段行：灰色小字 label + 值。放入 MobileCard 的 children 中使用。 */
export function MobileField({ label, value, span = 1 }: MobileFieldProps) {
  return (
    <Box sx={{ gridColumn: span === 2 ? '1 / -1' : 'auto', minWidth: 0 }}>
      <Typography variant="caption" color="text.secondary" display="block">
        {label}
      </Typography>
      <Typography variant="body2" sx={{ wordBreak: 'break-all' }}>
        {value ?? '-'}
      </Typography>
    </Box>
  );
}
```

- [ ] **步骤 2：创建 mobile-selection-bar.tsx**

完整内容：

```tsx
'use client';

import { Box, Button, Checkbox, Typography } from '@mui/material';
import { Delete as DeleteIcon } from '@mui/icons-material';

interface MobileSelectionBarProps {
  count: number;
  checked: boolean;
  indeterminate: boolean;
  onToggleAll: () => void;
  onDelete: () => void;
  /** 已选中时的操作文案，默认"删除选中" */
  deleteLabel?: string;
}

/** 移动端多选工具条：替代桌面表头的全选 checkbox（规格第 7.4 节） */
export default function MobileSelectionBar({
  count,
  checked,
  indeterminate,
  onToggleAll,
  onDelete,
  deleteLabel = '删除选中',
}: MobileSelectionBarProps) {
  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        gap: 1,
        mb: 1.5,
        px: 1,
        py: 0.5,
        bgcolor: 'background.paper',
        borderRadius: 1,
        border: 1,
        borderColor: 'divider',
      }}
    >
      <Checkbox checked={checked} indeterminate={indeterminate} onChange={onToggleAll} aria-label="全选" />
      <Typography variant="body2" sx={{ flex: 1 }}>
        已选 {count} 项
      </Typography>
      {count > 0 && (
        <Button size="small" color="error" startIcon={<DeleteIcon />} onClick={onDelete}>
          {deleteLabel}
        </Button>
      )}
    </Box>
  );
}
```

- [ ] **步骤 3：创建 mobile-pagination.tsx**

完整内容（复刻桌面"自建页码 input"交互，用 Select 替代 TablePagination 的每页条数选择）：

```tsx
'use client';

import { Box, MenuItem, Select, Typography } from '@mui/material';

interface MobilePaginationProps {
  total: number;
  /** 1 起始页码（与桌面自建分页一致） */
  page: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (pageSize: number) => void;
}

/** 移动端分页条：共 X 条 + 页码输入 + 每页条数选择（规格第 7.4 节） */
export default function MobilePagination({
  total,
  page,
  pageSize,
  onPageChange,
  onPageSizeChange,
}: MobilePaginationProps) {
  const maxPage = Math.ceil(total / pageSize) || 1;
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mt: 2, flexWrap: 'wrap' }}>
      <Typography variant="body2" sx={{ color: 'text.secondary' }}>
        共 {total} 条
      </Typography>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
        <Typography variant="body2" sx={{ color: 'text.secondary' }}>第</Typography>
        <input
          type="number"
          min="1"
          max={maxPage}
          value={page}
          onChange={(e) => {
            const newPage = parseInt(e.target.value) || 1;
            onPageChange(Math.min(Math.max(newPage, 1), maxPage));
          }}
          style={{
            width: 60,
            padding: '4px 8px',
            border: '1px solid rgba(0,0,0,0.23)',
            borderRadius: 4,
            textAlign: 'center',
            fontSize: 16,
            backgroundColor: 'transparent',
            color: 'inherit',
          }}
        />
        <Typography variant="body2" sx={{ color: 'text.secondary' }}>
          页 / {maxPage} 页
        </Typography>
      </Box>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, ml: 'auto' }}>
        <Typography variant="body2" sx={{ color: 'text.secondary' }}>每页</Typography>
        <Select
          size="small"
          value={pageSize}
          onChange={(e) => {
            onPageSizeChange(Number(e.target.value));
            onPageChange(1);
          }}
          sx={{ minWidth: 72 }}
          aria-label="每页条数"
        >
          {[10, 25, 50, 100].map((n) => (
            <MenuItem key={n} value={n}>
              {n}
            </MenuItem>
          ))}
        </Select>
      </Box>
    </Box>
  );
}
```

- [ ] **步骤 4：验证**

```powershell
cd d:\ai\dev-ops-mcp\web
npm run build
npm run lint
```

预期：build 成功、lint 无错误（本任务无 UI 可视改动，属纯新增）。

- [ ] **步骤 5：Commit**

```powershell
git add web/components/base/mobile-card.tsx web/components/base/mobile-selection-bar.tsx web/components/base/mobile-pagination.tsx
git commit -m "feat(web): 新增移动端共享组件 MobileCard/MobileField/MobileSelectionBar/MobilePagination"
```

---

### 任务 3：ResponsiveDialog + 全部对话框替换

**文件：**
- 创建：`web/components/base/responsive-dialog.tsx`
- 修改：`web/components/project-dialogs.tsx`、`user-dialogs.tsx`、`api-key-dialogs.tsx`、`audit-log-dialogs.tsx`、`automation-dialog.tsx`、`command-dialog.tsx`、`public-command-dialogs.tsx`、`main-layout.tsx`

- [ ] **步骤 1：创建 responsive-dialog.tsx**

完整内容：

```tsx
'use client';

import { Dialog, DialogProps } from '@mui/material';
import { useIsMobile } from '@/hooks/use-is-mobile';

/**
 * 移动端强制全屏的 Dialog（规格第 4.3 节）。
 * 用法与 Dialog 完全一致：仅把 import 从 '@mui/material' 换成本文件即可，
 * maxWidth / fullWidth 在桌面端行为不变，移动端自动 fullScreen。
 */
export default function ResponsiveDialog(props: DialogProps) {
  const isMobile = useIsMobile();
  const { fullScreen, ...rest } = props;
  return <Dialog {...rest} fullScreen={isMobile ? true : fullScreen} />;
}
```

- [ ] **步骤 2：替换 8 个文件中的 Dialog 实例**

对下列文件逐一执行相同操作（每个文件内有 1-4 个 `<Dialog ...>` 实例，全部要换）：

| 文件 | Dialog 实例 | 位置 |
|---|---|---|
| `project-dialogs.tsx` | 新建/编辑/删除（3 个） | 55 行起 |
| `user-dialogs.tsx` | 新建/编辑/删除/修改密码（约 4 个） | 全文搜索 `<Dialog` |
| `api-key-dialogs.tsx` | 新建/编辑/删除/成功提示（约 4 个） | 全文搜索 |
| `audit-log-dialogs.tsx` | 删除/详情（2 个） | 全文搜索 |
| `automation-dialog.tsx` | 新建/编辑/删除（约 3 个） | 全文搜索 |
| `command-dialog.tsx` | 新建/编辑/删除/执行确认（约 4 个） | 全文搜索 |
| `public-command-dialogs.tsx` | 新建/编辑/删除（3 个） | 全文搜索 |
| `main-layout.tsx` | 修改密码（1 个） | 269 行 |

每个文件的操作：

1. 在 `from '@mui/material'` 的 import 中移除 `Dialog`（保留 `DialogTitle` 等），新增一行 `import ResponsiveDialog from './base/responsive-dialog';`
2. 全文将 JSX 标签 `<Dialog` 替换为 `<ResponsiveDialog`、`</Dialog>` 替换为 `</ResponsiveDialog>`（其余 props 一律不动）

**注意**：audit-log-dialogs.tsx 中若存在非 Dialog 的常驻筛选面板（search/filters UI），保持原样——只替换真正的 `<Dialog>` 元素。

- [ ] **步骤 3：验证**

```powershell
cd d:\ai\dev-ops-mcp\web
npm run build
npm run lint
```

手动验证（DevTools 375px + 1280px 各走一遍）：
- 375px：打开"新建项目"对话框 → 占满全屏、表单可填写、能提交、能关闭
- 1280px：同一对话框 → 居中弹窗 `maxWidth: sm`，与改动前视觉一致
- 明暗主题各看一次全屏对话框

- [ ] **步骤 4：Commit**

```powershell
git add web/components/base/responsive-dialog.tsx web/components/project-dialogs.tsx web/components/user-dialogs.tsx web/components/api-key-dialogs.tsx web/components/audit-log-dialogs.tsx web/components/automation-dialog.tsx web/components/command-dialog.tsx web/components/public-command-dialogs.tsx web/components/main-layout.tsx
git commit -m "feat(web): 对话框移动端全屏化——新增 ResponsiveDialog 并替换全部 Dialog 实例"
```

---

### 任务 4：main-layout 微调

**文件：**
- 修改：`web/components/main-layout.tsx:161-267`

- [ ] **步骤 1：AppBar 标题与 main 区域 padding 响应式**

第 176-178 行的 AppBar 标题：

```tsx
<Typography variant="h6" noWrap component="div" sx={{ flexGrow: 1 }}>
```

改为（小屏降字号）：

```tsx
<Typography variant="h6" noWrap component="div" sx={{ flexGrow: 1, fontSize: { xs: '1.05rem', sm: '1.25rem' } }}>
```

第 261-264 行的 main 区域：

```tsx
<Box
  component="main"
  sx={{ flexGrow: 1, p: 3, width: { sm: `calc(100% - ${drawerWidth}px)` } }}
>
```

改为：

```tsx
<Box
  component="main"
  sx={{ flexGrow: 1, p: { xs: 2, md: 3 }, width: { sm: `calc(100% - ${drawerWidth}px)` } }}
>
```

- [ ] **步骤 2：验证**

```powershell
cd d:\ai\dev-ops-mcp\web
npm run build
```

手动验证：375px 下汉堡菜单开合正常、AppBar 标题单行不换行；1280px 与改动前一致。

- [ ] **步骤 3：Commit**

```powershell
git add web/components/main-layout.tsx
git commit -m "feat(web): main-layout 移动端微调——标题降字号、main 区域收窄 padding"
```

---

### 任务 5：页面骨架 A（projects / users / api-keys）

三个页面标题行结构相同，操作模式一致：**标题行 `flexWrap: 'wrap'` + 间隙按钮在小屏改为 IconButton + 按钮组换行**。

**文件：**
- 修改：`web/app/projects/page.tsx:62-92`
- 修改：`web/app/users/page.tsx:68-98`
- 修改：`web/app/api-keys/page.tsx:65-95`

- [ ] **步骤 1：projects/page.tsx 标题行改造**

第 62-92 行改为（要点：外层 Box 加 `flexWrap: 'wrap'`、gap 收窄；"刷新"和条件渲染的"删除选中"改为小屏 IconButton；"新建项目"保留 startIcon）：

```tsx
<Box sx={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: 1.5, mb: 3 }}>
  <Typography variant="h4" component="h1" sx={{ fontSize: { xs: '1.5rem', md: '2.125rem' } }}>
    项目管理
  </Typography>
  <Box sx={{ display: 'flex', gap: 1 }}>
    <Button variant="outlined" startIcon={<Refresh />} onClick={() => refetch()} sx={{ display: { xs: 'none', sm: 'inline-flex' } }}>
      刷新
    </Button>
    <IconButton aria-label="刷新" onClick={() => refetch()} sx={{ display: { xs: 'inline-flex', sm: 'none' } }}>
      <Refresh />
    </IconButton>
    {selectedIds.length > 0 && (
      <>
        <Button variant="outlined" color="error" startIcon={<Delete />} onClick={() => setDeleteDialogOpen(true)} sx={{ display: { xs: 'none', sm: 'inline-flex' } }}>
          删除选中 ({selectedIds.length})
        </Button>
        <IconButton aria-label={`删除选中 ${selectedIds.length} 项`} color="error" onClick={() => setDeleteDialogOpen(true)} sx={{ display: { xs: 'inline-flex', sm: 'none' } }}>
          <Delete />
        </IconButton>
      </>
    )}
    <Button variant="contained" startIcon={<Add />} onClick={() => setCreateDialogOpen(true)}>
      新建项目
    </Button>
  </Box>
</Box>
```

同文件若尚未 import `IconButton`，在 `@mui/material` import 中补上。

- [ ] **步骤 2：users/page.tsx 同模式改造**

第 68-98 行按步骤 1 的模板替换，差异点：标题文案 `用户管理`、主按钮 `新建用户` → `setCreateDialogOpen(true)`、其余（刷新/删除选中）相同。

- [ ] **步骤 3：api-keys/page.tsx 同模式改造**

第 65-95 行按步骤 1 的模板替换，差异点：标题文案 `API Key 管理`、主按钮 `生成 API Key`。

- [ ] **步骤 4：验证**

```powershell
cd d:\ai\dev-ops-mcp\web
npm run build
npm run lint
```

手动验证：375px 下三页标题与按钮分两行、按钮间距均匀、无横向滚动；1280px 与改动前一致（按钮带文字）。

- [ ] **步骤 5：Commit**

```powershell
git add web/app/projects/page.tsx web/app/users/page.tsx web/app/api-keys/page.tsx
git commit -m "feat(web): projects/users/api-keys 页面骨架移动端响应式"
```

---

### 任务 6：页面骨架 B（audit-logs / public-commands / 仪表板走查）

**文件：**
- 修改：`web/app/audit-logs/page.tsx:56-79`
- 修改：`web/app/public-commands/page.tsx:69-101`
- 走查：`web/app/page.tsx`（仪表板）

- [ ] **步骤 1：audit-logs/page.tsx 标题行改造**

第 56-79 行按任务 5 模板替换。差异点：标题 `操作日志`；**无主操作按钮**，只有"刷新"+条件"删除选中"两组按钮（删除选中改 IconButton 的方式与任务 5 相同）。

- [ ] **步骤 2：public-commands/page.tsx 改造**

第 74-101 行是"搜索框(固定 300px) + 按钮组"同行布局，小屏会溢出。改为：

```tsx
<Box sx={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: 1.5, mb: 3 }}>
  <TextField
    placeholder="搜索名称、描述、操作类型..."
    value={search}
    onChange={(e) => {
      setSearch(e.target.value);
      setPage(1);
    }}
    size="small"
    sx={{ width: { xs: '100%', sm: 300 } }}
  />
  <Box sx={{ display: 'flex', gap: 1 }}>
    <Button variant="outlined" startIcon={<Refresh />} onClick={() => refetch()} sx={{ display: { xs: 'none', sm: 'inline-flex' } }}>
      刷新
    </Button>
    <IconButton aria-label="刷新" onClick={() => refetch()} sx={{ display: { xs: 'inline-flex', sm: 'none' } }}>
      <Refresh />
    </IconButton>
    <Button variant="contained" startIcon={<Add />} onClick={handleOpenCreateDialog}>
      新建公共命令
    </Button>
  </Box>
</Box>
```

第 70-72 行标题加响应式字号：`<Typography variant="h4" component="h1" sx={{ mb: 3, fontSize: { xs: '1.5rem', md: '2.125rem' } }}>`。

- [ ] **步骤 3：仪表板走查**

`web/app/page.tsx` 仪表板只有标题 + 统计卡 + 指标区。在 DevTools 375px 走查：
- 统计卡网格若为 MUI `Grid container spacing` 且 item 带固定 `xs` 断点则天然响应式，无需改代码
- 仅当发现统计卡固定宽度/不换行时，按实际代码将卡片容器 sx 改为 `{ xs: 12, sm: 6, md: 3 }` 的断点栅格（以走查结果为准，构建不报错即可）

- [ ] **步骤 4：验证**

```powershell
cd d:\ai\dev-ops-mcp\web
npm run build
npm run lint
```

手动验证：375px 下 audit-logs/public-commands 标题按钮换行正常、搜索框占满整行、无横向滚动；仪表板统计卡正常堆叠。

- [ ] **步骤 5：Commit**

```powershell
git add web/app/audit-logs/page.tsx web/app/public-commands/page.tsx web/app/page.tsx
git commit -m "feat(web): audit-logs/public-commands/仪表板页面骨架移动端响应式"
```

---

### 任务 7：project-table 卡片化（模式蓝本）

**这是后续所有表格任务的蓝本**：`isMobile` 分支渲染、`commonStates` 共享空态与分页、MobileSelectionBar、卡片操作区。

**文件：**
- 修改：`web/components/project-table.tsx`

- [ ] **步骤 1：补充 import 与 hook**

import 区新增：

```tsx
import { useIsMobile } from '@/hooks/use-is-mobile';
import { MobileCard, MobileField } from './base/mobile-card';
import MobileSelectionBar from './base/mobile-selection-bar';
import MobilePagination from './base/mobile-pagination';
```

组件函数体第一行（第 48 行 `export default function ProjectTable({...}: ProjectTableProps) {` 之后）加：

```tsx
const isMobile = useIsMobile();
```

- [ ] **步骤 2：插入移动分支**

将现有 `return (<>...</>)` 的桌面 JSX **原样不动**，在其之前插入移动分支（桌面 JSX 移入 `else` 路径）。加载态保留在函数最前（现有 65-71 行的 `if (isLoading)` 不动）。插入的代码：

```tsx
if (isMobile) {
  const isEmpty = !projects || projects.length === 0;
  return (
    <>
      <MobileSelectionBar
        count={selectedIds.length}
        checked={!!projects?.length && selectedIds.length === projects.length}
        indeterminate={selectedIds.length > 0 && selectedIds.length < (projects?.length || 0)}
        onToggleAll={onToggleSelectAll}
        onDelete={onDelete}
      />
      {projects?.map((project) => (
        <MobileCard
          key={project.id}
          title={project.name}
          subtitle={project.description || undefined}
          headerRight={
            <Checkbox
              checked={selectedIds.includes(project.id)}
              onChange={() => onToggleSelect(project.id)}
              aria-label={`选择项目 ${project.name}`}
            />
          }
          footer={
            <>
              <IconButton
                aria-label={project.is_active ? '禁用' : '启用'}
                color={project.is_active ? 'default' : 'primary'}
                onClick={() => onToggleActive(project.id, !project.is_active)}
                disabled={toggleActiveMutation.isPending}
              >
                {project.is_active ? <ToggleOff /> : <ToggleOn />}
              </IconButton>
              <IconButton aria-label="查看详情" onClick={() => onView(project.id)}>
                <Visibility />
              </IconButton>
              <IconButton aria-label="编辑" onClick={() => onEdit(project)}>
                <Edit />
              </IconButton>
              <IconButton aria-label="删除" color="error" onClick={onDelete}>
                <Delete />
              </IconButton>
            </>
          }
        >
          <MobileField label="工作目录" value={project.work_dir} span={2} />
          <MobileField label="命令数" value={project.command_count} />
          <MobileField
            label="状态"
            value={
              <Chip
                label={project.is_active ? '启用' : '禁用'}
                color={project.is_active ? 'success' : 'default'}
                size="small"
              />
            }
          />
        </MobileCard>
      ))}
      {isEmpty && (
        <Alert severity="info" sx={{ mt: 2 }}>
          暂无项目，请点击上方按钮创建
        </Alert>
      )}
      {total > 0 && (
        <MobilePagination
          total={total}
          page={page}
          pageSize={pageSize}
          onPageChange={onPageChange}
          onPageSizeChange={onPageSizeChange}
        />
      )}
    </>
  );
}
```

现有桌面 return 保持不变（桌面分页"页码 input + TablePagination"双件套、表头全选 checkbox 均原样）。

- [ ] **步骤 3：验证**

```powershell
cd d:\ai\dev-ops-mcp\web
npm run build
npm run lint
```

手动验证（375px）：
- 卡片列表：标题/描述/工作目录/命令数/状态完整展示
- 勾选卡片 → 顶部工具条"已选 1 项"+"删除选中"出现，全选/取消正常
- 状态 toggle 启停、查看/编辑/删除四个操作全部可用且按钮 ≥ 44px
- 分页：改页码、改每页条数均生效
- （1280px）表格视图与改动前逐像素一致

- [ ] **步骤 4：Commit**

```powershell
git add web/components/project-table.tsx
git commit -m "feat(web): 项目表格移动端卡片化（卡片化模式蓝本）"
```

---

### 任务 8：user-table 卡片化

**文件：**
- 修改：`web/components/user-table.tsx`

- [ ] **步骤 1：import + hook + 移动分支**

与任务 7 相同的 4 个 import、`const isMobile = useIsMobile();`（第 49 行函数体起）、桌面 JSX 不动。移动分支：

```tsx
if (isMobile) {
  const isEmpty = !users || users.length === 0;
  return (
    <>
      <MobileSelectionBar
        count={selectedIds.length}
        checked={!!users?.length && selectedIds.length === users.length}
        indeterminate={selectedIds.length > 0 && selectedIds.length < (users?.length || 0)}
        onToggleAll={onToggleSelectAll}
        onDelete={onDelete}
      />
      {users?.map((user) => (
        <MobileCard
          key={user.id}
          title={user.username}
          subtitle={user.email || undefined}
          headerRight={
            <Checkbox
              checked={selectedIds.includes(user.id)}
              onChange={() => onToggleSelect(user.id)}
              aria-label={`选择用户 ${user.username}`}
            />
          }
          footer={
            <>
              <IconButton
                aria-label={user.is_active ? '禁用' : '启用'}
                color={user.is_active ? 'default' : 'primary'}
                onClick={() => onToggleStatus(user.id)}
                disabled={toggleStatusMutation.isPending}
              >
                {user.is_active ? <ToggleOff /> : <ToggleOn />}
              </IconButton>
              <IconButton aria-label="修改密码" onClick={() => onPassword(user)}>
                <Key />
              </IconButton>
              <IconButton aria-label="编辑" onClick={() => onEdit(user)}>
                <Edit />
              </IconButton>
            </>
          }
        >
          <MobileField
            label="角色"
            value={
              <Chip
                label={user.role === 'admin' ? '管理员' : '普通用户'}
                color={user.role === 'admin' ? 'primary' : 'default'}
                size="small"
              />
            }
          />
          <MobileField
            label="状态"
            value={
              <Chip
                label={user.is_active ? '启用' : '禁用'}
                color={user.is_active ? 'success' : 'default'}
                size="small"
              />
            }
          />
          <MobileField label="创建时间" value={formatDate(user.created_at)} span={2} />
        </MobileCard>
      ))}
      {isEmpty && (
        <Alert severity="info" sx={{ mt: 2 }}>
          暂无用户，请点击上方按钮创建
        </Alert>
      )}
      {total > 0 && (
        <MobilePagination
          total={total}
          page={page}
          pageSize={pageSize}
          onPageChange={onPageChange}
          onPageSizeChange={onPageSizeChange}
        />
      )}
    </>
  );
}
```

- [ ] **步骤 2：验证 + Commit**

```powershell
cd d:\ai\dev-ops-mcp\web
npm run build; npm run lint
```

手动验证同任务 7 清单（字段换为用户信息；角色 Chip 与状态 Chip 并排两列）。

```powershell
git add web/components/user-table.tsx
git commit -m "feat(web): 用户表格移动端卡片化"
```

---

### 任务 9：api-key-table 卡片化

**文件：**
- 修改：`web/components/api-key-table.tsx`

- [ ] **步骤 1：import + hook + 移动分支**

import 与 hook 同任务 7（该文件已 import `Chip`、`API_KEY_SCOPES`/`scopeLabel`）。移动分支：

```tsx
if (isMobile) {
  const isEmpty = !apiKeys || apiKeys.length === 0;
  return (
    <>
      <MobileSelectionBar
        count={selectedIds.length}
        checked={!!apiKeys?.length && selectedIds.length === apiKeys.length}
        indeterminate={selectedIds.length > 0 && selectedIds.length < (apiKeys?.length || 0)}
        onToggleAll={onToggleSelectAll}
        onDelete={onDelete}
      />
      {apiKeys?.map((key) => (
        <MobileCard
          key={key.id}
          title={key.token_name}
          headerRight={
            <Checkbox
              checked={selectedIds.includes(key.id)}
              onChange={() => onToggleSelect(key.id)}
              aria-label={`选择 API Key ${key.token_name}`}
            />
          }
          footer={
            <>
              <IconButton
                aria-label={key.is_active ? '禁用' : '启用'}
                color={key.is_active ? 'default' : 'primary'}
                onClick={() => onToggleActive(key.id, !key.is_active)}
                disabled={toggleActiveMutation.isPending}
              >
                {key.is_active ? <ToggleOff /> : <ToggleOn />}
              </IconButton>
              <IconButton aria-label="复制 Key" onClick={() => onCopyApiKey(key.id)}>
                <ContentCopy />
              </IconButton>
              <IconButton aria-label="重新生成" onClick={() => onRegenerate(key.id)}>
                <Refresh />
              </IconButton>
              <IconButton aria-label="编辑" onClick={() => onEdit(key)}>
                <Edit />
              </IconButton>
            </>
          }
        >
          <MobileField label="创建者" value={key.created_by_name || '-'} />
          <MobileField
            label="状态"
            value={
              <Chip label={key.is_active ? '启用' : '禁用'} color={key.is_active ? 'success' : 'default'} size="small" />
            }
          />
          <MobileField
            label="项目权限"
            span={2}
            value={
              key.allowed_projects ? (
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                  {key.allowed_projects.slice(0, 3).map((project, idx) => (
                    <Chip key={idx} label={project} size="small" />
                  ))}
                  {key.allowed_projects.length > 3 && (
                    <Chip label={`+${key.allowed_projects.length - 3}`} size="small" variant="outlined" />
                  )}
                </Box>
              ) : (
                <Chip label="全部权限" color="primary" size="small" />
              )
            }
          />
          <MobileField
            label="读写权限"
            span={2}
            value={
              key.scopes && key.scopes.length > 0 ? (
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                  {key.scopes.map((scope) => (
                    <Chip
                      key={scope}
                      label={scopeLabel(scope)}
                      size="small"
                      variant="outlined"
                      color={scope === 'resources:write' ? 'warning' : scope === 'resources:read' ? 'info' : 'default'}
                    />
                  ))}
                </Box>
              ) : (
                <Chip label="运维执行（默认）" size="small" variant="outlined" />
              )
            }
          />
          {key.token_prefix && <MobileField label="前缀" value={<Chip label={key.token_prefix} size="small" variant="outlined" />} />}
        </MobileCard>
      ))}
      {isEmpty && (
        <Alert severity="info" sx={{ mt: 2 }}>
          暂无 API Key，请点击上方按钮创建
        </Alert>
      )}
      {total > 0 && (
        <MobilePagination
          total={total}
          page={page}
          pageSize={pageSize}
          onPageChange={onPageChange}
          onPageSizeChange={onPageSizeChange}
        />
      )}
    </>
  );
}
```

若 `ContentCopy`、`Refresh` 未在该文件 import，从 `@mui/icons-material` 补齐。

- [ ] **步骤 2：验证 + Commit**

```powershell
cd d:\ai\dev-ops-mcp\web
npm run build; npm run lint
```

手动验证：权限 Chips > 3 个时显示 `+N` 折叠 Chip；复制/重新生成/启停可用。

```powershell
git add web/components/api-key-table.tsx
git commit -m "feat(web): API Key 表格移动端卡片化（权限 Chips 折叠）"
```

---

### 任务 10：audit-log-table 卡片化

**文件：**
- 修改：`web/components/audit-log-table.tsx`

- [ ] **步骤 1：import + hook + 移动分支**

import 与 hook 同任务 7。该表无 toggle，操作仅"查看详情"。移动分支：

```tsx
if (isMobile) {
  const isEmpty = !logs || logs.length === 0;
  return (
    <>
      <MobileSelectionBar
        count={selectedIds.length}
        checked={!!logs?.length && selectedIds.length === logs.length}
        indeterminate={selectedIds.length > 0 && selectedIds.length < (logs?.length || 0)}
        onToggleAll={onToggleSelectAll}
        onDelete={onDelete}
      />
      {logs?.map((log) => (
        <MobileCard
          key={log.id}
          title={log.actor_name || '-'}
          subtitle={getActorTypeLabel(log.actor_type)}
          headerRight={
            <Checkbox
              checked={selectedIds.includes(log.id)}
              onChange={() => onToggleSelect(log.id)}
              aria-label={`选择日志 ${log.id}`}
            />
          }
          footer={
            <Button size="small" startIcon={<Visibility />} onClick={() => onViewDetail(log)}>
              查看详情
            </Button>
          }
        >
          <MobileField label="操作类型" value={log.action_category} />
          <MobileField
            label="状态"
            value={<Chip label={getStatusLabel(log.status)} color={getStatusColor(log.status)} size="small" />}
          />
          <MobileField label="目标项目" value={log.target_project || '-'} span={2} />
          <MobileField label="IP 地址" value={log.ip_address || '-'} />
          <MobileField label="操作时间" value={formatDate(log.created_at)} />
        </MobileCard>
      ))}
      {isEmpty && (
        <Alert severity="info" sx={{ mt: 2 }}>
          暂无日志记录
        </Alert>
      )}
      {total > 0 && (
        <MobilePagination
          total={total}
          page={page}
          pageSize={pageSize}
          onPageChange={onPageChange}
          onPageSizeChange={onPageSizeChange}
        />
      )}
    </>
  );
}
```

该文件已 import `Button` 则直接用；未 import 则补。

- [ ] **步骤 2：验证 + Commit**

```powershell
cd d:\ai\dev-ops-mcp\web
npm run build; npm run lint
```

手动验证：ID 按规格不展示在卡片（详情里看）；查看详情跳转正常。

```powershell
git add web/components/audit-log-table.tsx
git commit -m "feat(web): 操作日志表格移动端卡片化"
```

---

### 任务 11：automation-table 卡片化（含内嵌头部）

**文件：**
- 修改：`web/components/automation-table.tsx:55-71`（头部）、组件体（卡片分支）

- [ ] **步骤 1：内嵌头部响应式**

第 55-71 行头部改为（"刷新"小屏收成 IconButton）：

```tsx
<Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
  <IconButton aria-label="刷新" onClick={onRefresh} sx={{ display: { xs: 'inline-flex', sm: 'none' } }}>
    <Refresh />
  </IconButton>
  <Button variant="outlined" startIcon={<Refresh />} onClick={onRefresh} sx={{ display: { xs: 'none', sm: 'inline-flex' } }}>
    刷新
  </Button>
  <Button variant="contained" startIcon={<Add />} onClick={onOpenCreateDialog}>
    新建规则
  </Button>
</Box>
```

- [ ] **步骤 2：import + hook + 移动分支**

import 补 `useIsMobile`、`MobileCard`、`MobileField`、`MobilePagination`、`IconButton`（若缺）。hook 加在组件体开头。加载态 `if (isLoading)` 之后、桌面渲染之前插入移动分支。该表**无多选**，无 MobileSelectionBar：

```tsx
if (isMobile) {
  const isEmpty = automations.length === 0;
  return (
    <>
      {automations.map((automation) => (
        <MobileCard
          key={automation.id}
          title={automation.name}
          headerRight={
            <Chip
              icon={automation.trigger_type === 'cron' ? <Timer /> : <Schema />}
              label={automation.trigger_type === 'cron' ? '定时触发' : '条件触发'}
              size="small"
              color={automation.trigger_type === 'cron' ? 'primary' : 'info'}
            />
          }
          footer={
            <>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mr: 'auto' }}>
                <Switch
                  checked={automation.is_enabled}
                  onChange={() => onToggleEnabled(automation.id)}
                  color={automation.is_enabled ? 'success' : 'default'}
                />
                <Typography variant="body2">{automation.is_enabled ? '已启用' : '已禁用'}</Typography>
              </Box>
              <IconButton aria-label="编辑" onClick={() => onOpenEditDialog(automation)}>
                <Edit />
              </IconButton>
              <IconButton aria-label="删除" color="error" onClick={() => onOpenDeleteDialog(automation.id)}>
                <Delete />
              </IconButton>
            </>
          }
        >
          <MobileField
            label="触发配置"
            span={2}
            value={
              <Box
                sx={{
                  fontFamily: 'monospace',
                  bgcolor: (theme) => (theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.08)' : 'grey.100'),
                  p: 1,
                  borderRadius: 1,
                  wordBreak: 'break-all',
                }}
              >
                {automation.trigger_type === 'cron'
                  ? automation.cron_expression || '-'
                  : automation.condition_script || '-'}
              </Box>
            }
          />
          <MobileField
            label="执行命令"
            span={2}
            value={
              <>
                <Chip label={automation.command_action} size="small" variant="outlined" />
                {automation.command_description && (
                  <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                    {automation.command_description}
                  </Typography>
                )}
              </>
            }
          />
          <MobileField label="最后执行" value={formatTime(automation.last_run_time)} />
          <MobileField
            label="执行结果"
            value={
              automation.last_run_status ? (
                <Chip label={automation.last_run_status} size="small" color={getStatusColor(automation.last_run_status)} />
              ) : (
                '-'
              )
            }
          />
        </MobileCard>
      ))}
      {isEmpty && (
        <Alert severity="info" sx={{ mt: 2 }}>
          暂无自动化规则，请点击上方按钮创建
        </Alert>
      )}
      {total > 0 && (
        <MobilePagination
          total={total}
          page={page}
          pageSize={pageSize}
          onPageChange={onPageChange}
          onPageSizeChange={onPageSizeChange}
        />
      )}
    </>
  );
}
```

若 `Switch`、`Timer`、`Schema`、`getStatusColor` 未 import 则补齐（`getStatusColor` 为该文件已有函数则直接用）。

- [ ] **步骤 3：验证 + Commit**

```powershell
cd d:\ai\dev-ops-mcp\web
npm run build; npm run lint
```

手动验证：触发配置等宽文本完整换行不截断；Switch 启停即时生效；桌面端头部与表格一致。

```powershell
git add web/components/automation-table.tsx
git commit -m "feat(web): 自动化规则表格移动端卡片化（含内嵌头部响应式）"
```

---

### 任务 12：command-table 卡片化（含内嵌头部）

**文件：**
- 修改：`web/components/command-table.tsx:45-66`（头部）、组件体（卡片分支）

- [ ] **步骤 1：内嵌头部响应式**

第 45-66 行三个按钮（刷新/导入公共命令/新建命令）按任务 11 步骤 1 模式改：`刷新`与`导入公共命令`小屏改为带 `aria-label` 的 IconButton（导入用 `<Download />`），`新建命令`保留 startIcon；外层 Box 加 `flexWrap: 'wrap'`、`gap: 1`。

- [ ] **步骤 2：import + hook + 移动分支**

import 补 `useIsMobile`、`MobileCard`、`MobileField`、`MobilePagination`。hook 加在组件体开头。移动分支（该表无多选）：

```tsx
if (isMobile) {
  const isEmpty = commands.length === 0;
  return (
    <>
      {commands.map((command) => (
        <MobileCard
          key={command.id}
          title={command.description || command.action_type}
          headerRight={
            command.requires_confirm ? (
              <Chip icon={<Warning />} label="高危" color="error" size="small" />
            ) : undefined
          }
          footer={
            <>
              <IconButton
                aria-label={command.is_health_check ? '取消健康检查' : '设为健康检查'}
                color={command.is_health_check ? 'success' : 'default'}
                onClick={() => onToggleHealthCheck(command.id)}
              >
                {command.is_health_check ? <Favorite /> : <HeartBroken />}
              </IconButton>
              <IconButton aria-label="执行" color="success" onClick={() => onOpenExecuteDialog(command)}>
                <PlayArrow />
              </IconButton>
              <IconButton aria-label="编辑" onClick={() => onOpenEditDialog(command)}>
                <Edit />
              </IconButton>
              <IconButton aria-label="删除" color="error" onClick={() => onOpenDeleteDialog(command.id)}>
                <Delete />
              </IconButton>
            </>
          }
        >
          <MobileField label="操作类型" value={<Chip label={command.action_type} size="small" color="primary" />} />
          <MobileField label="超时(秒)" value={command.timeout} />
          <MobileField
            label="命令内容"
            span={2}
            value={
              <Box
                sx={{
                  fontFamily: 'monospace',
                  bgcolor: (theme) => (theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.08)' : 'grey.100'),
                  p: 1,
                  borderRadius: 1,
                  wordBreak: 'break-all',
                  whiteSpace: 'pre-wrap',
                }}
              >
                {command.shell_command}
              </Box>
            }
          />
        </MobileCard>
      ))}
      {isEmpty && (
        <Alert severity="info" sx={{ mt: 2 }}>
          暂无命令，请点击上方按钮创建
        </Alert>
      )}
      {total > 0 && (
        <MobilePagination
          total={total}
          page={page}
          pageSize={pageSize}
          onPageChange={onPageChange}
          onPageSizeChange={onPageSizeChange}
        />
      )}
    </>
  );
}
```

说明：命令内容卡片上按规格"可换行不截断"（桌面表格的 Tooltip+ellipsis 行为仅桌面保留）。

- [ ] **步骤 3：验证 + Commit**

```powershell
cd d:\ai\dev-ops-mcp\web
npm run build; npm run lint
```

手动验证：长命令完整显示；健康检查 toggle、执行/编辑/删除可用；头部小屏三按钮换行。

```powershell
git add web/components/command-table.tsx
git commit -m "feat(web): 命令表格移动端卡片化（含内嵌头部响应式）"
```

---

### 任务 13：public-command-table 卡片化

**文件：**
- 修改：`web/components/public-command-table.tsx`

- [ ] **步骤 1：import + hook + 移动分支**

import 补 `useIsMobile`、`MobileCard`、`MobileField`、`MobilePagination`。hook 加在组件体开头（第 41 行函数体起）。移动分支（无多选）：

```tsx
if (isMobile) {
  const isEmpty = !commands || commands.length === 0;
  return (
    <>
      {commands?.map((command) => (
        <MobileCard
          key={command.id}
          title={command.name}
          headerRight={<Chip label={command.action_type} size="small" color="primary" />}
          footer={
            <>
              <IconButton aria-label="复制命令" onClick={() => onCopy(command.shell_command)}>
                <ContentCopy />
              </IconButton>
              <IconButton aria-label="编辑" onClick={() => onEdit(command)}>
                <Edit />
              </IconButton>
              <IconButton aria-label="删除" color="error" onClick={() => onDelete(command)}>
                <Delete />
              </IconButton>
            </>
          }
        >
          <MobileField label="描述" value={command.description || '-'} span={2} />
          <MobileField
            label="标签"
            span={2}
            value={
              command.tags ? (
                <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
                  {command.tags.split(',').filter((t) => t.trim()).map((tag, i) => (
                    <Chip key={i} label={tag.trim()} size="small" icon={<LocalOffer />} sx={{ fontSize: '0.75rem' }} />
                  ))}
                </Box>
              ) : (
                '-'
              )
            }
          />
          <MobileField label="超时(秒)" value={command.timeout} />
        </MobileCard>
      ))}
      {isEmpty && (
        <Alert severity="info" sx={{ mt: 2 }}>
          暂无公共命令，请点击上方按钮创建
        </Alert>
      )}
      {total > 0 && (
        <MobilePagination
          total={total}
          page={page}
          pageSize={pageSize}
          onPageChange={onPageChange}
          onPageSizeChange={onPageSizeChange}
        />
      )}
    </>
  );
}
```

- [ ] **步骤 2：验证 + Commit**

```powershell
cd d:\ai\dev-ops-mcp\web
npm run build; npm run lint
```

手动验证：标签换行排列；复制/编辑/删除可用。

```powershell
git add web/components/public-command-table.tsx
git commit -m "feat(web): 公共命令表格移动端卡片化"
```

---

### 任务 14：终端移动模式

**文件：**
- 修改：`web/components/terminal-panel.tsx`

- [ ] **步骤 1：import 与 hook**

import 区新增：

```tsx
import { useIsMobile } from '@/hooks/use-is-mobile';
import { Send as SendIcon, Terminal as TerminalIcon, Close, Refresh } from '@mui/icons-material';
```

（`TerminalIcon`/`Close`/`Refresh` 已有，注意去重；`Maximize`/`Minimize` 保留给桌面分支用。）

组件体内（第 23 行 state 声明区之后）新增：

```tsx
const isMobile = useIsMobile();
const [inputValue, setInputValue] = useState('');
```

- [ ] **步骤 2：新增发送逻辑**

在 `disconnect` 定义（第 135 行）之后新增：

```tsx
const sendCommand = useCallback(
  (raw: string) => {
    if (websocketRef.current && websocketRef.current.readyState === WebSocket.OPEN) {
      websocketRef.current.send(raw);
    }
  },
  []
);

const handleSendInput = () => {
  if (!inputValue.trim()) return;
  sendCommand(`${inputValue}\n`);
  setInputValue('');
};

// 移动端快捷命令：特殊键发 PTY 转义序列，普通命令直接执行（规格第 8 节）
const QUICK_ACTIONS: { label: string; seq: string }[] = [
  { label: 'Ctrl+C', seq: '\x03' },
  { label: 'Tab', seq: '\x09' },
  { label: '↑', seq: '\x1b[A' },
  { label: '↓', seq: '\x1b[B' },
  { label: 'ls -la', seq: 'ls -la\n' },
  { label: 'df -h', seq: 'df -h\n' },
  { label: 'free -h', seq: 'free -h\n' },
  { label: 'docker ps', seq: 'docker ps\n' },
];
```

- [ ] **步骤 3：改造 JSX 渲染**

将现有 `return (<Dialog ...>...</Dialog>)` 整体改为按 `isMobile` 分支。**桌面分支 = 现 JSX 原样不动**（含最大化按钮）。新增移动分支：

```tsx
if (isMobile) {
  return (
    <Dialog
      open={open}
      onClose={onClose}
      fullScreen
      sx={{ '& .MuiDialog-paper': { backgroundColor: '#1e1e1e' } }}
    >
      <DialogContent sx={{ padding: 0, display: 'flex', flexDirection: 'column', height: '100dvh' }}>
        {/* 标题栏 */}
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '8px 12px',
            paddingTop: 'calc(8px + env(safe-area-inset-top))',
            backgroundColor: '#2d2d2d',
            borderBottom: '1px solid #3d3d3d',
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, minWidth: 0 }}>
            <TerminalIcon sx={{ color: '#0dbc79' }} />
            <Typography variant="subtitle2" sx={{ color: '#d4d4d4', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              Terminal - {workDir}
            </Typography>
            <Typography variant="caption" sx={{ color: isConnected ? '#0dbc79' : '#cd3131', flexShrink: 0 }}>
              {isConnected ? '已连接' : '未连接'}
            </Typography>
          </Box>
          <Box sx={{ display: 'flex', flexShrink: 0 }}>
            {!isConnected && (
              <IconButton size="small" onClick={connect} sx={{ color: '#0dbc79' }} aria-label="重新连接">
                <Refresh />
              </IconButton>
            )}
            <IconButton size="small" onClick={onClose} sx={{ color: '#cd3131' }} aria-label="关闭终端">
              <Close />
            </IconButton>
          </Box>
        </Box>

        {error && (
          <Alert severity="error" sx={{ m: 1 }}>
            连接错误：{error}
          </Alert>
        )}

        {/* 只读输出区：pointerEvents 阻止 xterm 聚焦弹虚拟键盘，输出照常渲染 */}
        <Box sx={{ flex: 1, position: 'relative', minHeight: 0, overflow: 'auto' }}>
          <Box sx={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
            <div ref={terminalRef} style={{ width: '100%', height: '100%' }} />
          </Box>
        </Box>

        {/* 快捷命令条：横向滚动 chips */}
        <Box
          sx={{
            display: 'flex',
            gap: 0.5,
            overflowX: 'auto',
            padding: '6px 12px',
            backgroundColor: '#2d2d2d',
            borderTop: '1px solid #3d3d3d',
            flexShrink: 0,
          }}
        >
          {QUICK_ACTIONS.map((action) => (
            <Box
              key={action.label}
              component="button"
              onClick={() => sendCommand(action.seq)}
              sx={{
                flexShrink: 0,
                px: 1.5,
                py: 0.75,
                border: '1px solid #3d3d3d',
                borderRadius: 16,
                backgroundColor: '#1e1e1e',
                color: '#d4d4d4',
                fontSize: 13,
                minHeight: 44,
                cursor: 'pointer',
              }}
            >
              {action.label}
            </Box>
          ))}
        </Box>

        {/* 底部输入条 + 安全区 */}
        <Box
          sx={{
            display: 'flex',
            gap: 1,
            padding: '8px 12px',
            paddingBottom: 'calc(8px + env(safe-area-inset-bottom))',
            backgroundColor: '#2d2d2d',
            flexShrink: 0,
          }}
          component="form"
          onSubmit={(e) => {
            e.preventDefault();
            handleSendInput();
          }}
        >
          <Box
            component="input"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            placeholder="输入命令..."
            autoComplete="off"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            sx={{
              flex: 1,
              px: 1.5,
              py: 1,
              border: '1px solid #3d3d3d',
              borderRadius: 1,
              backgroundColor: '#1e1e1e',
              color: '#d4d4d4',
              fontSize: 16,
              fontFamily: 'monospace',
              outline: 'none',
              minWidth: 0,
            }}
          />
          <IconButton
            type="submit"
            aria-label="发送命令"
            disabled={!isConnected || !inputValue.trim()}
            sx={{ color: '#0dbc79', bgcolor: '#1e1e1e' }}
          >
            <SendIcon />
          </IconButton>
        </Box>
      </DialogContent>
    </Dialog>
  );
}
```

随后保留现有桌面 `return (<Dialog ... fullScreen={isMaximized} ...>)` 不变。

- [ ] **步骤 4：验证**

```powershell
cd d:\ai\dev-ops-mcp\web
npm run build
npm run lint
```

手动验证（375px，需后端运行）：
- 打开终端 → 全屏、无桌面键盘自动弹出（点输出区不聚焦）
- 点 `ls -la` chip → 命令执行、输出出现在只读区
- 输入 `echo hello` 点发送 → 输出 `hello`
- `Ctrl+C` chip 可中断前台进程；`↑` 调出上一条命令
- 断开后端 → "未连接"出现，点重连恢复
- 输入时虚拟键盘弹起，输入条仍可见可点
- （1280px）桌面终端：最大化/还原/原生键盘输入全部与改动前一致

- [ ] **步骤 5：Commit**

```powershell
git add web/components/terminal-panel.tsx
git commit -m "feat(web): 终端面板移动端模式——快捷命令条 + 输入框 + 只读输出"
```

---

### 任务 15：最终验收走查

**文件：** 无新改动（如有修复则修完重新验证并 commit）

- [ ] **步骤 1：启动并全矩阵走查**

```powershell
cd d:\ai\dev-ops-mcp\web
npm run build
npm run dev
```

DevTools 设备模拟按规格第 9 节矩阵走查：375px / 390px / 768px / 1280px × 明暗主题，逐页过规格第 9 节检查清单（7 表格、对话框、终端、登录页、6+3 骨架）。

- [ ] **步骤 2：登录页确认**

375px 打开 `/login`：卡片不贴边、输入框可正常聚焦不触发页面缩放（此行为由任务 1 的 CSS 保证）、登录流程可用。

- [ ] **步骤 3：构建与静态检查**

```powershell
npm run build
npm run lint
```

预期：两者全部无错误。若走查发现缺陷：修复 → 重跑本步骤 → 按所属模块 commit（如 `fix(web): 修复 xxx 移动端 yyy`）。

- [ ] **步骤 4：收尾 commit（如有零散修复）**

```powershell
git status
git add -A
git commit -m "fix(web): 移动端适配验收走查修复"
```

若 `git status` 干净则跳过。
