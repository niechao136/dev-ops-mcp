'use client';

import {
  Box,
  Button,
  Container,
  Typography,
} from '@mui/material';
import {
  Add,
  Delete,
  Refresh,
  Search,
} from '@mui/icons-material';
import ProtectedRoute from '@/components/protected-route';
import MainLayout from '@/components/main-layout';
import UserTable from '@/components/user-table';
import UserDialogs from '@/components/user-dialogs';
import { useUsers } from '@/hooks/use-users';

export default function UsersPage() {
  const {
    users,
    total,
    isLoading,
    refetch,
    search,
    setSearch,
    selectedIds,
    page,
    setPage,
    pageSize,
    createDialogOpen,
    setCreateDialogOpen,
    editDialogOpen,
    setEditDialogOpen,
    deleteDialogOpen,
    setDeleteDialogOpen,
    passwordDialogOpen,
    setPasswordDialogOpen,
    currentUser,
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
  } = useUsers();

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

            <UserTable
              users={users}
              total={total}
              isLoading={isLoading}
              selectedIds={selectedIds}
              page={page}
              pageSize={pageSize}
              onPageChange={setPage}
              onToggleSelect={toggleSelect}
              onToggleSelectAll={toggleSelectAll}
              onToggleStatus={(id) => toggleStatusMutation.mutate(id)}
              onPassword={openPasswordDialog}
              onEdit={openEditDialog}
              onDelete={handleDelete}
              formatDate={formatDate}
              toggleStatusMutation={toggleStatusMutation}
            />
          </Box>
        </Container>

        <UserDialogs
          createDialogOpen={createDialogOpen}
          editDialogOpen={editDialogOpen}
          deleteDialogOpen={deleteDialogOpen}
          passwordDialogOpen={passwordDialogOpen}
          currentUser={currentUser}
          formData={formData}
          passwordData={passwordData}
          selectedIds={selectedIds}
          onCreate={handleCreate}
          onEdit={handleEdit}
          onPassword={handlePassword}
          onDelete={handleDelete}
          onCloseCreate={() => setCreateDialogOpen(false)}
          onCloseEdit={() => setEditDialogOpen(false)}
          onCloseDelete={() => setDeleteDialogOpen(false)}
          onClosePassword={() => setPasswordDialogOpen(false)}
          onChangeFormData={setFormData}
          onChangePasswordData={setPasswordData}
          createMutation={createMutation}
          updateMutation={updateMutation}
          passwordMutation={passwordMutation}
          deleteMutation={deleteMutation}
        />
      </MainLayout>
    </ProtectedRoute>
  );
}