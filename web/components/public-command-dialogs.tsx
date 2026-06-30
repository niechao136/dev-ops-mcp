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
import type { PublicCommandInfo, PublicCommandAdd, PublicCommandUpdate } from '@/types/api';

interface PublicCommandDialogsProps {
  createDialogOpen: boolean;
  editDialogOpen: boolean;
  deleteDialogOpen: boolean;
  currentCommand: PublicCommandInfo | null;
  formData: PublicCommandAdd;
  defaultParamsText: string;
  onCreate: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onCloseCreate: () => void;
  onCloseEdit: () => void;
  onCloseDelete: () => void;
  onChangeFormData: (data: PublicCommandAdd) => void;
  onChangeDefaultParamsText: (text: string) => void;
  onResetForm: () => void;
  createMutation: { isPending: boolean };
  updateMutation: { isPending: boolean };
  deleteMutation: { isPending: boolean };
}

export default function PublicCommandDialogs({
  createDialogOpen,
  editDialogOpen,
  deleteDialogOpen,
  currentCommand,
  formData,
  defaultParamsText,
  onCreate,
  onEdit,
  onDelete,
  onCloseCreate,
  onCloseEdit,
  onCloseDelete,
  onChangeFormData,
  onChangeDefaultParamsText,
  onResetForm,
  createMutation,
  updateMutation,
  deleteMutation
}: PublicCommandDialogsProps) {
  return (
    <>
      <Dialog open={createDialogOpen} onClose={onCloseCreate} maxWidth="md" fullWidth>
        <DialogTitle>新建公共命令</DialogTitle>
        <DialogContent>
          <Box sx={{ pt: 1, display: 'flex', flexDirection: 'column', gap: 2 }}>
            <TextField
              label="命令名称"
              fullWidth
              value={formData.name}
              onChange={(e) => onChangeFormData({ ...formData, name: e.target.value })}
              placeholder="如：Git 拉取代码"
            />
            <TextField
              label="操作类型"
              fullWidth
              value={formData.action_type}
              onChange={(e) => onChangeFormData({ ...formData, action_type: e.target.value })}
              placeholder="git_pull, docker_build, deploy 等"
            />
            <TextField
              label="描述"
              fullWidth
              value={formData.description}
              onChange={(e) => onChangeFormData({ ...formData, description: e.target.value })}
            />
            <TextField
              label="标签"
              fullWidth
              value={formData.tags}
              onChange={(e) => onChangeFormData({ ...formData, tags: e.target.value })}
              placeholder="多个标签用逗号分隔，如：git,docker,部署"
              helperText="用于分类和筛选公共命令"
            />
            <TextField
              label="超时时间(秒)"
              fullWidth
              type="number"
              value={formData.timeout}
              onChange={(e) => onChangeFormData({ ...formData, timeout: parseInt(e.target.value) || 600 })}
            />
            <TextField
              label="默认参数 (JSON格式)"
              fullWidth
              multiline
              rows={4}
              value={defaultParamsText}
              onChange={(e) => onChangeDefaultParamsText(e.target.value)}
              placeholder='{"version": "v1.0.0", "env": "production"}'
              helperText="使用 JSON 格式设置可选参数的默认值"
              sx={{
                '& .MuiInputBase-input': {
                  fontFamily: 'monospace'
                }
              }}
            />
            <TextField
              label="Shell命令"
              fullWidth
              multiline
              rows={6}
              value={formData.shell_command}
              onChange={(e) => onChangeFormData({ ...formData, shell_command: e.target.value })}
              placeholder="输入要执行的Shell命令"
              sx={{
                '& .MuiInputBase-input': {
                  fontFamily: 'monospace'
                }
              }}
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

      <Dialog open={editDialogOpen} onClose={onCloseEdit} maxWidth="md" fullWidth>
        <DialogTitle>编辑公共命令</DialogTitle>
        <DialogContent>
          <Box sx={{ pt: 1, display: 'flex', flexDirection: 'column', gap: 2 }}>
            <TextField
              label="命令名称"
              fullWidth
              value={formData.name}
              onChange={(e) => onChangeFormData({ ...formData, name: e.target.value })}
            />
            <TextField
              label="操作类型"
              fullWidth
              value={formData.action_type}
              onChange={(e) => onChangeFormData({ ...formData, action_type: e.target.value })}
            />
            <TextField
              label="描述"
              fullWidth
              value={formData.description}
              onChange={(e) => onChangeFormData({ ...formData, description: e.target.value })}
            />
            <TextField
              label="标签"
              fullWidth
              value={formData.tags}
              onChange={(e) => onChangeFormData({ ...formData, tags: e.target.value })}
              placeholder="多个标签用逗号分隔"
            />
            <TextField
              label="超时时间(秒)"
              fullWidth
              type="number"
              value={formData.timeout}
              onChange={(e) => onChangeFormData({ ...formData, timeout: parseInt(e.target.value) || 600 })}
            />
            <TextField
              label="默认参数 (JSON格式)"
              fullWidth
              multiline
              rows={4}
              value={defaultParamsText}
              onChange={(e) => onChangeDefaultParamsText(e.target.value)}
              sx={{
                '& .MuiInputBase-input': {
                  fontFamily: 'monospace'
                }
              }}
            />
            <TextField
              label="Shell命令"
              fullWidth
              multiline
              rows={6}
              value={formData.shell_command}
              onChange={(e) => onChangeFormData({ ...formData, shell_command: e.target.value })}
              sx={{
                '& .MuiInputBase-input': {
                  fontFamily: 'monospace'
                }
              }}
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
            确定要删除公共命令"{currentCommand?.name}"吗？此操作不可恢复。
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