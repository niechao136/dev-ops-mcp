'use client';

import {
  Box,
  Button,
  Container,
  Typography,
  IconButton,
} from '@mui/material';
import {
  Add,
  Delete,
  Refresh,
} from '@mui/icons-material';
import ProtectedRoute from '@/components/protected-route';
import MainLayout from '@/components/main-layout';
import ApiKeyTable from '@/components/api-key-table';
import ApiKeyDialogs from '@/components/api-key-dialogs';
import { useApiKeys } from '@/hooks/use-api-keys';

export default function ApiKeysPage() {
  const {
    apiKeys,
    total,
    isLoading,
    refetch,
    search,
    setSearch,
    selectedIds,
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
    successDialogOpen,
    setSuccessDialogOpen,
    currentKey,
    newKey,
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
    deleteMutation
  } = useApiKeys();

  return (
    <ProtectedRoute>
      <MainLayout>
        <Container maxWidth="lg">
          <Box sx={{ mb: 4 }}>
            <Box sx={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: 1.5, mb: 3 }}>
              <Typography variant="h4" component="h1" sx={{ fontSize: { xs: '1.5rem', md: '2.125rem' } }}>
                API Key 管理
              </Typography>
              <Box sx={{ display: 'flex', gap: 1 }}>
                <Button
                  variant="outlined"
                  startIcon={<Refresh />}
                  onClick={() => refetch()}
                  sx={{ display: { xs: 'none', sm: 'inline-flex' } }}
                >
                  刷新
                </Button>
                <IconButton aria-label="刷新" onClick={() => refetch()} sx={{ display: { xs: 'inline-flex', sm: 'none' } }}>
                  <Refresh />
                </IconButton>
                {selectedIds.length > 0 && (
                  <>
                    <Button
                      variant="outlined"
                      color="error"
                      startIcon={<Delete />}
                      onClick={() => setDeleteDialogOpen(true)}
                      sx={{ display: { xs: 'none', sm: 'inline-flex' } }}
                    >
                      删除选中 ({selectedIds.length})
                    </Button>
                    <IconButton
                      aria-label={`删除选中 ${selectedIds.length} 项`}
                      color="error"
                      onClick={() => setDeleteDialogOpen(true)}
                      sx={{ display: { xs: 'inline-flex', sm: 'none' } }}
                    >
                      <Delete />
                    </IconButton>
                  </>
                )}
                <Button
                  variant="contained"
                  startIcon={<Add />}
                  onClick={() => setCreateDialogOpen(true)}
                >
                  生成 API Key
                </Button>
              </Box>
            </Box>

            <Box sx={{ mb: 3 }}>
              <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', bgcolor: 'background.paper', p: 1, borderRadius: 1, border: 1, borderColor: 'divider' }}>
                <input
                  style={{
                    flex: 1,
                    border: 'none',
                    outline: 'none',
                    fontSize: '1rem',
                    background: 'transparent'
                  }}
                  placeholder="搜索 API Key..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </Box>
            </Box>

            <ApiKeyTable
              apiKeys={apiKeys}
              total={total}
              isLoading={isLoading}
              selectedIds={selectedIds}
              page={page}
              pageSize={pageSize}
              onPageChange={setPage}
              onPageSizeChange={setPageSize}
              onToggleSelect={toggleSelect}
              onToggleSelectAll={toggleSelectAll}
              onToggleActive={(id, isActive) => toggleActiveMutation.mutate({ id, isActive })}
              onCopyApiKey={handleCopyApiKey}
              onRegenerate={handleRegenerate}
              onEdit={openEditDialog}
              onDelete={handleDelete}
              toggleActiveMutation={toggleActiveMutation}
            />
          </Box>
        </Container>

        <ApiKeyDialogs
          createDialogOpen={createDialogOpen}
          editDialogOpen={editDialogOpen}
          deleteDialogOpen={deleteDialogOpen}
          successDialogOpen={successDialogOpen}
          currentKey={currentKey}
          newKey={newKey}
          formData={formData}
          selectedIds={selectedIds}
          onCreate={handleCreate}
          onEdit={handleEdit}
          onDelete={handleDelete}
          onCopyKey={handleCopyKey}
          onCloseCreate={() => setCreateDialogOpen(false)}
          onCloseEdit={() => setEditDialogOpen(false)}
          onCloseDelete={() => setDeleteDialogOpen(false)}
          onCloseSuccess={() => setSuccessDialogOpen(false)}
          onChangeFormData={setFormData}
          createMutation={createMutation}
          updateMutation={updateMutation}
          deleteMutation={deleteMutation}
        />
      </MainLayout>
    </ProtectedRoute>
  );
}
