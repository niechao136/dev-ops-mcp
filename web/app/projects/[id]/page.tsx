'use client';

import { useParams, useRouter } from 'next/navigation';
import { Box, Container, CircularProgress, Alert, Divider } from '@mui/material';
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

export default function ProjectDetailPage() {
  const params = useParams();
  const router = useRouter();
  const projectId = parseInt(params.id as string);

  const {
    project,
    projectLoading,
    commands = [],
    commandsLoading,
    totalCommands,
    publicCommands = [],
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
    importMutation
  } = useProject(projectId);

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
            <ProjectInfo project={project} onBack={() => router.back()} />

            <Divider sx={{ mb: 4 }} />

            <CommandTable
              commands={commands}
              isLoading={commandsLoading}
              total={totalCommands}
              page={page}
              pageSize={pageSize}
              onPageChange={setPage}
              onRefresh={refetch}
              onOpenExecuteDialog={openExecuteDialog}
              onOpenEditDialog={openEditDialog}
              onOpenDeleteDialog={handleOpenDeleteDialog}
              onOpenImportDialog={handleOpenImportDialog}
              onOpenCreateDialog={handleOpenCreateDialog}
            />
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
          isImporting={importMutation.isPending}
        />
      </MainLayout>
    </ProtectedRoute>
  );
}
