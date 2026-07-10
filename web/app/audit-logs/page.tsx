'use client';

import {
  Box,
  Button,
  Container,
  Typography,
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
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
              <Typography variant="h4" component="h1">
                操作日志
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
