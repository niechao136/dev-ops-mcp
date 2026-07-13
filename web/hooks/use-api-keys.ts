import { useState, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { enqueueSnackbar } from 'notistack';
import { apiService } from '@/services/api';
import type { ApiKeyInfo, ApiKeyAdd, ApiKeyUpdate, ApiKeyCreated } from '@/types/api';
import { copyToClipboard } from '@/utils/string';

export function useApiKeys() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

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

  const { data: projectsData } = useQuery({
    queryKey: ['projects', 1, 100],
    queryFn: () => apiService.getProjects({ page: 1, size: 100 }),
  });

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['apiKeys', page, pageSize, search],
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

  const handleCopyKey = useCallback(async (key: string) => {
    const success = await copyToClipboard(key);
    if (success) {
      enqueueSnackbar('已复制到剪贴板', { variant: 'success' });
    } else {
      enqueueSnackbar('复制失败，请手动复制', { variant: 'error' });
    }
  }, []);

  const handleCopyApiKey = useCallback(async (id: number) => {
    try {
      const result = await apiService.getFullApiKey(id);
      if (result.status === 1 && result.data) {
        await handleCopyKey(result.data);
      } else {
        enqueueSnackbar(result.msg || '获取密钥失败', { variant: 'error' });
      }
    } catch (error) {
      enqueueSnackbar('获取密钥失败', { variant: 'error' });
    }
  }, [handleCopyKey]);

  const handleCreate = useCallback(() => {
    if (!formData.name) {
      enqueueSnackbar('请输入 API Key 名称', { variant: 'warning' });
      return;
    }
    createMutation.mutate(formData as ApiKeyAdd);
  }, [formData, createMutation]);

  const handleEdit = useCallback(() => {
    if (!currentKey) return;
    updateMutation.mutate({
      id: currentKey.id,
      data: formData as ApiKeyUpdate
    });
  }, [currentKey, formData, updateMutation]);

  const handleDelete = useCallback(() => {
    if (selectedIds.length === 0) return;
    deleteMutation.mutate(selectedIds);
  }, [selectedIds, deleteMutation]);

  const handleRegenerate = useCallback((id: number) => {
    regenerateMutation.mutate(id);
  }, [regenerateMutation]);

  const openEditDialog = useCallback((key: ApiKeyInfo) => {
    setCurrentKey(key);
    setFormData({
      name: key.token_name,
      allowed_projects: key.allowed_projects,
      is_active: key.is_active
    });
    setEditDialogOpen(true);
  }, []);

  const toggleSelect = useCallback((id: number) => {
    setSelectedIds(prev =>
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  }, []);

  const toggleSelectAll = useCallback(() => {
    if (!data?.data) return;
    if (selectedIds.length === data.data.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(data.data.map(k => k.id));
    }
  }, [data?.data, selectedIds.length]);

  return {
    apiKeys: data?.data as ApiKeyInfo[] | undefined,
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
    projects: projectsData?.data as ApiKeyInfo[] | undefined,
    createDialogOpen,
    setCreateDialogOpen,
    editDialogOpen,
    setEditDialogOpen,
    deleteDialogOpen,
    setDeleteDialogOpen,
    successDialogOpen,
    setSuccessDialogOpen,
    currentKey,
    setCurrentKey,
    newKey,
    setNewKey,
    formData,
    setFormData,
    handleCreate,
    handleEdit,
    handleDelete,
    handleRegenerate,
    handleCopyKey,
    handleCopyApiKey,
    openEditDialog,
    toggleSelect,
    toggleSelectAll,
    createMutation,
    updateMutation,
    toggleActiveMutation,
    deleteMutation,
    regenerateMutation
  };
}
