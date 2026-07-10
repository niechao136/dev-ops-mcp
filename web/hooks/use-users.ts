import { useState, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { enqueueSnackbar } from 'notistack';
import { apiService } from '@/services/api';
import type { UserInfo, UserAdd, UserUpdate, UserPassword } from '@/types/api';

export function useUsers() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

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
    queryKey: ['users', page, pageSize, search],
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

  const handleCreate = useCallback(() => {
    if (!formData.username || !formData.password) {
      enqueueSnackbar('请填写必填项', { variant: 'warning' });
      return;
    }
    createMutation.mutate(formData);
  }, [formData, createMutation]);

  const handleEdit = useCallback(() => {
    if (!currentUser) return;
    updateMutation.mutate({
      id: currentUser.id,
      data: {
        username: formData.username,
        email: formData.email,
        role: formData.role
      }
    });
  }, [currentUser, formData, updateMutation]);

  const handlePassword = useCallback(() => {
    if (!currentUser || !passwordData.password) {
      enqueueSnackbar('请填写新密码', { variant: 'warning' });
      return;
    }
    passwordMutation.mutate({ id: currentUser.id, data: passwordData });
  }, [currentUser, passwordData, passwordMutation]);

  const handleDelete = useCallback(() => {
    if (selectedIds.length === 0) return;
    deleteMutation.mutate(selectedIds);
  }, [selectedIds, deleteMutation]);

  const openEditDialog = useCallback((user: UserInfo) => {
    setCurrentUser(user);
    setFormData({
      username: user.username,
      email: user.email,
      password: '',
      role: user.role
    });
    setEditDialogOpen(true);
  }, []);

  const openPasswordDialog = useCallback((user: UserInfo) => {
    setCurrentUser(user);
    setPasswordData({ password: '' });
    setPasswordDialogOpen(true);
  }, []);

  const toggleSelect = useCallback((id: number) => {
    setSelectedIds(prev =>
      prev.includes(id)
        ? prev.filter(item => item !== id)
        : [...prev, id]
    );
  }, []);

  const toggleSelectAll = useCallback(() => {
    if (!data?.data) return;
    const allIds = data.data.map(item => item.id);
    const allSelected = selectedIds.length === allIds.length;
    setSelectedIds(allSelected ? [] : allIds);
  }, [data?.data, selectedIds.length]);

  const formatDate = useCallback((dateString: string) => {
    return new Date(dateString).toLocaleString('zh-CN');
  }, []);

  return {
    users: data?.data as UserInfo[] | undefined,
    total: data?.total || 0,
    isLoading,
    refetch,
    search,
    setSearch,
    selectedIds,
    setSelectedIds,
    page,
    setPage,
    pageSize,
    setPageSize,
    createDialogOpen,
    setCreateDialogOpen,
    editDialogOpen,
    setEditDialogOpen,
    deleteDialogOpen,
    setDeleteDialogOpen,
    passwordDialogOpen,
    setPasswordDialogOpen,
    currentUser,
    setCurrentUser,
    formData,
    setFormData,
    passwordData,
    setPasswordData,
    handleCreate,
    handleEdit,
    handlePassword,
    handleDelete,
    openEditDialog,
    openPasswordDialog,
    toggleSelect,
    toggleSelectAll,
    formatDate,
    createMutation,
    updateMutation,
    toggleStatusMutation,
    passwordMutation,
    deleteMutation
  };
}
