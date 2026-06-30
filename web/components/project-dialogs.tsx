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
  Typography
} from '@mui/material';
import type { ProjectInfo, ProjectAdd, ProjectUpdate } from '@/types/api';

interface ProjectDialogsProps {
  createDialogOpen: boolean;
  editDialogOpen: boolean;
  deleteDialogOpen: boolean;
  currentProject: ProjectInfo | null;
  formData: ProjectAdd | ProjectUpdate;
  selectedIds: number[];
  onCreate: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onCloseCreate: () => void;
  onCloseEdit: () => void;
  onCloseDelete: () => void;
  onChangeFormData: (data: ProjectAdd | ProjectUpdate) => void;
  createMutation: { isPending: boolean };
  updateMutation: { isPending: boolean };
  deleteMutation: { isPending: boolean };
}

export default function ProjectDialogs({
  createDialogOpen,
  editDialogOpen,
  deleteDialogOpen,
  currentProject,
  formData,
  selectedIds,
  onCreate,
  onEdit,
  onDelete,
  onCloseCreate,
  onCloseEdit,
  onCloseDelete,
  onChangeFormData,
  createMutation,
  updateMutation,
  deleteMutation
}: ProjectDialogsProps) {
  return (
    <>
      <Dialog open={createDialogOpen} onClose={onCloseCreate} maxWidth="sm" fullWidth>
        <DialogTitle>新建项目</DialogTitle>
        <DialogContent>
          <Box sx={{ pt: 1, display: 'flex', flexDirection: 'column', gap: 2 }}>
            <TextField
              label="项目名称"
              fullWidth
              value={formData.name}
              onChange={(e) => onChangeFormData({ ...formData, name: e.target.value })}
            />
            <TextField
              label="工作目录"
              fullWidth
              value={formData.work_dir}
              onChange={(e) => onChangeFormData({ ...formData, work_dir: e.target.value })}
              placeholder="/path/to/project"
            />
            <TextField
              label="描述"
              fullWidth
              multiline
              rows={3}
              value={formData.description || ''}
              onChange={(e) => onChangeFormData({ ...formData, description: e.target.value })}
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
            {createMutation.isPending ? <CircularProgress size={20} /> : '创建'}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={editDialogOpen} onClose={onCloseEdit} maxWidth="sm" fullWidth>
        <DialogTitle>编辑项目</DialogTitle>
        <DialogContent>
          <Box sx={{ pt: 1, display: 'flex', flexDirection: 'column', gap: 2 }}>
            <TextField
              label="项目名称"
              fullWidth
              value={formData.name}
              onChange={(e) => onChangeFormData({ ...formData, name: e.target.value })}
            />
            <TextField
              label="工作目录"
              fullWidth
              value={formData.work_dir}
              onChange={(e) => onChangeFormData({ ...formData, work_dir: e.target.value })}
            />
            <TextField
              label="描述"
              fullWidth
              multiline
              rows={3}
              value={formData.description || ''}
              onChange={(e) => onChangeFormData({ ...formData, description: e.target.value })}
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
            确定要删除选中的 {selectedIds.length} 个项目吗？此操作不可恢复。
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
    </>
  );
}