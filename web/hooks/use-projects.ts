import { useState, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { enqueueSnackbar } from 'notistack';
import { apiService } from '@/services/api';
import type { ProjectInfo, ProjectAdd, ProjectUpdate } from '@/types/api';

export function useProjects() {
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

  const handleCreate = useCallback(() => {
    if (!formData.name || !formData.work_dir) {
      enqueueSnackbar('请填写必填项', { variant: 'warning' });
      return;
    }
    createMutation.mutate(formData as ProjectAdd);
  }, [formData, createMutation]);

  const handleEdit = useCallback(() => {
    if (!currentProject) return;
    updateMutation.mutate({
      id: currentProject.id,
      data: formData as ProjectUpdate
    });
  }, [currentProject, formData, updateMutation]);

  const handleDelete = useCallback(() => {
    if (selectedIds.length === 0) return;
    deleteMutation.mutate(selectedIds);
  }, [selectedIds, deleteMutation]);

  const openEditDialog = useCallback((project: ProjectInfo) => {
    setCurrentProject(project);
    setFormData({
      name: project.name,
      description: project.description,
      work_dir: project.work_dir,
      is_active: project.is_active
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
      setSelectedIds(data.data.map(p => p.id));
    }
  }, [data?.data, selectedIds.length]);

  return {
    projects: data?.data as ProjectInfo[] | undefined,
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
    createDialogOpen,
    setCreateDialogOpen,
    editDialogOpen,
    setEditDialogOpen,
    deleteDialogOpen,
    setDeleteDialogOpen,
    currentProject,
    setCurrentProject,
    formData,
    setFormData,
    handleCreate,
    handleEdit,
    handleDelete,
    openEditDialog,
    toggleSelect,
    toggleSelectAll,
    createMutation,
    updateMutation,
    toggleActiveMutation,
    deleteMutation
  };
}