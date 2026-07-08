import { useState, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { enqueueSnackbar } from 'notistack';
import { apiService } from '@/services/api';
import type { ProjectInfo, CommandInfo, CommandAdd, CommandUpdate, PublicCommandInfo } from '@/types/api';

export function useProject(projectId: number) {
  const queryClient = useQueryClient();

  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [currentCommand, setCurrentCommand] = useState<CommandInfo | null>(null);
  const [commandToDelete, setCommandToDelete] = useState<number | null>(null);
  const [formData, setFormData] = useState<CommandAdd | CommandUpdate>({
    project_id: projectId,
    action_type: '',
    description: '',
    shell_command: '',
    timeout: 600,
    default_params: undefined
  });
  const [defaultParamsText, setDefaultParamsText] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize] = useState(10);
  const [importSearch, setImportSearch] = useState('');

  const { data: projectData, isLoading: projectLoading } = useQuery({
    queryKey: ['project', projectId],
    queryFn: () => apiService.getProject(projectId),
  });

  const { data: commandsData, isLoading: commandsLoading, refetch } = useQuery({
    queryKey: ['commands', projectId, page],
    queryFn: () => apiService.getProjectCommands(projectId, {
      page,
      size: pageSize
    }),
  });

  const { data: publicCommandsData } = useQuery({
    queryKey: ['publicCommands', importSearch],
    queryFn: () => apiService.getPublicCommands({
      page: 1,
      size: 100,
      keyword: importSearch || undefined
    }),
    enabled: importDialogOpen,
  });

  const importMutation = useMutation({
    mutationFn: (publicCommandId: number) => apiService.importPublicCommand({
      public_command_id: publicCommandId,
      project_id: projectId
    }),
    onSuccess: (result) => {
      if (result.status === 1) {
        enqueueSnackbar('导入成功', { variant: 'success' });
        setImportDialogOpen(false);
        queryClient.invalidateQueries({ queryKey: ['commands', projectId] });
      } else {
        enqueueSnackbar(result.msg || '导入失败', { variant: 'error' });
      }
    },
    onError: () => {
      enqueueSnackbar('导入失败', { variant: 'error' });
    }
  });

  const batchImportMutation = useMutation({
    mutationFn: (publicCommandIds: number[]) => apiService.batchImportPublicCommands({
      public_command_ids: publicCommandIds,
      project_id: projectId
    }),
    onSuccess: (result) => {
      if (result.status === 1) {
        enqueueSnackbar(`成功导入 ${result.data?.length || 0} 条命令`, { variant: 'success' });
        setImportDialogOpen(false);
        queryClient.invalidateQueries({ queryKey: ['commands', projectId] });
      } else {
        enqueueSnackbar(result.msg || '批量导入失败', { variant: 'error' });
      }
    },
    onError: () => {
      enqueueSnackbar('批量导入失败', { variant: 'error' });
    }
  });

  const createMutation = useMutation({
    mutationFn: (data: CommandAdd) => apiService.createCommand(data),
    onSuccess: (result) => {
      if (result.status === 1) {
        enqueueSnackbar('命令创建成功', { variant: 'success' });
        setCreateDialogOpen(false);
        setFormData({
          project_id: projectId,
          action_type: '',
          description: '',
          shell_command: '',
          timeout: 600,
          default_params: undefined
        });
        setDefaultParamsText('');
        queryClient.invalidateQueries({ queryKey: ['commands', projectId] });
      } else {
        enqueueSnackbar(result.msg || '创建失败', { variant: 'error' });
      }
    },
    onError: () => {
      enqueueSnackbar('创建失败', { variant: 'error' });
    }
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: CommandUpdate }) =>
      apiService.updateCommand(id, data),
    onSuccess: (result) => {
      if (result.status === 1) {
        enqueueSnackbar('命令更新成功', { variant: 'success' });
        setEditDialogOpen(false);
        setCurrentCommand(null);
        queryClient.invalidateQueries({ queryKey: ['commands', projectId] });
      } else {
        enqueueSnackbar(result.msg || '更新失败', { variant: 'error' });
      }
    },
    onError: () => {
      enqueueSnackbar('更新失败', { variant: 'error' });
    }
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => apiService.deleteCommands([id]),
    onSuccess: (result) => {
      if (result.status === 1) {
        enqueueSnackbar('删除成功', { variant: 'success' });
        setDeleteDialogOpen(false);
        setCommandToDelete(null);
        queryClient.invalidateQueries({ queryKey: ['commands', projectId] });
      } else {
        enqueueSnackbar(result.msg || '删除失败', { variant: 'error' });
      }
    },
    onError: () => {
      enqueueSnackbar('删除失败', { variant: 'error' });
    }
  });

  const handleCreate = useCallback(() => {
    if (!formData.action_type || !formData.shell_command) {
      enqueueSnackbar('请填写必填项', { variant: 'warning' });
      return;
    }

    let parsedDefaultParams: Record<string, any> | null = null;
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
      project_id: projectId,
      default_params: parsedDefaultParams
    } as CommandAdd);
  }, [formData, defaultParamsText, projectId, createMutation]);

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
        ...formData,
        default_params: parsedDefaultParams
      }
    });
  }, [currentCommand, formData, defaultParamsText, updateMutation]);

  const handleDelete = useCallback(() => {
    if (commandToDelete === null) return;
    deleteMutation.mutate(commandToDelete);
  }, [commandToDelete, deleteMutation]);

  const openEditDialog = useCallback((command: CommandInfo) => {
    setCurrentCommand(command);
    const defaultParams = command.default_params !== null && command.default_params !== undefined ? command.default_params : undefined;
    setFormData({
      action_type: command.action_type,
      description: command.description,
      shell_command: command.shell_command,
      timeout: command.timeout,
      default_params: defaultParams
    });
    setDefaultParamsText(defaultParams ? JSON.stringify(defaultParams, null, 2) : '');
    setEditDialogOpen(true);
  }, []);

  const resetForm = useCallback(() => {
    setFormData({
      project_id: projectId,
      action_type: '',
      description: '',
      shell_command: '',
      timeout: 600,
      default_params: undefined
    });
    setDefaultParamsText('');
  }, [projectId]);

  return {
    project: projectData?.data as ProjectInfo | undefined,
    projectLoading,
    commands: commandsData?.data as CommandInfo[] | undefined,
    commandsLoading,
    totalCommands: commandsData?.total || 0,
    publicCommands: publicCommandsData?.data as PublicCommandInfo[] | undefined,
    refetch,
    page,
    pageSize,
    setPage,
    importSearch,
    setImportSearch,
    createDialogOpen,
    setCreateDialogOpen,
    editDialogOpen,
    setEditDialogOpen,
    deleteDialogOpen,
    setDeleteDialogOpen,
    importDialogOpen,
    setImportDialogOpen,
    currentCommand,
    setCurrentCommand,
    commandToDelete,
    setCommandToDelete,
    formData,
    setFormData,
    defaultParamsText,
    setDefaultParamsText,
    handleCreate,
    handleEdit,
    handleDelete,
    openEditDialog,
    resetForm,
    createMutation,
    updateMutation,
    deleteMutation,
    importMutation,
    batchImportMutation
  };
}
