import { Box, Button, Card, CardContent, Chip, CircularProgress, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Paper, Tooltip, IconButton, Alert, TablePagination, Typography, Switch } from '@mui/material';
import { PlayArrow, Edit, Delete, Refresh, Add, Timer, Schema } from '@mui/icons-material';
import type { AutomationInfo } from '@/types/api';

interface AutomationTableProps {
  automations: AutomationInfo[];
  isLoading: boolean;
  total: number;
  page: number;
  pageSize: number;
  onPageChange: (newPage: number) => void;
  onPageSizeChange: (newPageSize: number) => void;
  onRefresh: () => void;
  onOpenCreateDialog: () => void;
  onOpenEditDialog: (automation: AutomationInfo) => void;
  onOpenDeleteDialog: (automationId: number) => void;
  onToggleEnabled: (automationId: number) => void;
}

export function AutomationTable({
  automations,
  isLoading,
  total,
  page,
  pageSize,
  onPageChange,
  onPageSizeChange,
  onRefresh,
  onOpenCreateDialog,
  onOpenEditDialog,
  onOpenDeleteDialog,
  onToggleEnabled
}: AutomationTableProps) {
  const formatTime = (dateString?: string) => {
    if (!dateString) return '-';
    const date = new Date(dateString);
    return date.toLocaleString('zh-CN');
  };

  const getStatusColor = (status?: string) => {
    switch (status) {
      case 'success': return 'success';
      case 'failed': return 'error';
      case 'running': return 'warning';
      default: return 'default';
    }
  };

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h5" component="h2">
          自动化规则
        </Typography>
        <Box sx={{ display: 'flex', gap: 2 }}>
          <Button
            variant="outlined"
            startIcon={<Refresh />}
            onClick={onRefresh}
          >
            刷新
          </Button>
          <Button
            variant="contained"
            startIcon={<Add />}
            onClick={onOpenCreateDialog}
          >
            新建规则
          </Button>
        </Box>
      </Box>

      {isLoading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
          <CircularProgress />
        </Box>
      ) : (
        <TableContainer component={Paper}>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>规则名称</TableCell>
                <TableCell>触发类型</TableCell>
                <TableCell>触发配置</TableCell>
                <TableCell>执行命令</TableCell>
                <TableCell>状态</TableCell>
                <TableCell>最后执行</TableCell>
                <TableCell align="right">操作</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {automations.map((automation) => (
                <TableRow key={automation.id}>
                  <TableCell>
                    <Typography sx={{ fontWeight: 'medium' }} variant="body1">
                      {automation.name}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Chip
                      icon={automation.trigger_type === 'cron' ? <Timer fontSize="small" /> : <Schema fontSize="small" />}
                      label={automation.trigger_type === 'cron' ? '定时触发' : '条件触发'}
                      size="small"
                      color={automation.trigger_type === 'cron' ? 'primary' : 'info'}
                    />
                  </TableCell>
                  <TableCell>
                    <Tooltip
                      title={automation.trigger_type === 'cron' ? automation.cron_expression : automation.condition_script}
                      placement="top"
                    >
                      <Box
                        sx={{
                          maxWidth: 250,
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                          fontFamily: 'monospace',
                          bgcolor: (theme) =>
                            theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.08)' : 'grey.100',
                          color: (theme) =>
                            theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.9)' : 'inherit',
                          p: 1,
                          borderRadius: 1,
                          cursor: 'pointer',
                          border: 1,
                          borderColor: (theme) =>
                            theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.12)' : 'divider'
                        }}
                      >
                        {automation.trigger_type === 'cron'
                          ? automation.cron_expression || '-'
                          : `${automation.condition_script?.substring(0, 50)}${(automation.condition_script?.length ?? 0) > 50 ? '...' : ''}`}
                      </Box>
                    </Tooltip>
                  </TableCell>
                  <TableCell>
                    <Chip
                      label={automation.command_action}
                      size="small"
                      variant="outlined"
                    />
                    {automation.command_description && (
                      <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                        {automation.command_description}
                      </Typography>
                    )}
                  </TableCell>
                  <TableCell>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                      <Switch
                        checked={automation.is_enabled}
                        onChange={() => onToggleEnabled(automation.id)}
                        size="small"
                        color={automation.is_enabled ? 'success' : 'default'}
                      />
                      <Typography variant="body2">
                        {automation.is_enabled ? '已启用' : '已禁用'}
                      </Typography>
                    </Box>
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2" color="text.secondary">
                      {formatTime(automation.last_run_time)}
                    </Typography>
                    {automation.last_run_status && (
                      <Chip
                        label={automation.last_run_status}
                        size="small"
                        color={getStatusColor(automation.last_run_status)}
                        sx={{ mt: 1 }}
                      />
                    )}
                  </TableCell>
                  <TableCell align="right">
                    <Tooltip title="编辑">
                      <IconButton
                        size="small"
                        onClick={() => onOpenEditDialog(automation)}
                      >
                        <Edit />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="删除">
                      <IconButton
                        size="small"
                        color="error"
                        onClick={() => onOpenDeleteDialog(automation.id)}
                      >
                        <Delete />
                      </IconButton>
                    </Tooltip>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      {!isLoading && automations.length === 0 && (
        <Alert severity="info" sx={{ mt: 2 }}>
          暂无自动化规则，请点击上方按钮创建
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
    </Box>
  );
}
