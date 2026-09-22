'use client';

import {
  Box,
  Button,
  Container,
  Typography,
  IconButton,
} from '@mui/material';
import {
  Refresh,
  Delete,
} from '@mui/icons-material';
import ProtectedRoute from '@/components/protected-route';
import MainLayout from '@/components/main-layout';
import AuditLogTable from '@/components/audit-log-table';
import AuditLogDialogs from '@/components/audit-log-dialogs';
import { useAuditLogs } from '@/hooks/use-audit-logs';

export default function AuditLogsPage() {
  const {
    logs,
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
    filters,
    updateFilters,
    projects,
    deleteDialogOpen,
    setDeleteDialogOpen,
    detailDialogOpen,
    setDetailDialogOpen,
    currentLog,
    handleDelete,
    openDetailDialog,
    toggleSelect,
    toggleSelectAll,
    formatDate,
    getActorTypeLabel,
    getStatusColor,
    getStatusLabel,
    deleteMutation
  } = useAuditLogs();

  return (
    <ProtectedRoute>
      <MainLayout>
        <Container maxWidth="xl">
          <Box sx={{ mb: 4 }}>
            <Box sx={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: 1.5, mb: 3 }}>
              <Typography variant="h4" component="h1" sx={{ fontSize: { xs: '1.5rem', md: '2.125rem' } }}>
                操作日志
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
              </Box>
            </Box>

            <AuditLogDialogs
              deleteDialogOpen={deleteDialogOpen}
              detailDialogOpen={detailDialogOpen}
              currentLog={currentLog}
              selectedIds={selectedIds}
              search={search}
              filters={filters}
              projects={projects}
              onDelete={handleDelete}
              onCloseDelete={() => setDeleteDialogOpen(false)}
              onCloseDetail={() => setDetailDialogOpen(false)}
              onChangeSearch={setSearch}
              onUpdateFilters={updateFilters}
              formatDate={formatDate}
              getActorTypeLabel={getActorTypeLabel}
              getStatusColor={getStatusColor}
              getStatusLabel={getStatusLabel}
              deleteMutation={deleteMutation}
            />

            <AuditLogTable
              logs={logs}
              total={total}
              isLoading={isLoading}
              selectedIds={selectedIds}
              page={page}
              pageSize={pageSize}
              onPageChange={setPage}
              onPageSizeChange={setPageSize}
              onToggleSelect={toggleSelect}
              onToggleSelectAll={toggleSelectAll}
              onViewDetail={openDetailDialog}
              onDelete={handleDelete}
              formatDate={formatDate}
              getActorTypeLabel={getActorTypeLabel}
              getStatusColor={getStatusColor}
              getStatusLabel={getStatusLabel}
            />
          </Box>
        </Container>
      </MainLayout>
    </ProtectedRoute>
  );
}
