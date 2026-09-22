import { Box, Button, Card, CardContent, Chip, CircularProgress, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Paper, Tooltip, IconButton, Alert, TablePagination, Typography } from '@mui/material';
import { PlayArrow, Edit, Delete, Refresh, Download, HelpOutlined, Add, Favorite, HeartBroken, Warning } from '@mui/icons-material';
import type { CommandInfo } from '@/types/api';
import { useIsMobile } from '@/hooks/use-is-mobile';
import { MobileCard, MobileField } from './base/mobile-card';
import MobilePagination from './base/mobile-pagination';

interface CommandTableProps {
  commands: CommandInfo[];
  isLoading: boolean;
  total: number;
  page: number;
  pageSize: number;
  onPageChange: (newPage: number) => void;
  onPageSizeChange: (newPageSize: number) => void;
  onRefresh: () => void;
  onOpenExecuteDialog: (command: CommandInfo) => void;
  onOpenEditDialog: (command: CommandInfo) => void;
  onOpenDeleteDialog: (commandId: number) => void;
  onOpenImportDialog: () => void;
  onOpenCreateDialog: () => void;
  onToggleHealthCheck: (commandId: number) => void;
}

export function CommandTable({
  commands,
  isLoading,
  total,
  page,
  pageSize,
  onPageChange,
  onPageSizeChange,
  onRefresh,
  onOpenExecuteDialog,
  onOpenEditDialog,
  onOpenDeleteDialog,
  onOpenImportDialog,
  onOpenCreateDialog,
  onToggleHealthCheck
}: CommandTableProps) {
  const isMobile = useIsMobile();

  return (
    <Box>
      <Box sx={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: 1.5, mb: 3 }}>
        <Typography variant="h5" component="h2" sx={{ fontSize: { xs: '1.25rem', md: '1.5rem' } }}>
          命令管理
        </Typography>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Button
            variant="outlined"
            startIcon={<Refresh />}
            onClick={onRefresh}
            sx={{ display: { xs: 'none', sm: 'inline-flex' } }}
          >
            刷新
          </Button>
          <IconButton aria-label="刷新" onClick={onRefresh} sx={{ display: { xs: 'inline-flex', sm: 'none' } }}>
            <Refresh />
          </IconButton>
          <Button
            variant="outlined"
            startIcon={<Download />}
            onClick={onOpenImportDialog}
            sx={{ display: { xs: 'none', sm: 'inline-flex' } }}
          >
            导入公共命令
          </Button>
          <IconButton aria-label="导入公共命令" onClick={onOpenImportDialog} sx={{ display: { xs: 'inline-flex', sm: 'none' } }}>
            <Download />
          </IconButton>
          <Button
            variant="contained"
            startIcon={<Add />}
            onClick={onOpenCreateDialog}
          >
            新建命令
          </Button>
        </Box>
      </Box>

      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 2 }}>
            <HelpOutlined sx={{ fontSize: 20, color: 'primary.main', mt: 0.25 }} />
            <Box>
              <Typography variant="subtitle2" sx={{ fontWeight: 'bold' }} color="text.primary">
                可选参数设置说明
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                在命令脚本中使用 <code style={{ backgroundColor: 'rgba(0,0,0,0.08)', padding: '2px 4px', borderRadius: 2 }}>${'{'}参数名{'}'}</code> 格式定义占位符，执行时会被替换为实际传入的值。
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                <strong>示例：</strong>
                <br />
                <code style={{ backgroundColor: 'rgba(0,0,0,0.08)', padding: '2px 4px', borderRadius: 2 }}>git checkout ${'{'}version{'}'}</code>
                <br />
                执行时传入 <code style={{ backgroundColor: 'rgba(0,0,0,0.08)', padding: '2px 4px', borderRadius: 2 }}>{'{'}version: &quot;v1.0.0&quot;{'}'}</code>，实际执行：<code style={{ backgroundColor: 'rgba(0,0,0,0.08)', padding: '2px 4px', borderRadius: 2 }}>git checkout v1.0.0</code>
              </Typography>
            </Box>
          </Box>
        </CardContent>
      </Card>

      {isMobile ? (
        <>
          {isLoading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
              <CircularProgress />
            </Box>
          ) : (
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
                  <MobileField
                    label="操作类型"
                    value={<Chip label={command.action_type} size="small" color="primary" />}
                  />
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
              {commands.length === 0 && (
                <Alert severity="info" sx={{ mt: 2 }}>
                  暂无命令，请点击上方按钮创建
                </Alert>
              )}
            </>
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
      ) : isLoading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
          <CircularProgress />
        </Box>
      ) : (
        <TableContainer component={Paper}>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>操作类型</TableCell>
                <TableCell>描述</TableCell>
                <TableCell>超时(秒)</TableCell>
                <TableCell>命令内容</TableCell>
                <TableCell>健康检查</TableCell>
                <TableCell>高危命令</TableCell>
                <TableCell align="right">操作</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {commands.map((command) => (
                <TableRow key={command.id}>
                  <TableCell>
                    <Chip label={command.action_type} size="small" color="primary" />
                  </TableCell>
                  <TableCell>
                    {command.description || '-'}
                  </TableCell>
                  <TableCell>{command.timeout}</TableCell>
                  <TableCell>
                    <Tooltip title={command.shell_command} placement="top">
                      <Box
                        sx={{
                          maxWidth: 400,
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
                        {command.shell_command}
                      </Box>
                    </Tooltip>
                  </TableCell>
                  <TableCell>
                    <Tooltip title={command.is_health_check ? '点击取消健康检查' : '设为健康检查命令'}>
                      <IconButton
                        size="small"
                        color={command.is_health_check ? 'success' : 'default'}
                        onClick={() => onToggleHealthCheck(command.id)}
                      >
                        {command.is_health_check ? <Favorite /> : <HeartBroken />}
                      </IconButton>
                    </Tooltip>
                  </TableCell>
                  <TableCell>
                    {command.requires_confirm && (
                      <Tooltip title="高危命令，执行前需要确认">
                        <Chip
                          icon={<Warning />}
                          label="高危"
                          color="error"
                          size="small"
                        />
                      </Tooltip>
                    )}
                  </TableCell>
                  <TableCell align="right">
                    <Tooltip title="执行">
                      <IconButton
                        size="small"
                        color="success"
                        onClick={() => onOpenExecuteDialog(command)}
                      >
                        <PlayArrow />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="编辑">
                      <IconButton
                        size="small"
                        onClick={() => onOpenEditDialog(command)}
                      >
                        <Edit />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="删除">
                      <IconButton
                        size="small"
                        color="error"
                        onClick={() => onOpenDeleteDialog(command.id)}
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

      {!isMobile && !isLoading && commands.length === 0 && (
        <Alert severity="info" sx={{ mt: 2 }}>
          暂无命令，请点击上方按钮创建
        </Alert>
      )}

      {!isMobile && total > 0 && (
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
