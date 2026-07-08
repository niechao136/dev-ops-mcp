import { useState, useCallback, useEffect } from 'react';
import { Box, Button, Checkbox, Chip, Dialog, DialogActions, DialogContent, DialogTitle, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Paper, TextField, Tooltip, Typography } from '@mui/material';
import { Download } from '@mui/icons-material';
import type { PublicCommandInfo } from '@/types/api';

interface ImportDialogProps {
  open: boolean;
  onClose: () => void;
  search: string;
  onSearchChange: (search: string) => void;
  publicCommands: PublicCommandInfo[];
  onImport: (commandId: number) => void;
  onBatchImport: (commandIds: number[]) => void;
  isImporting: boolean;
}

export function ImportDialog({
  open,
  onClose,
  search,
  onSearchChange,
  publicCommands,
  onImport,
  onBatchImport,
  isImporting
}: ImportDialogProps) {
  const [selectedIds, setSelectedIds] = useState<number[]>([]);

  const handleSelect = useCallback((id: number) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );
  }, []);

  const handleSelectAll = useCallback(() => {
    if (selectedIds.length === publicCommands.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(publicCommands.map((cmd) => cmd.id));
    }
  }, [selectedIds.length, publicCommands]);

  const handleBatchImport = useCallback(() => {
    if (selectedIds.length > 0) {
      onBatchImport(selectedIds);
    }
  }, [selectedIds, onBatchImport]);

  const handleClose = useCallback(() => {
    setSelectedIds([]);
    onClose();
  }, [onClose]);

  useEffect(() => {
    if (!open) {
      setSelectedIds([]);
    }
  }, [open]);

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="md" fullWidth>
      <DialogTitle>导入公共命令</DialogTitle>
      <DialogContent>
        <Box sx={{ pt: 1 }}>
          <TextField
            label="搜索公共命令"
            fullWidth
            size="small"
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="搜索名称、描述、操作类型..."
            sx={{ mb: 2 }}
          />
          <TableContainer component={Paper} sx={{ maxHeight: 400 }}>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell padding="checkbox">
                    <Checkbox
                      checked={selectedIds.length === publicCommands.length && publicCommands.length > 0}
                      indeterminate={selectedIds.length > 0 && selectedIds.length < publicCommands.length}
                      onChange={handleSelectAll}
                      disabled={isImporting}
                    />
                  </TableCell>
                  <TableCell>名称</TableCell>
                  <TableCell>操作类型</TableCell>
                  <TableCell>描述</TableCell>
                  <TableCell align="right">操作</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {publicCommands.map((cmd) => (
                  <TableRow key={cmd.id}>
                    <TableCell padding="checkbox">
                      <Checkbox
                        checked={selectedIds.includes(cmd.id)}
                        onChange={() => handleSelect(cmd.id)}
                        disabled={isImporting}
                      />
                    </TableCell>
                    <TableCell>{cmd.name}</TableCell>
                    <TableCell>
                      <Chip label={cmd.action_type} size="small" color="primary" />
                    </TableCell>
                    <TableCell>
                      <Tooltip title={cmd.description || ''}>
                        <Typography variant="body2" sx={{
                          maxWidth: 200,
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap'
                        }}>
                          {cmd.description || '-'}
                        </Typography>
                      </Tooltip>
                    </TableCell>
                    <TableCell align="right">
                      <Button
                        size="small"
                        variant="contained"
                        startIcon={<Download />}
                        onClick={() => onImport(cmd.id)}
                        disabled={isImporting}
                      >
                        导入
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
                {publicCommands.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={5} align="center">
                      <Typography color="text.secondary" sx={{ py: 2 }}>
                        暂无公共命令
                      </Typography>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </TableContainer>
        </Box>
      </DialogContent>
      <DialogActions>
        {selectedIds.length > 0 && (
          <Button
            variant="contained"
            startIcon={<Download />}
            onClick={handleBatchImport}
            disabled={isImporting}
          >
            批量导入 ({selectedIds.length})
          </Button>
        )}
        <Button onClick={handleClose}>关闭</Button>
      </DialogActions>
    </Dialog>
  );
}
