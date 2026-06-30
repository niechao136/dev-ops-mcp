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
  ContentCopy,
  RestartAlt,
  ToggleOff,
  ToggleOn
} from '@mui/icons-material';
import type { ApiKeyInfo } from '@/types/api';

interface ApiKeyTableProps {
  apiKeys: ApiKeyInfo[] | undefined;
  total: number;
  isLoading: boolean;
  selectedIds: number[];
  page: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  onToggleSelect: (id: number) => void;
  onToggleSelectAll: () => void;
  onToggleActive: (id: number, isActive: boolean) => void;
  onCopyApiKey: (id: number) => void;
  onRegenerate: (id: number) => void;
  onEdit: (key: ApiKeyInfo) => void;
  onDelete: () => void;
  toggleActiveMutation: { isPending: boolean };
}

export default function ApiKeyTable({
  apiKeys,
  total,
  isLoading,
  selectedIds,
  page,
  pageSize,
  onPageChange,
  onToggleSelect,
  onToggleSelectAll,
  onToggleActive,
  onCopyApiKey,
  onRegenerate,
  onEdit,
  toggleActiveMutation
}: ApiKeyTableProps) {
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
                  checked={selectedIds.length === apiKeys?.length && apiKeys?.length > 0}
                  indeterminate={selectedIds.length > 0 && selectedIds.length < (apiKeys?.length || 0)}
                  onChange={onToggleSelectAll}
                />
              </TableCell>
              <TableCell>名称</TableCell>
              <TableCell>前缀</TableCell>
              <TableCell>权限</TableCell>
              <TableCell>创建者</TableCell>
              <TableCell>状态</TableCell>
              <TableCell align="right">操作</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {apiKeys?.map((key) => (
              <TableRow key={key.id}>
                <TableCell padding="checkbox">
                  <Checkbox
                    checked={selectedIds.includes(key.id)}
                    onChange={() => onToggleSelect(key.id)}
                  />
                </TableCell>
                <TableCell>
                  <Box sx={{ fontWeight: 500 }}>{key.token_name}</Box>
                </TableCell>
                <TableCell>
                  {key.token_prefix ? (
                    <Chip label={key.token_prefix} size="small" variant="outlined" />
                  ) : '-'}
                </TableCell>
                <TableCell>
                  {key.allowed_projects ? (
                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                      {key.allowed_projects.map((project, idx) => (
                        <Chip key={idx} label={project} size="small" />
                      ))}
                    </Box>
                  ) : (
                    <Chip label="全部权限" color="primary" size="small" />
                  )}
                </TableCell>
                <TableCell>
                  {key.created_by_name || '-'}
                </TableCell>
                <TableCell>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Chip
                      label={key.is_active ? '启用' : '禁用'}
                      color={key.is_active ? 'success' : 'default'}
                      size="small"
                    />
                    <Tooltip title={key.is_active ? '点击禁用' : '点击启用'}>
                      <IconButton
                        size="small"
                        onClick={() => onToggleActive(key.id, !key.is_active)}
                        disabled={toggleActiveMutation.isPending}
                        color={key.is_active ? 'default' : 'primary'}
                      >
                        {key.is_active ? <ToggleOff /> : <ToggleOn />}
                      </IconButton>
                    </Tooltip>
                  </Box>
                </TableCell>
                <TableCell align="right">
                  <Tooltip title="复制密钥">
                    <IconButton
                      size="small"
                      onClick={() => onCopyApiKey(key.id)}
                    >
                      <ContentCopy />
                    </IconButton>
                  </Tooltip>
                  <Tooltip title="重新生成">
                    <IconButton
                      size="small"
                      onClick={() => onRegenerate(key.id)}
                    >
                      <RestartAlt />
                    </IconButton>
                  </Tooltip>
                  <Tooltip title="编辑">
                    <IconButton
                      size="small"
                      onClick={() => onEdit(key)}
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

      {!isLoading && apiKeys?.length === 0 && (
        <Alert severity="info" sx={{ mt: 2 }}>
          暂无 API Key，请点击上方按钮生成
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