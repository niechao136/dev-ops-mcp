'use client';

import {
  Box,
  Button,
  Container,
  Typography,
  TextField
} from '@mui/material';
import {
  Add,
  Refresh,
} from '@mui/icons-material';
import ProtectedRoute from '@/components/protected-route';
import MainLayout from '@/components/main-layout';
import PublicCommandTable from '@/components/public-command-table';
import PublicCommandDialogs from '@/components/public-command-dialogs';
import { usePublicCommands } from '@/hooks/use-public-commands';

export default function PublicCommandsPage() {
  const {
    commands,
    total,
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
  } = usePublicCommands();

  const handleOpenCreateDialog = () => {
    resetForm();
    setCreateDialogOpen(true);
  };

  const handleDeleteClick = (command: { id: number; name: string }) => {
    setCurrentCommand(command as any);
    setDeleteDialogOpen(true);
  };

  return (
    <ProtectedRoute>
      <MainLayout>
        <Container maxWidth="lg">
          <Box sx={{ mb: 4 }}>
            <Typography variant="h4" component="h1" sx={{ mb: 3 }}>
              公共命令管理
            </Typography>

            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
              <TextField
                placeholder="搜索名称、描述、操作类型..."
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(1);
                }}
                size="small"
                sx={{ width: 300 }}
              />
              <Box sx={{ display: 'flex', gap: 2 }}>
                <Button
                  variant="outlined"
                  startIcon={<Refresh />}
                  onClick={() => refetch()}
                >
                  刷新
                </Button>
                <Button
                  variant="contained"
                  startIcon={<Add />}
                  onClick={handleOpenCreateDialog}
                >
                  新建公共命令
                </Button>
              </Box>
            </Box>

            <PublicCommandTable
              commands={commands}
              total={total}
              isLoading={isLoading}
              page={page}
              pageSize={pageSize}
              onPageChange={setPage}
              onPageSizeChange={setPageSize}
              onCopy={handleCopyCommand}
              onEdit={openEditDialog}
              onDelete={handleDeleteClick}
            />
          </Box>
        </Container>

        <PublicCommandDialogs
          createDialogOpen={createDialogOpen}
          editDialogOpen={editDialogOpen}
          deleteDialogOpen={deleteDialogOpen}
          currentCommand={currentCommand}
          formData={formData}
          defaultParamsText={defaultParamsText}
          onCreate={handleCreate}
          onEdit={handleEdit}
          onDelete={handleDelete}
          onCloseCreate={() => setCreateDialogOpen(false)}
          onCloseEdit={() => setEditDialogOpen(false)}
          onCloseDelete={() => setDeleteDialogOpen(false)}
          onChangeFormData={setFormData}
          onChangeDefaultParamsText={setDefaultParamsText}
          onResetForm={resetForm}
          createMutation={createMutation}
          updateMutation={updateMutation}
          deleteMutation={deleteMutation}
        />
      </MainLayout>
    </ProtectedRoute>
  );
}
