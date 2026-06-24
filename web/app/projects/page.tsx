'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Box,
  Button,
  Card,
  CardContent,
  Container,
  Chip,
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
  TablePagination
} from '@mui/material';
import {
  Add,
  Edit,
  Delete,
  Visibility,
  Search,
  Refresh,
  ToggleOff,
  ToggleOn
} from '@mui/icons-material';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { enqueueSnackbar } from 'notistack';
import ProtectedRoute from '@/components/protected-route';
import MainLayout from '@/components/main-layout';
import { apiService } from '@/services/api';
import type { ProjectInfo, ProjectAdd, ProjectUpdate } from '@/types/api';


export default function ProjectsPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(10);

  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [currentProject, setCurrentProject] = useState<ProjectInfo | null>(null);
  const [formData, setFormData] = useState<ProjectAdd | ProjectUpdate>({
    name: '',
    description: '',
    work_dir: ''
  });


  const { data, isLoading, refetch } = useQuery({
    queryKey: ['projects', page, search],
    queryFn: () => apiService.getProjects({
      page,
      size: pageSize,
      keyword: search || undefined,
      order_by: 'name',
      direction: 'asc'
    }),
  });


  const createMutation = useMutation({
    mutationFn: (data: ProjectAdd) => apiService.createProject(data),
    onSuccess: (result) => {
      if (result.status === 1) {
        enqueueSnackbar('项目创建成功', { variant: 'success' });
        setCreateDialogOpen(false);
        setFormData({ name: '', description: '', work_dir: '' });
        queryClient.invalidateQueries({ queryKey: ['projects'] });
      } else {
        enqueueSnackbar(result.msg || '创建失败', { variant: 'error' });
      }
    },
    onError: () => {
      enqueueSnackbar('创建失败', { variant: 'error' });
    }
  });


  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: ProjectUpdate }) =>
      apiService.updateProject(id, data),
    onSuccess: (result) => {
      if (result.status === 1) {
        enqueueSnackbar('项目更新成功', { variant: 'success' });
        setEditDialogOpen(false);
        setCurrentProject(null);
        queryClient.invalidateQueries({ queryKey: ['projects'] });
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
      apiService.updateProject(id, { is_active: isActive }),
    onSuccess: (result) => {
      if (result.status === 1) {
        enqueueSnackbar('状态更新成功', { variant: 'success' });
        queryClient.invalidateQueries({ queryKey: ['projects'] });
      } else {
        enqueueSnackbar(result.msg || '状态更新失败', { variant: 'error' });
      }
    },
    onError: () => {
      enqueueSnackbar('状态更新失败', { variant: 'error' });
    }
  });


  const deleteMutation = useMutation({
    mutationFn: (ids: number[]) => apiService.deleteProjects(ids),
    onSuccess: (result) => {
      if (result.status === 1) {
        enqueueSnackbar('删除成功', { variant: 'success' });
        setDeleteDialogOpen(false);
        setSelectedIds([]);
        queryClient.invalidateQueries({ queryKey: ['projects'] });
      } else {
        enqueueSnackbar(result.msg || '删除失败', { variant: 'error' });
      }
    },
    onError: () => {
      enqueueSnackbar('删除失败', { variant: 'error' });
    }
  });


  const handleCreate = () => {
    if (!formData.name || !formData.work_dir) {
      enqueueSnackbar('请填写必填项', { variant: 'warning' });
      return;
    }
    createMutation.mutate(formData as ProjectAdd);
  };


  const handleEdit = () => {
    if (!currentProject) return;
    updateMutation.mutate({
      id: currentProject.id,
      data: formData as ProjectUpdate
    });
  };


  const handleDelete = () => {
    if (selectedIds.length === 0) return;
    deleteMutation.mutate(selectedIds);
  };


  const openEditDialog = (project: ProjectInfo) => {
    setCurrentProject(project);
    setFormData({
      name: project.name,
      description: project.description,
      work_dir: project.work_dir,
      is_active: project.is_active
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
      setSelectedIds(data.data.map(p => p.id));
    }
  };


  return (
    <ProtectedRoute>
      <MainLayout>
        <Container maxWidth="lg">
          <Box sx={{ mb: 4 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
              <Typography variant="h4" component="h1">
                项目管理
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
                  新建项目
                </Button>
              </Box>
            </Box>

            <Box sx={{ mb: 3 }}>
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
                  placeholder="搜索项目..."
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
                      <TableCell>项目名称</TableCell>
                      <TableCell>工作目录</TableCell>
                      <TableCell>命令数</TableCell>
                      <TableCell>状态</TableCell>
                      <TableCell align="right">操作</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {data?.data?.map((project) => (
                      <TableRow key={project.id}>
                        <TableCell padding="checkbox">
                          <Checkbox
                            checked={selectedIds.includes(project.id)}
                            onChange={() => toggleSelect(project.id)}
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
                                onClick={() => toggleActiveMutation.mutate({ id: project.id, isActive: !project.is_active })}
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
                              onClick={() => router.push(`/projects/${project.id}`)}
                            >
                              <Visibility />
                            </IconButton>
                          </Tooltip>
                          <Tooltip title="编辑">
                            <IconButton
                              size="small"
                              onClick={() => openEditDialog(project)}
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
                暂无项目，请点击上方按钮创建
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
        <Dialog open={createDialogOpen} onClose={() => setCreateDialogOpen(false)} maxWidth="sm" fullWidth>
          <DialogTitle>新建项目</DialogTitle>
          <DialogContent>
            <Box sx={{ pt: 1, display: 'flex', flexDirection: 'column', gap: 2 }}>
              <TextField
                label="项目名称"
                fullWidth
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              />
              <TextField
                label="工作目录"
                fullWidth
                value={formData.work_dir}
                onChange={(e) => setFormData({ ...formData, work_dir: e.target.value })}
                placeholder="/path/to/project"
              />
              <TextField
                label="描述"
                fullWidth
                multiline
                rows={3}
                value={formData.description || ''}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
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
        <Dialog open={editDialogOpen} onClose={() => setEditDialogOpen(false)} maxWidth="sm" fullWidth>
          <DialogTitle>编辑项目</DialogTitle>
          <DialogContent>
            <Box sx={{ pt: 1, display: 'flex', flexDirection: 'column', gap: 2 }}>
              <TextField
                label="项目名称"
                fullWidth
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              />
              <TextField
                label="工作目录"
                fullWidth
                value={formData.work_dir}
                onChange={(e) => setFormData({ ...formData, work_dir: e.target.value })}
              />
              <TextField
                label="描述"
                fullWidth
                multiline
                rows={3}
                value={formData.description || ''}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
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
              确定要删除选中的 {selectedIds.length} 个项目吗？此操作不可恢复。
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
