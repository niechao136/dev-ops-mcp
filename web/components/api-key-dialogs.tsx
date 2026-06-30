'use client';

import {
  Box,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  CircularProgress,
  IconButton,
  Tooltip,
  Alert,
  Typography
} from '@mui/material';
import { ContentCopy } from '@mui/icons-material';
import type { ApiKeyInfo, ApiKeyAdd, ApiKeyUpdate, ApiKeyCreated } from '@/types/api';

interface ApiKeyDialogsProps {
  createDialogOpen: boolean;
  editDialogOpen: boolean;
  deleteDialogOpen: boolean;
  successDialogOpen: boolean;
  currentKey: ApiKeyInfo | null;
  newKey: ApiKeyCreated | null;
  formData: ApiKeyAdd & ApiKeyUpdate;
  selectedIds: number[];
  onCreate: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onCopyKey: (key: string) => void;
  onCloseCreate: () => void;
  onCloseEdit: () => void;
  onCloseDelete: () => void;
  onCloseSuccess: () => void;
  onChangeFormData: (data: ApiKeyAdd & ApiKeyUpdate) => void;
  createMutation: { isPending: boolean };
  updateMutation: { isPending: boolean };
  deleteMutation: { isPending: boolean };
}

export default function ApiKeyDialogs({
  createDialogOpen,
  editDialogOpen,
  deleteDialogOpen,
  successDialogOpen,
  currentKey,
  newKey,
  formData,
  selectedIds,
  onCreate,
  onEdit,
  onDelete,
  onCopyKey,
  onCloseCreate,
  onCloseEdit,
  onCloseDelete,
  onCloseSuccess,
  onChangeFormData,
  createMutation,
  updateMutation,
  deleteMutation
}: ApiKeyDialogsProps) {
  const handleAllowedProjectsChange = (value: string) => {
    const projects = value ? value.split(',').map(p => p.trim()).filter(p => p) : undefined;
    onChangeFormData({ ...formData, allowed_projects: projects });
  };

  return (
    <>
      <Dialog open={createDialogOpen} onClose={onCloseCreate} maxWidth="sm" fullWidth>
        <DialogTitle>生成 API Key</DialogTitle>
        <DialogContent>
          <Box sx={{ pt: 1, display: 'flex', flexDirection: 'column', gap: 2 }}>
            <TextField
              label="API Key 名称"
              fullWidth
              value={formData.name}
              onChange={(e) => onChangeFormData({ ...formData, name: e.target.value })}
            />
            <TextField
              label="允许的项目（留空表示全部权限，多个项目用逗号分隔）"
              fullWidth
              multiline
              rows={3}
              value={formData.allowed_projects?.join(',') || ''}
              onChange={(e) => handleAllowedProjectsChange(e.target.value)}
              placeholder="project1, project2, project3"
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={onCloseCreate}>取消</Button>
          <Button
            onClick={onCreate}
            variant="contained"
            disabled={createMutation.isPending}
          >
            {createMutation.isPending ? <CircularProgress size={20} /> : '生成'}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={editDialogOpen} onClose={onCloseEdit} maxWidth="sm" fullWidth>
        <DialogTitle>编辑 API Key</DialogTitle>
        <DialogContent>
          <Box sx={{ pt: 1, display: 'flex', flexDirection: 'column', gap: 2 }}>
            <TextField
              label="API Key 名称"
              fullWidth
              value={formData.name}
              onChange={(e) => onChangeFormData({ ...formData, name: e.target.value })}
            />
            <TextField
              label="允许的项目（留空表示全部权限，多个项目用逗号分隔）"
              fullWidth
              multiline
              rows={3}
              value={formData.allowed_projects?.join(',') || ''}
              onChange={(e) => handleAllowedProjectsChange(e.target.value)}
              placeholder="project1, project2, project3"
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={onCloseEdit}>取消</Button>
          <Button
            onClick={onEdit}
            variant="contained"
            disabled={updateMutation.isPending}
          >
            {updateMutation.isPending ? <CircularProgress size={20} /> : '保存'}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={deleteDialogOpen} onClose={onCloseDelete}>
        <DialogTitle>确认删除</DialogTitle>
        <DialogContent>
          <Typography>
            确定要删除选中的 {selectedIds.length} 个 API Key 吗？此操作不可恢复。
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={onCloseDelete}>取消</Button>
          <Button
            onClick={onDelete}
            color="error"
            variant="contained"
            disabled={deleteMutation.isPending}
          >
            {deleteMutation.isPending ? <CircularProgress size={20} /> : '删除'}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={successDialogOpen} onClose={onCloseSuccess} maxWidth="sm" fullWidth>
        <DialogTitle>API Key 生成成功！</DialogTitle>
        <DialogContent>
          <Alert severity="warning" sx={{ mb: 2 }}>
            请复制此 Key 并妥善保存，它将不会再次显示！
          </Alert>
          <Box sx={{
            bgcolor: (theme) => theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.08)' : 'grey.100',
            p: 2,
            borderRadius: 1,
            fontFamily: 'monospace',
            display: 'flex',
            alignItems: 'center',
            gap: 2,
            border: 1,
            borderColor: 'divider'
          }}>
            <Box sx={{ flex: 1, wordBreak: 'break-all' }}>
              {newKey?.key}
            </Box>
            <Tooltip title="复制到剪贴板">
              <IconButton onClick={() => newKey && onCopyKey(newKey.key)} size="small">
                <ContentCopy />
              </IconButton>
            </Tooltip>
          </Box>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
            前缀：{newKey?.prefix}
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => newKey && onCopyKey(newKey.key)}>
            复制
          </Button>
          <Button onClick={onCloseSuccess} variant="contained">
            关闭
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}