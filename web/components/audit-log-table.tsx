'use client';

import {
  Box,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Checkbox,
  Chip,
  IconButton,
  Tooltip,
  CircularProgress,
  Alert,
  TablePagination,
  Typography
} from '@mui/material';
import {
  Delete,
  Visibility
} from '@mui/icons-material';
import type { AuditLogInfo } from '@/types/api';

interface AuditLogTableProps {
  logs: AuditLogInfo[] | undefined;
  total: number;
  isLoading: boolean;
  selectedIds: number[];
  page: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  onToggleSelect: (id: number) => void;
  onToggleSelectAll: () => void;
  onViewDetail: (log: AuditLogInfo) => void;
  onDelete: () => void;
  formatDate: (dateString: string) => string;
  getActorTypeLabel: (type: string) => string;
  getStatusColor: (status: string) => 'success' | 'error' | 'warning' | 'default';
  getStatusLabel: (status: string) => string;
}

export default function AuditLogTable({
  logs,
  total,
  isLoading,
  selectedIds,
  page,
  pageSize,
  onPageChange,
  onToggleSelect,
  onToggleSelectAll,
  onViewDetail,
  formatDate,
  getActorTypeLabel,
  getStatusColor,
  getStatusLabel
}: AuditLogTableProps) {
  if (isLoading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <>
      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell padding="checkbox">
                <Checkbox
                  checked={selectedIds.length === logs?.length && logs?.length > 0}
                  indeterminate={selectedIds.length > 0 && selectedIds.length < (logs?.length || 0)}
                  onChange={onToggleSelectAll}
                />
              </TableCell>
              <TableCell>ID</TableCell>
              <TableCell>操作者</TableCell>
              <TableCell>操作类型</TableCell>
              <TableCell>目标项目</TableCell>
              <TableCell>状态</TableCell>
              <TableCell>IP 地址</TableCell>
              <TableCell>操作时间</TableCell>
              <TableCell align="right">操作</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {logs?.map((log) => (
              <TableRow key={log.id}>
                <TableCell padding="checkbox">
                  <Checkbox
                    checked={selectedIds.includes(log.id)}
                    onChange={() => onToggleSelect(log.id)}
                  />
                </TableCell>
                <TableCell>{log.id}</TableCell>
                <TableCell>
                  <Box sx={{ display: 'flex', flexDirection: 'column' }}>
                    <Box sx={{ fontWeight: 500 }}>{log.actor_name || '-'}</Box>
                    <Box sx={{ fontSize: '0.8rem', color: 'text.secondary' }}>
                      {getActorTypeLabel(log.actor_type)}
                    </Box>
                  </Box>
                </TableCell>
                <TableCell>{log.action_category}</TableCell>
                <TableCell>{log.target_project || '-'}</TableCell>
                <TableCell>
                  <Chip
                    label={getStatusLabel(log.status)}
                    color={getStatusColor(log.status)}
                    size="small"
                  />
                </TableCell>
                <TableCell>{log.ip_address || '-'}</TableCell>
                <TableCell>{formatDate(log.created_at)}</TableCell>
                <TableCell align="right">
                  <Tooltip title="查看详情">
                    <IconButton
                      size="small"
                      onClick={() => onViewDetail(log)}
                    >
                      <Visibility />
                    </IconButton>
                  </Tooltip>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>

      {!isLoading && logs?.length === 0 && (
        <Alert severity="info" sx={{ mt: 2 }}>
          暂无日志记录
        </Alert>
      )}

      {total > 0 && (
        <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: 2 }}>
          <TablePagination
            component="div"
            count={total}
            page={page - 1}
            onPageChange={(event, newPage) => onPageChange(newPage + 1)}
            rowsPerPage={pageSize}
            rowsPerPageOptions={[10, 25, 50]}
            labelRowsPerPage="每页行数"
            labelDisplayedRows={({ from, to, count }) => `${from}-${to} 共 ${count}`}
          />
        </Box>
      )}
    </>
  );
}