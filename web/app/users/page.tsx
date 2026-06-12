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
  TextField,
  CircularProgress,
  IconButton,
  Tooltip,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Checkbox
} from '@mui/material';
import {
  Add,
  Edit,
  Delete,
  Refresh,
  Search,
  ToggleOff,
  ToggleOn,
  Key
} from '@mui/icons-material';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { enqueueSnackbar } from 'notistack';
import ProtectedRoute from '@/components/protected-route';
import MainLayout from '@/components/main-layout';
import { apiService } from '@/services/api';
import type { UserInfo, UserAdd, UserUpdate, UserPassword } from '@/types/api';


export default function UsersPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(10);
  
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [passwordDialogOpen, setPasswordDialogOpen] = useState(false);
  const [currentUser, setCurrentUser] = useState<UserInfo | null>(null);
  const [formData, setFormData] = useState<UserAdd>({
    username: '',
    password: '',
    role: 'user'
  });
  const [passwordData, setPasswordData] = useState<UserPassword>({
    password: ''
  });


  const { data, isLoading, refetch } = useQuery({
    queryKey: ['users', page, search],
    queryFn: () => apiService.getUsers({
      page,
      size: pageSize,
      keyword: search || undefined,
      order_by: 'username',
      direction: 'asc'
    }),
  });


  const createMutation = useMutation({
    mutationFn: (data: UserAdd) => apiService.createUser(data),
    onSuccess: (result) => {
      if (result.status === 1) {
        enqueueSnackbar('用户创建成功', { variant: 'success' });
        setCreateDialogOpen(false);
        setFormData({ username: '', password: '', role: 'user' });
        queryClient.invalidateQueries({ queryKey: ['users'] });
      } else {
        enqueueSnackbar(result.msg || '创建失败', { variant: 'error' });
      }
    },
    onError: () => {
      enqueueSnackbar('创建失败', { variant: 'error' });
    }
  });


  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: UserUpdate }) => 
      apiService.updateUser(id, data),
    onSuccess: (result) => {
      if (result.status === 1) {
        enqueueSnackbar('用户更新成功', { variant: 'success' });
        setEditDialogOpen(false);
        setCurrentUser(null);
        queryClient.invalidateQueries({ queryKey: ['users'] });
      } else {
        enqueueSnackbar(result.msg || '更新失败', { variant: 'error' });
      }
    },
    onError: () => {
      enqueueSnackbar('更新失败', { variant: 'error' });
    }
  });


  const toggleStatusMutation = useMutation({
    mutationFn: (id: number) => apiService.toggleUserStatus(id),
    onSuccess: (result) => {
      if (result.status === 1) {
        enqueueSnackbar('状态更新成功', { variant: 'success' });
        queryClient.invalidateQueries({ queryKey: ['users'] });
      } else {
        enqueueSnackbar(result.msg || '状态更新失败', { variant: 'error' });
      }
    },
    onError: () => {
      enqueueSnackbar('状态更新失败', { variant: 'error' });
    }
  });


  const passwordMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: UserPassword }) => 
      apiService.changeUserPassword(id, data),
    onSuccess: (result) => {
      if (result.status === 1) {
        enqueueSnackbar('密码修改成功', { variant: 'success' });
        setPasswordDialogOpen(false);
        setCurrentUser(null);
        setPasswordData({ password: '' });
      } else {
        enqueueSnackbar(result.msg || '密码修改失败', { variant: 'error' });
      }
    },
    onError: () => {
      enqueueSnackbar('密码修改失败', { variant: 'error' });
    }
  });


  const deleteMutation = useMutation({
    mutationFn: (ids: number[]) => apiService.deleteUsers(ids),
    onSuccess: (result) => {
      if (result.status === 1) {
        enqueueSnackbar('删除成功', { variant: 'success' });
        setDeleteDialogOpen(false);
        setSelectedIds([]);
        queryClient.invalidateQueries({ queryKey: ['users'] });
      } else {
        enqueueSnackbar(result.msg || '删除失败', { variant: 'error' });
      }
    },
    onError: () => {
      enqueueSnackbar('删除失败', { variant: 'error' });
    }
  });


  const handleCreate = () => {
    if (!formData.username || !formData.password) {
      enqueueSnackbar('请填写必填项', { variant: 'warning' });
      return;
    }
    createMutation.mutate(formData);
  };


  const handleEdit = () => {
    if (!currentUser) return;
    updateMutation.mutate({ 
      id: currentUser.id, 
      data: { 
        username: formData.username, 
        email: formData.email, 
        role: formData.role 
      } 
    });
  };


  const handlePassword = () => {
    if (!currentUser || !passwordData.password) {
      enqueueSnackbar('请填写新密码', { variant: 'warning' });
      return;
    }
    passwordMutation.mutate({ id: currentUser.id, data: passwordData });
  };


  const handleDelete = () => {
    if (selectedIds.length === 0) return;
    deleteMutation.mutate(selectedIds);
  };


  const openEditDialog = (user: UserInfo) => {
    setCurrentUser(user);
    setFormData({
      username: user.username,
      email: user.email,
      password: '',
      role: user.role
    });
    setEditDialogOpen(true);
  };


  const openPasswordDialog = (user: UserInfo) => {
    setCurrentUser(user);
    setPasswordData({ password: '' });
    setPasswordDialogOpen(true);
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


  return (
    <ProtectedRoute>
      <MainLayout>
        <Container maxWidth="lg">
          <Box sx={{ mb: 4 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
              <Typography variant="h4" component="h1">
                用户管理
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
                  新建用户
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
                  placeholder="搜索用户..."
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
                      <TableCell>用户名</TableCell>
                      <TableCell>邮箱</TableCell>
                      <TableCell>角色</TableCell>
                      <TableCell>状态</TableCell>
                      <TableCell>创建时间</TableCell>
                      <TableCell align="right">操作</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {data?.data?.map((user) => (
                      <TableRow key={user.id}>
                        <TableCell padding="checkbox">
                          <Checkbox
                            checked={selectedIds.includes(user.id)}
                            onChange={() => toggleSelect(user.id)}
                          />
                        </TableCell>
                        <TableCell>
                          <Box sx={{ fontWeight: 500 }}>{user.username}</Box>
                        </TableCell>
                        <TableCell>{user.email || '-'}</TableCell>
                        <TableCell>
                          <Chip 
                            label={user.role === 'admin' ? '管理员' : '普通用户'} 
                            color={user.role === 'admin' ? 'primary' : 'default'}
                            size="small"
                          />
                        </TableCell>
                        <TableCell>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <Chip
                              label={user.is_active ? '启用' : '禁用'}
                              color={user.is_active ? 'success' : 'default'}
                              size="small"
                            />
                            <Tooltip title={user.is_active ? '点击禁用' : '点击启用'}>
                              <IconButton
                                size="small"
                                onClick={() => toggleStatusMutation.mutate(user.id)}
                                disabled={toggleStatusMutation.isPending}
                                color={user.is_active ? 'default' : 'primary'}
                              >
                                {user.is_active ? <ToggleOff /> : <ToggleOn />}
                              </IconButton>
                            </Tooltip>
                          </Box>
                        </TableCell>
                        <TableCell>{formatDate(user.created_at)}</TableCell>
                        <TableCell align="right">
                          <Tooltip title="修改密码">
                            <IconButton
                              size="small"
                              onClick={() => openPasswordDialog(user)}
                            >
                              <Key />
                            </IconButton>
                          </Tooltip>
                          <Tooltip title="编辑">
                            <IconButton
                              size="small"
                              onClick={() => openEditDialog(user)}
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
          </Box>

          {/* 创建用户对话框 */}
          <Dialog open={createDialogOpen} onClose={() => setCreateDialogOpen(false)} maxWidth="sm" fullWidth>
            <DialogTitle>新建用户</DialogTitle>
            <DialogContent>
              <Box sx={{ mt: 1 }}>
                <TextField
                  fullWidth
                  label="用户名"
                  value={formData.username}
                  onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                  margin="normal"
                  required
                />
                <TextField
                  fullWidth
                  label="邮箱"
                  type="email"
                  value={formData.email || ''}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  margin="normal"
                />
                <TextField
                  fullWidth
                  label="密码"
                  type="password"
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  margin="normal"
                  required
                />
                <FormControl fullWidth margin="normal">
                  <InputLabel>角色</InputLabel>
                  <Select
                    value={formData.role}
                    label="角色"
                    onChange={(e) => setFormData({ ...formData, role: e.target.value as 'admin' | 'user' })}
                  >
                    <MenuItem value="admin">管理员</MenuItem>
                    <MenuItem value="user">普通用户</MenuItem>
                  </Select>
                </FormControl>
              </Box>
            </DialogContent>
            <DialogActions>
              <Button onClick={() => setCreateDialogOpen(false)}>
                取消
              </Button>
              <Button 
                onClick={handleCreate} 
                variant="contained" 
                disabled={createMutation.isPending}
              >
                {createMutation.isPending ? <CircularProgress size={24} /> : '创建'}
              </Button>
            </DialogActions>
          </Dialog>

          {/* 编辑用户对话框 */}
          <Dialog open={editDialogOpen} onClose={() => setEditDialogOpen(false)} maxWidth="sm" fullWidth>
            <DialogTitle>编辑用户</DialogTitle>
            <DialogContent>
              <Box sx={{ mt: 1 }}>
                <TextField
                  fullWidth
                  label="用户名"
                  value={formData.username}
                  onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                  margin="normal"
                  required
                />
                <TextField
                  fullWidth
                  label="邮箱"
                  type="email"
                  value={formData.email || ''}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  margin="normal"
                />
                <FormControl fullWidth margin="normal">
                  <InputLabel>角色</InputLabel>
                  <Select
                    value={formData.role}
                    label="角色"
                    onChange={(e) => setFormData({ ...formData, role: e.target.value as 'admin' | 'user' })}
                  >
                    <MenuItem value="admin">管理员</MenuItem>
                    <MenuItem value="user">普通用户</MenuItem>
                  </Select>
                </FormControl>
              </Box>
            </DialogContent>
            <DialogActions>
              <Button onClick={() => setEditDialogOpen(false)}>
                取消
              </Button>
              <Button 
                onClick={handleEdit} 
                variant="contained" 
                disabled={updateMutation.isPending}
              >
                {updateMutation.isPending ? <CircularProgress size={24} /> : '更新'}
              </Button>
            </DialogActions>
          </Dialog>

          {/* 修改密码对话框 */}
          <Dialog open={passwordDialogOpen} onClose={() => setPasswordDialogOpen(false)} maxWidth="sm" fullWidth>
            <DialogTitle>修改密码 - {currentUser?.username}</DialogTitle>
            <DialogContent>
              <Box sx={{ mt: 1 }}>
                <TextField
                  fullWidth
                  label="新密码"
                  type="password"
                  value={passwordData.password}
                  onChange={(e) => setPasswordData({ ...passwordData, password: e.target.value })}
                  margin="normal"
                  required
                />
              </Box>
            </DialogContent>
            <DialogActions>
              <Button onClick={() => setPasswordDialogOpen(false)}>
                取消
              </Button>
              <Button 
                onClick={handlePassword} 
                variant="contained" 
                disabled={passwordMutation.isPending}
              >
                {passwordMutation.isPending ? <CircularProgress size={24} /> : '确定'}
              </Button>
            </DialogActions>
          </Dialog>

          {/* 删除确认对话框 */}
          <Dialog open={deleteDialogOpen} onClose={() => setDeleteDialogOpen(false)}>
            <DialogTitle>确认删除</DialogTitle>
            <DialogContent>
              <Typography>
                确定要删除选中的 {selectedIds.length} 个用户吗？此操作不可恢复。
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
