'use client';

import {
  Box,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Checkbox,
  Chip,
  IconButton,
  Tooltip,
  CircularProgress,
  Alert,
  TablePagination,
  Typography
} from '@mui/material';
import {
  Edit,
  Delete,
  Visibility,
  ToggleOff,
  ToggleOn
} from '@mui/icons-material';
import type { ProjectInfo } from '@/types/api';
import { useIsMobile } from '@/hooks/use-is-mobile';
import { MobileCard, MobileField } from './base/mobile-card';
import MobileSelectionBar from './base/mobile-selection-bar';
import MobilePagination from './base/mobile-pagination';

interface ProjectTableProps {
  projects: ProjectInfo[] | undefined;
  total: number;
  isLoading: boolean;
  selectedIds: number[];
  page: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (pageSize: number) => void;
  onToggleSelect: (id: number) => void;
  onToggleSelectAll: () => void;
  onToggleActive: (id: number, isActive: boolean) => void;
  onView: (id: number) => void;
  onEdit: (project: ProjectInfo) => void;
  onDelete: () => void;
  toggleActiveMutation: { isPending: boolean };
}

export default function ProjectTable({
  projects,
  total,
  isLoading,
  selectedIds,
  page,
  pageSize,
  onPageChange,
  onPageSizeChange,
  onToggleSelect,
  onToggleSelectAll,
  onToggleActive,
  onView,
  onEdit,
  onDelete,
  toggleActiveMutation
}: ProjectTableProps) {
  const isMobile = useIsMobile();

  if (isLoading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
        <CircularProgress />
      </Box>
    );
  }

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

  return (
    <>
      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell padding="checkbox">
                <Checkbox
                  checked={selectedIds.length === projects?.length && projects?.length > 0}
                  indeterminate={selectedIds.length > 0 && selectedIds.length < (projects?.length || 0)}
                  onChange={onToggleSelectAll}
                />
              </TableCell>
              <TableCell>项目名称</TableCell>
              <TableCell>工作目录</TableCell>
              <TableCell>命令数</TableCell>
              <TableCell>状态</TableCell>
              <TableCell align="right">操作</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {projects?.map((project) => (
              <TableRow key={project.id}>
                <TableCell padding="checkbox">
                  <Checkbox
                    checked={selectedIds.includes(project.id)}
                    onChange={() => onToggleSelect(project.id)}
                  />
                </TableCell>
                <TableCell>
                  <Box sx={{ fontWeight: 500 }}>{project.name}</Box>
                  {project.description && (
                    <Typography variant="body2" color="text.secondary">
                      {project.description}
                    </Typography>
                  )}
                </TableCell>
                <TableCell>{project.work_dir}</TableCell>
                <TableCell>{project.command_count}</TableCell>
                <TableCell>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Chip
                      label={project.is_active ? '启用' : '禁用'}
                      color={project.is_active ? 'success' : 'default'}
                      size="small"
                    />
                    <Tooltip title={project.is_active ? '点击禁用' : '点击启用'}>
                      <IconButton
                        size="small"
                        onClick={() => onToggleActive(project.id, !project.is_active)}
                        disabled={toggleActiveMutation.isPending}
                        color={project.is_active ? 'default' : 'primary'}
                      >
                        {project.is_active ? <ToggleOff /> : <ToggleOn />}
                      </IconButton>
                    </Tooltip>
                  </Box>
                </TableCell>
                <TableCell align="right">
                  <Tooltip title="查看详情">
                    <IconButton
                      size="small"
                      onClick={() => onView(project.id)}
                    >
                      <Visibility />
                    </IconButton>
                  </Tooltip>
                  <Tooltip title="编辑">
                    <IconButton
                      size="small"
                      onClick={() => onEdit(project)}
                    >
                      <Edit />
                    </IconButton>
                  </Tooltip>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>

      {!isLoading && projects?.length === 0 && (
        <Alert severity="info" sx={{ mt: 2 }}>
          暂无项目，请点击上方按钮创建
        </Alert>
      )}

      {total > 0 && (
        <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: 2, alignItems: 'center', gap: 2 }}>
          <Typography variant="body2" sx={{ color: 'text.secondary' }}>
            共 {total} 条
          </Typography>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Typography variant="body2" sx={{ color: 'text.secondary' }}>第</Typography>
            <input
              type="number"
              min="1"
              max={Math.ceil(total / pageSize)}
              value={page}
              onChange={(e) => {
                const newPage = parseInt(e.target.value) || 1;
                const maxPage = Math.ceil(total / pageSize) || 1;
                onPageChange(Math.min(Math.max(newPage, 1), maxPage));
              }}
              style={{
                width: 60,
                padding: '4px 8px',
                border: '1px solid rgba(0,0,0,0.23)',
                borderRadius: 4,
                textAlign: 'center',
                fontSize: 14,
                backgroundColor: 'transparent',
                color: 'inherit'
              }}
            />
            <Typography variant="body2" sx={{ color: 'text.secondary' }}>
              页 / {Math.ceil(total / pageSize)} 页
            </Typography>
          </Box>
          <TablePagination
            component="div"
            count={total}
            page={page - 1}
            onPageChange={(event, newPage) => onPageChange(newPage + 1)}
            rowsPerPage={pageSize}
            onRowsPerPageChange={(event) => {
              onPageSizeChange(parseInt(event.target.value));
              onPageChange(1);
            }}
            rowsPerPageOptions={[10, 25, 50, 100]}
            labelRowsPerPage="每页"
          />
        </Box>
      )}
    </>
  );
}
