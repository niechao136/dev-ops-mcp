import { Box, Button, Chip, Dialog, DialogActions, DialogContent, DialogTitle, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Paper, TextField, Tooltip, Typography } from '@mui/material';
import { Download } from '@mui/icons-material';
import type { PublicCommandInfo } from '@/types/api';

interface ImportDialogProps {
  open: boolean;
  onClose: () => void;
  search: string;
  onSearchChange: (search: string) => void;
  publicCommands: PublicCommandInfo[];
  onImport: (commandId: number) => void;
  isImporting: boolean;
}

export function ImportDialog({
  open,
  onClose,
  search,
  onSearchChange,
  publicCommands,
  onImport,
  isImporting
}: ImportDialogProps) {
  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
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
                  <TableCell>名称</TableCell>
                  <TableCell>操作类型</TableCell>
                  <TableCell>描述</TableCell>
                  <TableCell align="right">操作</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {publicCommands.map((cmd) => (
                  <TableRow key={cmd.id}>
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
                    <TableCell colSpan={4} align="center">
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
        <Button onClick={onClose}>关闭</Button>
      </DialogActions>
    </Dialog>
  );
}