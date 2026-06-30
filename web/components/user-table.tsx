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
  TablePagination
} from '@mui/material';
import {
  Edit,
  Delete,
  ToggleOff,
  ToggleOn,
  Key
} from '@mui/icons-material';
import type { UserInfo } from '@/types/api';

interface UserTableProps {
  users: UserInfo[] | undefined;
  total: number;
  isLoading: boolean;
  selectedIds: number[];
  page: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  onToggleSelect: (id: number) => void;
  onToggleSelectAll: () => void;
  onToggleStatus: (id: number) => void;
  onPassword: (user: UserInfo) => void;
  onEdit: (user: UserInfo) => void;
  onDelete: () => void;
  formatDate: (dateString: string) => string;
  toggleStatusMutation: { isPending: boolean };
}

export default function UserTable({
  users,
  total,
  isLoading,
  selectedIds,
  page,
  pageSize,
  onPageChange,
  onToggleSelect,
  onToggleSelectAll,
  onToggleStatus,
  onPassword,
  onEdit,
  formatDate,
  toggleStatusMutation
}: UserTableProps) {
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
                  checked={selectedIds.length === users?.length && users?.length > 0}
                  indeterminate={selectedIds.length > 0 && selectedIds.length < (users?.length || 0)}
                  onChange={onToggleSelectAll}
                />
              </TableCell>
              <TableCell>用户名</TableCell>
              <TableCell>邮箱</TableCell>
              <TableCell>角色</TableCell>
              <TableCell>状态</TableCell>
              <TableCell>创建时间</TableCell>
              <TableCell align="right">操作</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {users?.map((user) => (
              <TableRow key={user.id}>
                <TableCell padding="checkbox">
                  <Checkbox
                    checked={selectedIds.includes(user.id)}
                    onChange={() => onToggleSelect(user.id)}
                  />
                </TableCell>
                <TableCell>
                  <Box sx={{ fontWeight: 500 }}>{user.username}</Box>
                </TableCell>
                <TableCell>{user.email || '-'}</TableCell>
                <TableCell>
                  <Chip
                    label={user.role === 'admin' ? '管理员' : '普通用户'}
                    color={user.role === 'admin' ? 'primary' : 'default'}
                    size="small"
                  />
                </TableCell>
                <TableCell>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Chip
                      label={user.is_active ? '启用' : '禁用'}
                      color={user.is_active ? 'success' : 'default'}
                      size="small"
                    />
                    <Tooltip title={user.is_active ? '点击禁用' : '点击启用'}>
                      <IconButton
                        size="small"
                        onClick={() => onToggleStatus(user.id)}
                        disabled={toggleStatusMutation.isPending}
                        color={user.is_active ? 'default' : 'primary'}
                      >
                        {user.is_active ? <ToggleOff /> : <ToggleOn />}
                      </IconButton>
                    </Tooltip>
                  </Box>
                </TableCell>
                <TableCell>{formatDate(user.created_at)}</TableCell>
                <TableCell align="right">
                  <Tooltip title="修改密码">
                    <IconButton
                      size="small"
                      onClick={() => onPassword(user)}
                    >
                      <Key />
                    </IconButton>
                  </Tooltip>
                  <Tooltip title="编辑">
                    <IconButton
                      size="small"
                      onClick={() => onEdit(user)}
                    >
                      <Edit />
                    </IconButton>
                  </Tooltip>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>

      {!isLoading && users?.length === 0 && (
        <Alert severity="info" sx={{ mt: 2 }}>
          暂无用户，请点击上方按钮创建
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