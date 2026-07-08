import { Box, Button, Card, CardContent, Chip, CircularProgress, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Paper, Tooltip, IconButton, Alert, TablePagination, Typography } from '@mui/material';
import { PlayArrow, Edit, Delete, Refresh, Download, HelpOutlined, Add, Favorite, HeartBroken } from '@mui/icons-material';
import type { CommandInfo } from '@/types/api';

interface CommandTableProps {
  commands: CommandInfo[];
  isLoading: boolean;
  total: number;
  page: number;
  pageSize: number;
  onPageChange: (newPage: number) => void;
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
  onRefresh,
  onOpenExecuteDialog,
  onOpenEditDialog,
  onOpenDeleteDialog,
  onOpenImportDialog,
  onOpenCreateDialog,
  onToggleHealthCheck
}: CommandTableProps) {
  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h5" component="h2">
          命令管理
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
            variant="outlined"
            startIcon={<Download />}
            onClick={onOpenImportDialog}
          >
            导入公共命令
          </Button>
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

      {isLoading ? (
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

      {!isLoading && commands.length === 0 && (
        <Alert severity="info" sx={{ mt: 2 }}>
          暂无命令，请点击上方按钮创建
        </Alert>
      )}

      {total > 0 && (
        <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: 2 }}>
          <TablePagination
            component="div"
            count={total}
            page={page - 1}
            onPageChange={(event, newPage) => onPageChange(newPage + 1)}
            rowsPerPage={pageSize}
            rowsPerPageOptions={[10, 25, 50]}
            labelRowsPerPage="每页行数"
            labelDisplayedRows={({ from, to, count }) => `${from}-${to} 共 ${count}`}
          />
        </Box>
      )}
    </Box>
  );
}
