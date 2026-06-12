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
  Checkbox,
  Chip
} from '@mui/material';
import {
  Add,
  Edit,
  Delete,
  Refresh,
  ContentCopy,
  RestartAlt,
  ToggleOff,
  ToggleOn
} from '@mui/icons-material';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { enqueueSnackbar } from 'notistack';
import ProtectedRoute from '@/components/protected-route';
import MainLayout from '@/components/main-layout';
import { apiService } from '@/services/api';
import type { ApiKeyInfo, ApiKeyAdd, ApiKeyUpdate, ApiKeyCreated } from '@/types/api';


export default function ApiKeysPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(10);
  
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [successDialogOpen, setSuccessDialogOpen] = useState(false);
  const [currentKey, setCurrentKey] = useState<ApiKeyInfo | null>(null);
  const [newKey, setNewKey] = useState<ApiKeyCreated | null>(null);
  const [formData, setFormData] = useState<ApiKeyAdd & ApiKeyUpdate>({
    name: '',
    allowed_projects: undefined
  });

  // 获取项目列表用于权限选择
  const { data: projectsData } = useQuery({
    queryKey: ['projects', 1, 100],
    queryFn: () => apiService.getProjects({ page: 1, size: 100 }),
  });

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['apiKeys', page, search],
    queryFn: () => apiService.getApiKeys({
      page,
      size: pageSize,
      keyword: search || undefined,
      order_by: 'created_at',
      direction: 'desc'
    }),
  });

  const createMutation = useMutation({
    mutationFn: (data: ApiKeyAdd) => apiService.createApiKey(data),
    onSuccess: (result) => {
      if (result.status === 1 && result.data) {
        setNewKey(result.data);
        setSuccessDialogOpen(true);
        setCreateDialogOpen(false);
        setFormData({ name: '', allowed_projects: undefined });
        queryClient.invalidateQueries({ queryKey: ['apiKeys'] });
      } else {
        enqueueSnackbar(result.msg || '创建失败', { variant: 'error' });
      }
    },
    onError: () => {
      enqueueSnackbar('创建失败', { variant: 'error' });
    }
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: ApiKeyUpdate }) => 
      apiService.updateApiKey(id, data),
    onSuccess: (result) => {
      if (result.status === 1) {
        enqueueSnackbar('更新成功', { variant: 'success' });
        setEditDialogOpen(false);
        setCurrentKey(null);
        queryClient.invalidateQueries({ queryKey: ['apiKeys'] });
      } else {
        enqueueSnackbar(result.msg || '更新失败', { variant: 'error' });
      }
    },
    onError: () => {
      enqueueSnackbar('更新失败', { variant: 'error' });
    }
  });

  const toggleActiveMutation = useMutation({
    mutationFn: ({ id, isActive }: { id: number; isActive: boolean }) => 
      apiService.updateApiKey(id, { is_active: isActive }),
    onSuccess: (result) => {
      if (result.status === 1) {
        enqueueSnackbar('状态更新成功', { variant: 'success' });
        queryClient.invalidateQueries({ queryKey: ['apiKeys'] });
      } else {
        enqueueSnackbar(result.msg || '状态更新失败', { variant: 'error' });
      }
    },
    onError: () => {
      enqueueSnackbar('状态更新失败', { variant: 'error' });
    }
  });

  const deleteMutation = useMutation({
    mutationFn: (ids: number[]) => apiService.deleteApiKeys(ids),
    onSuccess: (result) => {
      if (result.status === 1) {
        enqueueSnackbar('删除成功', { variant: 'success' });
        setDeleteDialogOpen(false);
        setSelectedIds([]);
        queryClient.invalidateQueries({ queryKey: ['apiKeys'] });
      } else {
        enqueueSnackbar(result.msg || '删除失败', { variant: 'error' });
      }
    },
    onError: () => {
      enqueueSnackbar('删除失败', { variant: 'error' });
    }
  });

  const regenerateMutation = useMutation({
    mutationFn: (id: number) => apiService.regenerateApiKey(id),
    onSuccess: (result) => {
      if (result.status === 1 && result.data) {
        setNewKey(result.data);
        setSuccessDialogOpen(true);
        queryClient.invalidateQueries({ queryKey: ['apiKeys'] });
      } else {
        enqueueSnackbar(result.msg || '重新生成失败', { variant: 'error' });
      }
    },
    onError: () => {
      enqueueSnackbar('重新生成失败', { variant: 'error' });
    }
  });

  const handleCreate = () => {
    if (!formData.name) {
      enqueueSnackbar('请输入 API Key 名称', { variant: 'warning' });
      return;
    }
    createMutation.mutate(formData as ApiKeyAdd);
  };

  const handleEdit = () => {
    if (!currentKey) return;
    updateMutation.mutate({ 
      id: currentKey.id, 
      data: formData as ApiKeyUpdate 
    });
  };

  const handleDelete = () => {
    if (selectedIds.length === 0) return;
    deleteMutation.mutate(selectedIds);
  };

  const handleRegenerate = (id: number) => {
    regenerateMutation.mutate(id);
  };

  const handleCopyKey = async (key: string) => {
    try {
      await navigator.clipboard.writeText(key);
      enqueueSnackbar('已复制到剪贴板', { variant: 'success' });
    } catch (err) {
      enqueueSnackbar('复制失败，请手动复制', { variant: 'error' });
    }
  };

  const openEditDialog = (key: ApiKeyInfo) => {
    setCurrentKey(key);
    setFormData({
      name: key.token_name,
      allowed_projects: key.allowed_projects,
      is_active: key.is_active
    });
    setEditDialogOpen(true);
  };

  const toggleSelect = (id: number) => {
    setSelectedIds(prev => 
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  const toggleSelectAll = () => {
    if (!data?.data) return;
    if (selectedIds.length === data.data.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(data.data.map(k => k.id));
    }
  };

  return (
    <ProtectedRoute>
      <MainLayout>
        <Container maxWidth="lg">
          <Box sx={{ mb: 4 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
              <Typography variant="h4" component="h1">
                API Key 管理
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
                <Button
                  variant="contained"
                  startIcon={<Add />}
                  onClick={() => setCreateDialogOpen(true)}
                >
                  生成 API Key
                </Button>
              </Box>
            </Box>

            <Box sx={{ mb: 3 }}>
              <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', bgcolor: 'background.paper', p: 1, borderRadius: 1, border: 1, borderColor: 'divider' }}>
                <input
                  style={{ 
                    flex: 1, 
                    border: 'none', 
                    outline: 'none', 
                    fontSize: '1rem',
                    background: 'transparent'
                  }}
                  placeholder="搜索 API Key..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
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
                      <TableCell padding="checkbox">
                        <Checkbox
                          checked={selectedIds.length === data?.data?.length && data?.data?.length > 0}
                          indeterminate={selectedIds.length > 0 && selectedIds.length < (data?.data?.length || 0)}
                          onChange={toggleSelectAll}
                        />
                      </TableCell>
                      <TableCell>名称</TableCell>
                      <TableCell>前缀</TableCell>
                      <TableCell>权限</TableCell>
                      <TableCell>创建者</TableCell>
                      <TableCell>状态</TableCell>
                      <TableCell align="right">操作</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {data?.data?.map((key) => (
                      <TableRow key={key.id}>
                        <TableCell padding="checkbox">
                          <Checkbox
                            checked={selectedIds.includes(key.id)}
                            onChange={() => toggleSelect(key.id)}
                          />
                        </TableCell>
                        <TableCell>
                          <Box sx={{ fontWeight: 500 }}>{key.token_name}</Box>
                        </TableCell>
                        <TableCell>
                          {key.token_prefix ? (
                            <Chip label={key.token_prefix} size="small" variant="outlined" />
                          ) : '-'}
                        </TableCell>
                        <TableCell>
                          {key.allowed_projects ? (
                            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                              {key.allowed_projects.map((project, idx) => (
                                <Chip key={idx} label={project} size="small" />
                              ))}
                            </Box>
                          ) : (
                            <Chip label="全部权限" color="primary" size="small" />
                          )}
                        </TableCell>
                        <TableCell>
                          {key.created_by_name || '-'}
                        </TableCell>
                        <TableCell>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <Chip
                              label={key.is_active ? '启用' : '禁用'}
                              color={key.is_active ? 'success' : 'default'}
                              size="small"
                            />
                            <Tooltip title={key.is_active ? '点击禁用' : '点击启用'}>
                              <IconButton
                                size="small"
                                onClick={() => toggleActiveMutation.mutate({ id: key.id, isActive: !key.is_active })}
                                disabled={toggleActiveMutation.isPending}
                                color={key.is_active ? 'default' : 'primary'}
                              >
                                {key.is_active ? <ToggleOff /> : <ToggleOn />}
                              </IconButton>
                            </Tooltip>
                          </Box>
                        </TableCell>
                        <TableCell align="right">
                          <Tooltip title="重新生成">
                            <IconButton
                              size="small"
                              onClick={() => handleRegenerate(key.id)}
                            >
                              <RestartAlt />
                            </IconButton>
                          </Tooltip>
                          <Tooltip title="编辑">
                            <IconButton
                              size="small"
                              onClick={() => openEditDialog(key)}
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
            )}

            {!isLoading && data?.data?.length === 0 && (
              <Alert severity="info" sx={{ mt: 2 }}>
                暂无 API Key，请点击上方按钮生成
              </Alert>
            )}
          </Box>
        </Container>

        {/* 创建对话框 */}
        <Dialog open={createDialogOpen} onClose={() => setCreateDialogOpen(false)} maxWidth="sm" fullWidth>
          <DialogTitle>生成 API Key</DialogTitle>
          <DialogContent>
            <Box sx={{ pt: 1, display: 'flex', flexDirection: 'column', gap: 2 }}>
              <TextField
                label="API Key 名称"
                fullWidth
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              />
              <TextField
                label="允许的项目（留空表示全部权限，多个项目用逗号分隔）"
                fullWidth
                multiline
                rows={3}
                value={formData.allowed_projects?.join(',') || ''}
                onChange={(e) => {
                  const value = e.target.value;
                  const projects = value ? value.split(',').map(p => p.trim()).filter(p => p) : undefined;
                  setFormData({ ...formData, allowed_projects: projects });
                }}
                placeholder="project1, project2, project3"
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
              {createMutation.isPending ? <CircularProgress size={20} /> : '生成'}
            </Button>
          </DialogActions>
        </Dialog>

        {/* 编辑对话框 */}
        <Dialog open={editDialogOpen} onClose={() => setEditDialogOpen(false)} maxWidth="sm" fullWidth>
          <DialogTitle>编辑 API Key</DialogTitle>
          <DialogContent>
            <Box sx={{ pt: 1, display: 'flex', flexDirection: 'column', gap: 2 }}>
              <TextField
                label="API Key 名称"
                fullWidth
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              />
              <TextField
                label="允许的项目（留空表示全部权限，多个项目用逗号分隔）"
                fullWidth
                multiline
                rows={3}
                value={formData.allowed_projects?.join(',') || ''}
                onChange={(e) => {
                  const value = e.target.value;
                  const projects = value ? value.split(',').map(p => p.trim()).filter(p => p) : undefined;
                  setFormData({ ...formData, allowed_projects: projects });
                }}
                placeholder="project1, project2, project3"
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
              确定要删除选中的 {selectedIds.length} 个 API Key 吗？此操作不可恢复。
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

        {/* 成功对话框 */}
        <Dialog open={successDialogOpen} onClose={() => setSuccessDialogOpen(false)} maxWidth="sm" fullWidth>
          <DialogTitle>API Key 生成成功！</DialogTitle>
          <DialogContent>
            <Alert severity="warning" sx={{ mb: 2 }}>
              请复制此 Key 并妥善保存，它将不会再次显示！
            </Alert>
            <Box sx={{ 
              bgcolor: (theme) => theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.08)' : 'grey.100', 
              p: 2, 
              borderRadius: 1, 
              fontFamily: 'monospace', 
              display: 'flex', 
              alignItems: 'center', 
              gap: 2,
              border: 1,
              borderColor: 'divider'
            }}>
              <Box sx={{ flex: 1, wordBreak: 'break-all' }}>
                {newKey?.key}
              </Box>
              <Tooltip title="复制到剪贴板">
                <IconButton onClick={() => newKey && handleCopyKey(newKey.key)} size="small">
                  <ContentCopy />
                </IconButton>
              </Tooltip>
            </Box>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
              前缀：{newKey?.prefix}
            </Typography>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => newKey && handleCopyKey(newKey.key)}>
              复制
            </Button>
            <Button onClick={() => setSuccessDialogOpen(false)} variant="contained">
              关闭
            </Button>
          </DialogActions>
        </Dialog>
      </MainLayout>
    </ProtectedRoute>
  );
}
