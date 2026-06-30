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
  Chip,
  IconButton,
  Tooltip,
  CircularProgress,
  Alert,
  TablePagination,
  Typography
} from '@mui/material';
import {
  Edit,
  Delete,
  ContentCopy,
  LocalOffer
} from '@mui/icons-material';
import type { PublicCommandInfo } from '@/types/api';

interface PublicCommandTableProps {
  commands: PublicCommandInfo[] | undefined;
  total: number;
  isLoading: boolean;
  page: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  onCopy: (command: string) => void;
  onEdit: (command: PublicCommandInfo) => void;
  onDelete: (command: PublicCommandInfo) => void;
}

export default function PublicCommandTable({
  commands,
  total,
  isLoading,
  page,
  pageSize,
  onPageChange,
  onCopy,
  onEdit,
  onDelete
}: PublicCommandTableProps) {
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
              <TableCell>名称</TableCell>
              <TableCell>操作类型</TableCell>
              <TableCell>描述</TableCell>
              <TableCell>标签</TableCell>
              <TableCell>超时(秒)</TableCell>
              <TableCell align="right">操作</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {commands?.map((command) => (
              <TableRow key={command.id}>
                <TableCell>{command.name}</TableCell>
                <TableCell>
                  <Chip label={command.action_type} size="small" color="primary" />
                </TableCell>
                <TableCell>
                  <Tooltip title={command.description || ''}>
                    <Typography variant="body2" sx={{
                      maxWidth: 200,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap'
                    }}>
                      {command.description || '-'}
                    </Typography>
                  </Tooltip>
                </TableCell>
                <TableCell>
                  {command.tags ? (
                    <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
                      {command.tags.split(',').filter(t => t.trim()).map((tag, i) => (
                        <Chip
                          key={i}
                          label={tag.trim()}
                          size="small"
                          icon={<LocalOffer />}
                          sx={{ fontSize: '0.75rem' }}
                        />
                      ))}
                    </Box>
                  ) : '-'}
                </TableCell>
                <TableCell>{command.timeout}</TableCell>
                <TableCell align="right">
                  <Tooltip title="复制命令">
                    <IconButton
                      size="small"
                      onClick={() => onCopy(command.shell_command)}
                    >
                      <ContentCopy />
                    </IconButton>
                  </Tooltip>
                  <Tooltip title="编辑">
                    <IconButton
                      size="small"
                      onClick={() => onEdit(command)}
                    >
                      <Edit />
                    </IconButton>
                  </Tooltip>
                  <Tooltip title="删除">
                    <IconButton
                      size="small"
                      color="error"
                      onClick={() => onDelete(command)}
                    >
                      <Delete />
                    </IconButton>
                  </Tooltip>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>

      {!isLoading && commands?.length === 0 && (
        <Alert severity="info" sx={{ mt: 2 }}>
          暂无公共命令，请点击上方按钮创建
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