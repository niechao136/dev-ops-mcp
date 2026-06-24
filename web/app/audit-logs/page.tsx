'use client';

import { useState } from 'react';
import {
  Box,
  Button,
  Container,
  Chip,
  Typography,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  CircularProgress,
  IconButton,
  Tooltip,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Checkbox,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Divider,
  TablePagination,
  Alert
} from '@mui/material';
import {
  Refresh,
  Search,
  Delete,
  Visibility,
  ExpandMore
} from '@mui/icons-material';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { enqueueSnackbar } from 'notistack';
import ProtectedRoute from '@/components/protected-route';
import MainLayout from '@/components/main-layout';
import { apiService } from '@/services/api';
import type { AuditLogInfo, AuditLogQueryParams } from '@/types/api';


export default function AuditLogsPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(10);
  const [filters, setFilters] = useState<AuditLogQueryParams>({});

  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [detailDialogOpen, setDetailDialogOpen] = useState(false);
  const [currentLog, setCurrentLog] = useState<AuditLogInfo | null>(null);


  const { data, isLoading, refetch } = useQuery({
    queryKey: ['auditLogs', page, search, filters],
    queryFn: () => apiService.getAuditLogs({
      page,
      size: pageSize,
      keyword: search || undefined,
      ...filters,
      order_by: 'created_at',
      direction: 'desc'
    }),
  });


  const deleteMutation = useMutation({
    mutationFn: (ids: number[]) => apiService.deleteAuditLogs(ids),
    onSuccess: (result) => {
      if (result.status === 1) {
        enqueueSnackbar('删除成功', { variant: 'success' });
        setDeleteDialogOpen(false);
        setSelectedIds([]);
        queryClient.invalidateQueries({ queryKey: ['auditLogs'] });
      } else {
        enqueueSnackbar(result.msg || '删除失败', { variant: 'error' });
      }
    },
    onError: () => {
      enqueueSnackbar('删除失败', { variant: 'error' });
    }
  });


  const handleDelete = () => {
    if (selectedIds.length === 0) return;
    deleteMutation.mutate(selectedIds);
  };


  const openDetailDialog = (log: AuditLogInfo) => {
    setCurrentLog(log);
    setDetailDialogOpen(true);
  };


  const toggleSelect = (id: number) => {
    setSelectedIds(prev =>
      prev.includes(id)
        ? prev.filter(item => item !== id)
        : [...prev, id]
    );
  };


  const toggleSelectAll = () => {
    if (!data?.data) return;
    const allIds = data.data.map(item => item.id);
    const allSelected = selectedIds.length === allIds.length;
    setSelectedIds(allSelected ? [] : allIds);
  };


  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString('zh-CN');
  };


  const getActorTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      'user': '用户',
      'api_key': 'API Key',
      'system': '系统'
    };
    return labels[type] || type;
  };


  const getStatusColor = (status: string) => {
    const colors: Record<string, 'success' | 'error' | 'warning' | 'default'> = {
      'success': 'success',
      'failed': 'error',
      'warning': 'warning'
    };
    return colors[status] || 'default';
  };


  const getStatusLabel = (status: string) => {
    const labels: Record<string, string> = {
      'success': '成功',
      'failed': '失败',
      'warning': '警告'
    };
    return labels[status] || status;
  };


  return (
    <ProtectedRoute>
      <MainLayout>
        <Container maxWidth="xl">
          <Box sx={{ mb: 4 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
              <Typography variant="h4" component="h1">
                操作日志
              </Typography>
              <Box sx={{ display: 'flex', gap: 2 }}>
                <Button
                  variant="outlined"
                  startIcon={<Refresh />}
                  onClick={() => refetch()}
                >
                  刷新
                </Button>
                {selectedIds.length > 0 && (
                  <Button
                    variant="outlined"
                    color="error"
                    startIcon={<Delete />}
                    onClick={() => setDeleteDialogOpen(true)}
                  >
                    删除选中 ({selectedIds.length})
                  </Button>
                )}
              </Box>
            </Box>

            {/* 搜索和筛选 */}
            <Accordion defaultExpanded sx={{ mb: 3 }}>
              <AccordionSummary expandIcon={<ExpandMore />}>
                <Typography>搜索和筛选</Typography>
              </AccordionSummary>
              <AccordionDetails>
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', bgcolor: 'background.paper', p: 1, borderRadius: 1, border: 1, borderColor: 'divider' }}>
                    <Search color="action" />
                    <input
                      style={{
                        flex: 1,
                        border: 'none',
                        outline: 'none',
                        fontSize: '1rem',
                        background: 'transparent'
                      }}
                      placeholder="搜索操作日志..."
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                    />
                  </Box>
                  <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
                    <FormControl sx={{ minWidth: 200 }}>
                      <InputLabel>操作者类型</InputLabel>
                      <Select
                        value={filters.actor_type || ''}
                        label="操作者类型"
                        onChange={(e) => setFilters({ ...filters, actor_type: e.target.value || undefined })}
                      >
                        <MenuItem value="">全部</MenuItem>
                        <MenuItem value="user">用户</MenuItem>
                        <MenuItem value="api_key">API Key</MenuItem>
                        <MenuItem value="system">系统</MenuItem>
                      </Select>
                    </FormControl>
                    <FormControl sx={{ minWidth: 200 }}>
                      <InputLabel>操作状态</InputLabel>
                      <Select
                        value={filters.status || ''}
                        label="操作状态"
                        onChange={(e) => setFilters({ ...filters, status: e.target.value || undefined })}
                      >
                        <MenuItem value="">全部</MenuItem>
                        <MenuItem value="success">成功</MenuItem>
                        <MenuItem value="failed">失败</MenuItem>
                        <MenuItem value="warning">警告</MenuItem>
                      </Select>
                    </FormControl>
                    <FormControl sx={{ minWidth: 200 }}>
                      <InputLabel>目标项目</InputLabel>
                      <Select
                        value={filters.target_project || ''}
                        label="目标项目"
                        onChange={(e) => setFilters({ ...filters, target_project: e.target.value || undefined })}
                      >
                        <MenuItem value="">全部</MenuItem>
                      </Select>
                    </FormControl>
                  </Box>
                </Box>
              </AccordionDetails>
            </Accordion>

            {/* 日志列表 */}
            {isLoading ? (
              <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
                <CircularProgress />
              </Box>
            ) : (
              <TableContainer component={Paper}>
                <Table>
                  <TableHead>
                    <TableRow>
                      <TableCell padding="checkbox">
                        <Checkbox
                          checked={selectedIds.length === data?.data?.length && data?.data?.length > 0}
                          indeterminate={selectedIds.length > 0 && selectedIds.length < (data?.data?.length || 0)}
                          onChange={toggleSelectAll}
                        />
                      </TableCell>
                      <TableCell>ID</TableCell>
                      <TableCell>操作者</TableCell>
                      <TableCell>操作类型</TableCell>
                      <TableCell>目标项目</TableCell>
                      <TableCell>状态</TableCell>
                      <TableCell>IP 地址</TableCell>
                      <TableCell>操作时间</TableCell>
                      <TableCell align="right">操作</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {data?.data?.map((log) => (
                      <TableRow key={log.id}>
                        <TableCell padding="checkbox">
                          <Checkbox
                            checked={selectedIds.includes(log.id)}
                            onChange={() => toggleSelect(log.id)}
                          />
                        </TableCell>
                        <TableCell>{log.id}</TableCell>
                        <TableCell>
                          <Box sx={{ display: 'flex', flexDirection: 'column' }}>
                            <Box sx={{ fontWeight: 500 }}>{log.actor_name || '-'}</Box>
                            <Box sx={{ fontSize: '0.8rem', color: 'text.secondary' }}>
                              {getActorTypeLabel(log.actor_type)}
                            </Box>
                          </Box>
                        </TableCell>
                        <TableCell>{log.action_category}</TableCell>
                        <TableCell>{log.target_project || '-'}</TableCell>
                        <TableCell>
                          <Chip
                            label={getStatusLabel(log.status)}
                            color={getStatusColor(log.status)}
                            size="small"
                          />
                        </TableCell>
                        <TableCell>{log.ip_address || '-'}</TableCell>
                        <TableCell>{formatDate(log.created_at)}</TableCell>
                        <TableCell align="right">
                          <Tooltip title="查看详情">
                            <IconButton
                              size="small"
                              onClick={() => openDetailDialog(log)}
                            >
                              <Visibility />
                            </IconButton>
                          </Tooltip>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            )}

            {!isLoading && data?.data?.length === 0 && (
              <Alert severity="info" sx={{ mt: 2 }}>
                暂无日志记录
              </Alert>
            )}

            {data && data.total > 0 && (
              <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: 2 }}>
                <TablePagination
                  component="div"
                  count={data.total}
                  page={page - 1}
                  onPageChange={(event, newPage) => setPage(newPage + 1)}
                  rowsPerPage={pageSize}
                  rowsPerPageOptions={[10, 25, 50]}
                  labelRowsPerPage="每页行数"
                  labelDisplayedRows={({ from, to, count }) => `${from}-${to} 共 ${count}`}
                />
              </Box>
            )}
          </Box>

          {/* 日志详情对话框 */}
          <Dialog open={detailDialogOpen} onClose={() => setDetailDialogOpen(false)} maxWidth="md" fullWidth>
            <DialogTitle>操作日志详情</DialogTitle>
            <DialogContent>
              <Box sx={{ mt: 1 }}>
                {currentLog && (
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                      <Typography variant="subtitle2">基本信息</Typography>
                    </Box>
                    <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 2 }}>
                      <Box>
                        <Typography variant="body2" color="text.secondary">ID</Typography>
                        <Typography variant="body1">{currentLog.id}</Typography>
                      </Box>
                      <Box>
                        <Typography variant="body2" color="text.secondary">操作时间</Typography>
                        <Typography variant="body1">{formatDate(currentLog.created_at)}</Typography>
                      </Box>
                      <Box>
                        <Typography variant="body2" color="text.secondary">操作者</Typography>
                        <Typography variant="body1">{currentLog.actor_name || '-'}</Typography>
                      </Box>
                      <Box>
                        <Typography variant="body2" color="text.secondary">操作者类型</Typography>
                        <Chip
                          label={getActorTypeLabel(currentLog.actor_type)}
                          size="small"
                        />
                      </Box>
                      <Box>
                        <Typography variant="body2" color="text.secondary">操作类型</Typography>
                        <Typography variant="body1">{currentLog.action_category}</Typography>
                      </Box>
                      <Box>
                        <Typography variant="body2" color="text.secondary">目标项目</Typography>
                        <Typography variant="body1">{currentLog.target_project || '-'}</Typography>
                      </Box>
                      <Box>
                        <Typography variant="body2" color="text.secondary">状态</Typography>
                        <Chip
                          label={getStatusLabel(currentLog.status)}
                          color={getStatusColor(currentLog.status)}
                          size="small"
                        />
                      </Box>
                      <Box>
                        <Typography variant="body2" color="text.secondary">IP 地址</Typography>
                        <Typography variant="body1">{currentLog.ip_address || '-'}</Typography>
                      </Box>
                    </Box>

                    <Divider sx={{ my: 1 }} />

                    <Box>
                      <Typography variant="subtitle2" sx={{ mb: 1 }}>操作详情</Typography>
                      <Paper sx={{ p: 2, bgcolor: 'background.default' }}>
                        <pre style={{ margin: 0, whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>
                          {JSON.stringify(currentLog.action_details, null, 2)}
                        </pre>
                      </Paper>
                    </Box>

                    {currentLog.output_log && (
                      <>
                        <Divider sx={{ my: 1 }} />
                        <Box>
                          <Typography variant="subtitle2" sx={{ mb: 1 }}>输出日志</Typography>
                          <Paper sx={{ p: 2, bgcolor: 'background.default' }}>
                            <pre style={{ margin: 0, whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>
                              {currentLog.output_log}
                            </pre>
                          </Paper>
                        </Box>
                      </>
                    )}
                  </Box>
                )}
              </Box>
            </DialogContent>
            <DialogActions>
              <Button onClick={() => setDetailDialogOpen(false)}>
                关闭
              </Button>
            </DialogActions>
          </Dialog>

          {/* 删除确认对话框 */}
          <Dialog open={deleteDialogOpen} onClose={() => setDeleteDialogOpen(false)}>
            <DialogTitle>确认删除</DialogTitle>
            <DialogContent>
              <Typography>
                确定要删除选中的 {selectedIds.length} 条操作日志吗？此操作不可恢复。
              </Typography>
            </DialogContent>
            <DialogActions>
              <Button onClick={() => setDeleteDialogOpen(false)}>
                取消
              </Button>
              <Button
                onClick={handleDelete}
                color="error"
                variant="contained"
                disabled={deleteMutation.isPending}
              >
                {deleteMutation.isPending ? <CircularProgress size={24} /> : '删除'}
              </Button>
            </DialogActions>
          </Dialog>
        </Container>
      </MainLayout>
    </ProtectedRoute>
  );
}
