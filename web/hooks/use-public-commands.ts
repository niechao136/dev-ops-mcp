import { useState, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { enqueueSnackbar } from 'notistack';
import { apiService } from '@/services/api';
import type { PublicCommandInfo, PublicCommandAdd, PublicCommandUpdate } from '@/types/api';

export function usePublicCommands() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [currentCommand, setCurrentCommand] = useState<PublicCommandInfo | null>(null);
  const [formData, setFormData] = useState<PublicCommandAdd>({
    name: '',
    action_type: '',
    description: '',
    shell_command: '',
    timeout: 600,
    default_params: undefined,
    tags: ''
  });
  const [defaultParamsText, setDefaultParamsText] = useState('');

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['publicCommands', page, pageSize, search],
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

  const resetForm = useCallback(() => {
    setFormData({
      name: '',
      action_type: '',
      description: '',
      shell_command: '',
      timeout: 600,
      default_params: undefined,
      tags: ''
    });
    setDefaultParamsText('');
  }, []);

  const handleCreate = useCallback(() => {
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
  }, [formData, defaultParamsText, createMutation]);

  const handleEdit = useCallback(() => {
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
  }, [currentCommand, formData, defaultParamsText, updateMutation]);

  const handleDelete = useCallback(() => {
    if (!currentCommand) return;
    deleteMutation.mutate([currentCommand.id]);
  }, [currentCommand, deleteMutation]);

  const openEditDialog = useCallback((command: PublicCommandInfo) => {
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
  }, []);

  const handleCopyCommand = useCallback(async (command: string) => {
    try {
      await navigator.clipboard.writeText(command);
      enqueueSnackbar('命令已复制', { variant: 'success' });
    } catch {
      enqueueSnackbar('复制失败', { variant: 'error' });
    }
  }, []);

  return {
    commands: data?.data as PublicCommandInfo[] | undefined,
    total: data?.total || 0,
    isLoading,
    refetch,
    search,
    setSearch,
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
    currentCommand,
    setCurrentCommand,
    formData,
    setFormData,
    defaultParamsText,
    setDefaultParamsText,
    handleCreate,
    handleEdit,
    handleDelete,
    openEditDialog,
    resetForm,
    handleCopyCommand,
    createMutation,
    updateMutation,
    deleteMutation
  };
}
