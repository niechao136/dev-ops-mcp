'use client';

import { useState } from 'react';
import {
  Box,
  Button,
  Container,
  Typography,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  CircularProgress,
  IconButton,
  Tooltip,
  Alert,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Chip,
  TablePagination
} from '@mui/material';
import {
  Add,
  Edit,
  Delete,
  Refresh,
  ContentCopy,
  LocalOffer
} from '@mui/icons-material';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { enqueueSnackbar } from 'notistack';
import ProtectedRoute from '@/components/protected-route';
import MainLayout from '@/components/main-layout';
import { apiService } from '@/services/api';
import type { PublicCommandInfo, PublicCommandAdd, PublicCommandUpdate } from '@/types/api';


export default function PublicCommandsPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize] = useState(10);

  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [currentCommand, setCurrentCommand] = useState<PublicCommandInfo | null>(null);
  const [formData, setFormData] = useState<PublicCommandAdd>({
    name: '',
    action_type: '',
    description: '',
    shell_command: '',
    timeout: 60,
    default_params: undefined,
    tags: ''
  });
  const [defaultParamsText, setDefaultParamsText] = useState('');

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['publicCommands', page, search],
    queryFn: () => apiService.getPublicCommands({
      page,
      size: pageSize,
      keyword: search || undefined,
      order_by: 'updated_at',
      direction: 'desc'
    }),
  });

  const createMutation = useMutation({
    mutationFn: (data: PublicCommandAdd) => apiService.createPublicCommand(data),
    onSuccess: (result) => {
      if (result.status === 1) {
        enqueueSnackbar('创建成功', { variant: 'success' });
        setCreateDialogOpen(false);
        resetForm();
        queryClient.invalidateQueries({ queryKey: ['publicCommands'] });
      } else {
        enqueueSnackbar(result.msg || '创建失败', { variant: 'error' });
      }
    },
    onError: () => {
      enqueueSnackbar('创建失败', { variant: 'error' });
    }
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: PublicCommandUpdate }) =>
      apiService.updatePublicCommand(id, data),
    onSuccess: (result) => {
      if (result.status === 1) {
        enqueueSnackbar('更新成功', { variant: 'success' });
        setEditDialogOpen(false);
        setCurrentCommand(null);
        queryClient.invalidateQueries({ queryKey: ['publicCommands'] });
      } else {
        enqueueSnackbar(result.msg || '更新失败', { variant: 'error' });
      }
    },
    onError: () => {
      enqueueSnackbar('更新失败', { variant: 'error' });
    }
  });

  const deleteMutation = useMutation({
    mutationFn: (ids: number[]) => apiService.deletePublicCommands(ids),
    onSuccess: (result) => {
      if (result.status === 1) {
        enqueueSnackbar('删除成功', { variant: 'success' });
        setDeleteDialogOpen(false);
        setCurrentCommand(null);
        queryClient.invalidateQueries({ queryKey: ['publicCommands'] });
      } else {
        enqueueSnackbar(result.msg || '删除失败', { variant: 'error' });
      }
    },
    onError: () => {
      enqueueSnackbar('删除失败', { variant: 'error' });
    }
  });

  const resetForm = () => {
    setFormData({
      name: '',
      action_type: '',
      description: '',
      shell_command: '',
      timeout: 60,
      default_params: undefined,
      tags: ''
    });
    setDefaultParamsText('');
  };

  const handleCreate = () => {
    if (!formData.name || !formData.action_type || !formData.shell_command) {
      enqueueSnackbar('请填写必填项', { variant: 'warning' });
      return;
    }

    let parsedDefaultParams: Record<string, any> | undefined = undefined;
    if (defaultParamsText.trim()) {
      try {
        parsedDefaultParams = JSON.parse(defaultParamsText);
      } catch {
        enqueueSnackbar('默认参数 JSON 格式错误', { variant: 'error' });
        return;
      }
    }

    createMutation.mutate({
      ...formData,
      default_params: parsedDefaultParams
    });
  };

  const handleEdit = () => {
    if (!currentCommand) return;

    let parsedDefaultParams: Record<string, any> | undefined = undefined;
    if (defaultParamsText.trim()) {
      try {
        parsedDefaultParams = JSON.parse(defaultParamsText);
      } catch {
        enqueueSnackbar('默认参数 JSON 格式错误', { variant: 'error' });
        return;
      }
    }

    updateMutation.mutate({
      id: currentCommand.id,
      data: {
        name: formData.name,
        action_type: formData.action_type,
        description: formData.description,
        shell_command: formData.shell_command,
        timeout: formData.timeout,
        default_params: parsedDefaultParams,
        tags: formData.tags
      }
    });
  };

  const handleDelete = () => {
    if (!currentCommand) return;
    deleteMutation.mutate([currentCommand.id]);
  };

  const openEditDialog = (command: PublicCommandInfo) => {
    setCurrentCommand(command);
    setFormData({
      name: command.name,
      action_type: command.action_type,
      description: command.description || '',
      shell_command: command.shell_command,
      timeout: command.timeout,
      default_params: command.default_params,
      tags: command.tags || ''
    });
    setDefaultParamsText(command.default_params ? JSON.stringify(command.default_params, null, 2) : '');
    setEditDialogOpen(true);
  };

  return (
    <ProtectedRoute>
      <MainLayout>
        <Container maxWidth="lg">
          <Box sx={{ mb: 4 }}>
            <Typography variant="h4" component="h1" sx={{ mb: 3 }}>
              公共命令管理
            </Typography>

            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
              <TextField
                placeholder="搜索名称、描述、操作类型..."
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(1);
                }}
                size="small"
                sx={{ width: 300 }}
              />
              <Box sx={{ display: 'flex', gap: 2 }}>
                <Button
                  variant="outlined"
                  startIcon={<Refresh />}
                  onClick={() => refetch()}
                >
                  刷新
                </Button>
                <Button
                  variant="contained"
                  startIcon={<Add />}
                  onClick={() => {
                    resetForm();
                    setCreateDialogOpen(true);
                  }}
                >
                  新建公共命令
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
                      <TableCell>名称</TableCell>
                      <TableCell>操作类型</TableCell>
                      <TableCell>描述</TableCell>
                      <TableCell>标签</TableCell>
                      <TableCell>超时(秒)</TableCell>
                      <TableCell align="right">操作</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {data?.data?.map((command) => (
                      <TableRow key={command.id}>
                        <TableCell>{command.name}</TableCell>
                        <TableCell>
                          <Chip label={command.action_type} size="small" color="primary" />
                        </TableCell>
                        <TableCell>
                          <Tooltip title={command.description || ''}>
                            <Typography variant="body2" sx={{
                              maxWidth: 200,
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap'
                            }}>
                              {command.description || '-'}
                            </Typography>
                          </Tooltip>
                        </TableCell>
                        <TableCell>
                          {command.tags ? (
                            <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
                              {command.tags.split(',').filter(t => t.trim()).map((tag, i) => (
                                <Chip
                                  key={i}
                                  label={tag.trim()}
                                  size="small"
                                  icon={<LocalOffer />}
                                  sx={{ fontSize: '0.75rem' }}
                                />
                              ))}
                            </Box>
                          ) : '-'}
                        </TableCell>
                        <TableCell>{command.timeout}</TableCell>
                        <TableCell align="right">
                          <Tooltip title="复制命令">
                            <IconButton
                              size="small"
                              onClick={() => {
                                navigator.clipboard.writeText(command.shell_command);
                                enqueueSnackbar('命令已复制', { variant: 'success' });
                              }}
                            >
                              <ContentCopy />
                            </IconButton>
                          </Tooltip>
                          <Tooltip title="编辑">
                            <IconButton
                              size="small"
                              onClick={() => openEditDialog(command)}
                            >
                              <Edit />
                            </IconButton>
                          </Tooltip>
                          <Tooltip title="删除">
                            <IconButton
                              size="small"
                              color="error"
                              onClick={() => {
                                setCurrentCommand(command);
                                setDeleteDialogOpen(true);
                              }}
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

            {!isLoading && data?.data?.length === 0 && (
              <Alert severity="info" sx={{ mt: 2 }}>
                暂无公共命令，请点击上方按钮创建
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
        </Container>

        {/* 创建对话框 */}
        <Dialog open={createDialogOpen} onClose={() => setCreateDialogOpen(false)} maxWidth="md" fullWidth>
          <DialogTitle>新建公共命令</DialogTitle>
          <DialogContent>
            <Box sx={{ pt: 1, display: 'flex', flexDirection: 'column', gap: 2 }}>
              <TextField
                label="命令名称"
                fullWidth
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="如：Git 拉取代码"
              />
              <TextField
                label="操作类型"
                fullWidth
                value={formData.action_type}
                onChange={(e) => setFormData({ ...formData, action_type: e.target.value })}
                placeholder="git_pull, docker_build, deploy 等"
              />
              <TextField
                label="描述"
                fullWidth
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              />
              <TextField
                label="标签"
                fullWidth
                value={formData.tags}
                onChange={(e) => setFormData({ ...formData, tags: e.target.value })}
                placeholder="多个标签用逗号分隔，如：git,docker,部署"
                helperText="用于分类和筛选公共命令"
              />
              <TextField
                label="超时时间(秒)"
                fullWidth
                type="number"
                value={formData.timeout}
                onChange={(e) => setFormData({ ...formData, timeout: parseInt(e.target.value) || 60 })}
              />
              <TextField
                label="默认参数 (JSON格式)"
                fullWidth
                multiline
                rows={4}
                value={defaultParamsText}
                onChange={(e) => setDefaultParamsText(e.target.value)}
                placeholder='{"version": "v1.0.0", "env": "production"}'
                helperText="使用 JSON 格式设置可选参数的默认值"
                sx={{
                  '& .MuiInputBase-input': {
                    fontFamily: 'monospace'
                  }
                }}
              />
              <TextField
                label="Shell命令"
                fullWidth
                multiline
                rows={6}
                value={formData.shell_command}
                onChange={(e) => setFormData({ ...formData, shell_command: e.target.value })}
                placeholder="输入要执行的Shell命令"
                sx={{
                  '& .MuiInputBase-input': {
                    fontFamily: 'monospace'
                  }
                }}
              />
            </Box>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setCreateDialogOpen(false)}>取消</Button>
            <Button
              onClick={handleCreate}
              variant="contained"
              disabled={createMutation.isPending}
            >
              {createMutation.isPending ? <CircularProgress size={20} /> : '创建'}
            </Button>
          </DialogActions>
        </Dialog>

        {/* 编辑对话框 */}
        <Dialog open={editDialogOpen} onClose={() => setEditDialogOpen(false)} maxWidth="md" fullWidth>
          <DialogTitle>编辑公共命令</DialogTitle>
          <DialogContent>
            <Box sx={{ pt: 1, display: 'flex', flexDirection: 'column', gap: 2 }}>
              <TextField
                label="命令名称"
                fullWidth
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              />
              <TextField
                label="操作类型"
                fullWidth
                value={formData.action_type}
                onChange={(e) => setFormData({ ...formData, action_type: e.target.value })}
              />
              <TextField
                label="描述"
                fullWidth
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              />
              <TextField
                label="标签"
                fullWidth
                value={formData.tags}
                onChange={(e) => setFormData({ ...formData, tags: e.target.value })}
                placeholder="多个标签用逗号分隔"
              />
              <TextField
                label="超时时间(秒)"
                fullWidth
                type="number"
                value={formData.timeout}
                onChange={(e) => setFormData({ ...formData, timeout: parseInt(e.target.value) || 60 })}
              />
              <TextField
                label="默认参数 (JSON格式)"
                fullWidth
                multiline
                rows={4}
                value={defaultParamsText}
                onChange={(e) => setDefaultParamsText(e.target.value)}
                sx={{
                  '& .MuiInputBase-input': {
                    fontFamily: 'monospace'
                  }
                }}
              />
              <TextField
                label="Shell命令"
                fullWidth
                multiline
                rows={6}
                value={formData.shell_command}
                onChange={(e) => setFormData({ ...formData, shell_command: e.target.value })}
                sx={{
                  '& .MuiInputBase-input': {
                    fontFamily: 'monospace'
                  }
                }}
              />
            </Box>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setEditDialogOpen(false)}>取消</Button>
            <Button
              onClick={handleEdit}
              variant="contained"
              disabled={updateMutation.isPending}
            >
              {updateMutation.isPending ? <CircularProgress size={20} /> : '保存'}
            </Button>
          </DialogActions>
        </Dialog>

        {/* 删除对话框 */}
        <Dialog open={deleteDialogOpen} onClose={() => setDeleteDialogOpen(false)}>
          <DialogTitle>确认删除</DialogTitle>
          <DialogContent>
            <Typography>
              确定要删除公共命令&quot;{currentCommand?.name}&quot;吗？此操作不可恢复。
            </Typography>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setDeleteDialogOpen(false)}>取消</Button>
            <Button
              onClick={handleDelete}
              color="error"
              variant="contained"
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending ? <CircularProgress size={20} /> : '删除'}
            </Button>
          </DialogActions>
        </Dialog>
      </MainLayout>
    </ProtectedRoute>
  );
}
