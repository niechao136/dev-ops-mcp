'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Box, Container, CircularProgress, Alert, Divider, Tabs, Tab } from '@mui/material';
import { enqueueSnackbar } from 'notistack';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import ProtectedRoute from '@/components/protected-route';
import MainLayout from '@/components/main-layout';
import { useProject } from '@/hooks/use-project';
import { useTaskExecution } from '@/hooks/use-task-execution';
import { ProjectInfo } from '@/components/project-info';
import { CommandTable } from '@/components/command-table';
import { CommandDialog } from '@/components/command-dialog';
import { DeleteDialog } from '@/components/delete-dialog';
import { ExecuteDialog } from '@/components/execute-dialog';
import { ImportDialog } from '@/components/import-dialog';
import { TerminalPanel } from '@/components/terminal-panel';
import { AutomationTable } from '@/components/automation-table';
import { AutomationDialog } from '@/components/automation-dialog';
import { apiService } from '@/services/api';
import type { AutomationInfo, AutomationAdd, AutomationUpdate } from '@/types/api';

export default function ProjectDetailPage() {
  const params = useParams();
  const router = useRouter();
  const projectId = parseInt(params.id as string);
  const [isCancelling, setIsCancelling] = useState(false);
  const [terminalOpen, setTerminalOpen] = useState(false);
  const [activeTab, setActiveTab] = useState(0);
  const [automationPage, setAutomationPage] = useState(1);
  const [automationPageSize, setAutomationPageSize] = useState(10);
  const [automationCreateDialogOpen, setAutomationCreateDialogOpen] = useState(false);
  const [automationEditDialogOpen, setAutomationEditDialogOpen] = useState(false);
  const [automationDeleteDialogOpen, setAutomationDeleteDialogOpen] = useState(false);
  const [currentAutomation, setCurrentAutomation] = useState<AutomationInfo | null>(null);
  const [automationToDelete, setAutomationToDelete] = useState<number | null>(null);
  const queryClient = useQueryClient();

  const {
    project,
    projectLoading,
    commands = [],
    commandsLoading,
    totalCommands,
    publicCommands = [],
    refetch,
    refetchProject,
    page,
    pageSize,
    setPage,
    setPageSize,
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
    handleToggleHealthCheck,
    openEditDialog,
    resetForm,
    createMutation,
    updateMutation,
    deleteMutation,
    importMutation,
    batchImportMutation
  } = useProject(projectId);

  const {
    data: automationData,
    isLoading: automationLoading,
    refetch: refetchAutomations
  } = useQuery({
    queryKey: ['automations', projectId, automationPage, automationPageSize],
    queryFn: () => apiService.getProjectAutomations(projectId, {
      page: automationPage,
      size: automationPageSize
    })
  });

  const automations = automationData?.data || [];
  const totalAutomations = automationData?.total || 0;

  const createAutomationMutation = useMutation({
    mutationFn: (data: AutomationAdd) => apiService.createAutomation(data),
    onSuccess: () => {
      enqueueSnackbar('自动化规则创建成功', { variant: 'success' });
      queryClient.invalidateQueries({ queryKey: ['automations', projectId] });
    },
    onError: () => {
      enqueueSnackbar('创建失败', { variant: 'error' });
    }
  });

  const updateAutomationMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: AutomationUpdate }) => apiService.updateAutomation(id, data),
    onSuccess: () => {
      enqueueSnackbar('自动化规则更新成功', { variant: 'success' });
      queryClient.invalidateQueries({ queryKey: ['automations', projectId] });
    },
    onError: () => {
      enqueueSnackbar('更新失败', { variant: 'error' });
    }
  });

  const deleteAutomationMutation = useMutation({
    mutationFn: (id: number) => apiService.deleteAutomation(id),
    onSuccess: () => {
      enqueueSnackbar('自动化规则删除成功', { variant: 'success' });
      queryClient.invalidateQueries({ queryKey: ['automations', projectId] });
    },
    onError: () => {
      enqueueSnackbar('删除失败', { variant: 'error' });
    }
  });

  const toggleAutomationMutation = useMutation({
    mutationFn: (id: number) => apiService.toggleAutomation(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['automations', projectId] });
    },
    onError: () => {
      enqueueSnackbar('操作失败', { variant: 'error' });
    }
  });

  const handleCreateAutomation = (data: AutomationAdd | AutomationUpdate) => {
    createAutomationMutation.mutate(data as AutomationAdd);
  };

  const handleEditAutomation = (data: AutomationAdd | AutomationUpdate) => {
    if (currentAutomation) {
      updateAutomationMutation.mutate({ id: currentAutomation.id, data: data as AutomationUpdate });
    }
  };

  const handleDeleteAutomation = () => {
    if (automationToDelete) {
      deleteAutomationMutation.mutate(automationToDelete);
    }
  };

  const handleToggleAutomationEnabled = (id: number) => {
    toggleAutomationMutation.mutate(id);
  };

  const handleOpenAutomationCreateDialog = () => {
    setCurrentAutomation(null);
    setAutomationCreateDialogOpen(true);
  };

  const handleOpenAutomationEditDialog = (automation: AutomationInfo) => {
    setCurrentAutomation(automation);
    setAutomationEditDialogOpen(true);
  };

  const handleOpenAutomationDeleteDialog = (id: number) => {
    setAutomationToDelete(id);
    setAutomationDeleteDialogOpen(true);
  };

  const {
    executeDialogOpen,
    setExecuteDialogOpen,
    currentCommand: executeCurrentCommand,
    executeParams,
    updateExecuteParams,
    taskId,
    taskStatus,
    taskLog,
    isSubmitting,
    isTaskRunning,
    logContainerRef,
    openExecuteDialog,
    handleExecute,
    handleCancelTask
  } = useTaskExecution();

  useEffect(() => {
    if (!project?.running_task) return;

    const interval = setInterval(() => {
      refetchProject();
    }, 3000);

    return () => clearInterval(interval);
  }, [project?.running_task, refetchProject]);

  const handleCancelRunningTask = useCallback(async (taskId: string) => {
    if (!taskId) return;
    setIsCancelling(true);
    try {
      const result = await apiService.cancelTask(taskId);
      if (result.status === 1) {
        enqueueSnackbar('任务已停止', { variant: 'success' });
        refetch();
      } else {
        enqueueSnackbar(result.msg || '停止失败', { variant: 'error' });
      }
    } catch (error) {
      enqueueSnackbar('停止失败', { variant: 'error' });
    } finally {
      setIsCancelling(false);
    }
  }, [refetch]);

  const handleOpenCreateDialog = () => {
    resetForm();
    setCreateDialogOpen(true);
  };

  const handleOpenDeleteDialog = (commandId: number) => {
    setCommandToDelete(commandId);
    setDeleteDialogOpen(true);
  };

  const handleOpenImportDialog = () => {
    setImportSearch('');
    setImportDialogOpen(true);
  };

  if (projectLoading) {
    return (
      <ProtectedRoute>
        <MainLayout>
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
            <CircularProgress />
          </Box>
        </MainLayout>
      </ProtectedRoute>
    );
  }

  if (!project) {
    return (
      <ProtectedRoute>
        <MainLayout>
          <Container maxWidth="lg">
            <Alert severity="error">项目不存在</Alert>
          </Container>
        </MainLayout>
      </ProtectedRoute>
    );
  }

  return (
    <ProtectedRoute>
      <MainLayout>
        <Container maxWidth="lg">
          <Box sx={{ mb: 4 }}>
            <ProjectInfo
              project={project}
              onBack={() => router.back()}
              onCancelRunningTask={handleCancelRunningTask}
              isCancelling={isCancelling}
              onOpenTerminal={() => setTerminalOpen(true)}
            />

            <Divider sx={{ mb: 4 }} />

            <Tabs
              value={activeTab}
              onChange={(_, newValue) => setActiveTab(newValue)}
              sx={{ mb: 4 }}
            >
              <Tab label="命令管理" />
              <Tab label="自动化规则" />
            </Tabs>

            {activeTab === 0 && (
              <CommandTable
                commands={commands}
                isLoading={commandsLoading}
                total={totalCommands}
                page={page}
                pageSize={pageSize}
                onPageChange={setPage}
                onPageSizeChange={setPageSize}
                onRefresh={refetch}
                onOpenExecuteDialog={openExecuteDialog}
                onOpenEditDialog={openEditDialog}
                onOpenDeleteDialog={handleOpenDeleteDialog}
                onOpenImportDialog={handleOpenImportDialog}
                onOpenCreateDialog={handleOpenCreateDialog}
                onToggleHealthCheck={handleToggleHealthCheck}
              />
            )}

            {activeTab === 1 && (
              <AutomationTable
                automations={automations}
                isLoading={automationLoading}
                total={totalAutomations}
                page={automationPage}
                pageSize={automationPageSize}
                onPageChange={setAutomationPage}
                onPageSizeChange={setAutomationPageSize}
                onRefresh={refetchAutomations}
                onOpenCreateDialog={handleOpenAutomationCreateDialog}
                onOpenEditDialog={handleOpenAutomationEditDialog}
                onOpenDeleteDialog={handleOpenAutomationDeleteDialog}
                onToggleEnabled={handleToggleAutomationEnabled}
              />
            )}
          </Box>
        </Container>

        <CommandDialog
          open={createDialogOpen}
          onClose={() => setCreateDialogOpen(false)}
          title="新建命令"
          formData={formData}
          defaultParamsText={defaultParamsText}
          onFormDataChange={setFormData}
          onDefaultParamsTextChange={setDefaultParamsText}
          onSubmit={handleCreate}
          isSubmitting={createMutation.isPending}
          submitText="创建"
        />

        <CommandDialog
          open={editDialogOpen}
          onClose={() => {
            setEditDialogOpen(false);
            setCurrentCommand(null);
          }}
          title="编辑命令"
          formData={formData}
          defaultParamsText={defaultParamsText}
          onFormDataChange={setFormData}
          onDefaultParamsTextChange={setDefaultParamsText}
          onSubmit={handleEdit}
          isSubmitting={updateMutation.isPending}
          submitText="保存"
        />

        <DeleteDialog
          open={deleteDialogOpen}
          onClose={() => setDeleteDialogOpen(false)}
          onDelete={handleDelete}
          isDeleting={deleteMutation.isPending}
        />

        <ExecuteDialog
          open={executeDialogOpen}
          onClose={() => setExecuteDialogOpen(false)}
          project={project}
          currentCommand={executeCurrentCommand}
          executeParams={executeParams}
          onExecuteParamsChange={updateExecuteParams}
          taskId={taskId}
          taskStatus={taskStatus}
          taskLog={taskLog}
          isSubmitting={isSubmitting}
          isTaskRunning={isTaskRunning}
          logContainerRef={logContainerRef}
          onExecute={handleExecute}
          onCancelTask={handleCancelTask}
        />

        <ImportDialog
          open={importDialogOpen}
          onClose={() => setImportDialogOpen(false)}
          search={importSearch}
          onSearchChange={setImportSearch}
          publicCommands={publicCommands}
          onImport={(id) => importMutation.mutate(id)}
          onBatchImport={(ids) => batchImportMutation.mutate(ids)}
          isImporting={importMutation.isPending || batchImportMutation.isPending}
        />

        <TerminalPanel
          projectId={projectId}
          workDir={project?.work_dir || '/'}
          open={terminalOpen}
          onClose={() => setTerminalOpen(false)}
        />

        <AutomationDialog
          open={automationCreateDialogOpen}
          onClose={() => setAutomationCreateDialogOpen(false)}
          onSave={handleCreateAutomation}
          projectId={projectId}
          commands={commands}
        />

        <AutomationDialog
          open={automationEditDialogOpen}
          onClose={() => {
            setAutomationEditDialogOpen(false);
            setCurrentAutomation(null);
          }}
          onSave={handleEditAutomation}
          projectId={projectId}
          commands={commands}
          automation={currentAutomation}
        />

        <DeleteDialog
          open={automationDeleteDialogOpen}
          onClose={() => setAutomationDeleteDialogOpen(false)}
          onDelete={handleDeleteAutomation}
          isDeleting={deleteAutomationMutation.isPending}
        />
      </MainLayout>
    </ProtectedRoute>
  );
}
