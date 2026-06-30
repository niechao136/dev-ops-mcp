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
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Typography
} from '@mui/material';
import type { UserInfo, UserAdd, UserUpdate, UserPassword } from '@/types/api';

interface UserDialogsProps {
  createDialogOpen: boolean;
  editDialogOpen: boolean;
  deleteDialogOpen: boolean;
  passwordDialogOpen: boolean;
  currentUser: UserInfo | null;
  formData: UserAdd;
  passwordData: UserPassword;
  selectedIds: number[];
  onCreate: () => void;
  onEdit: () => void;
  onPassword: () => void;
  onDelete: () => void;
  onCloseCreate: () => void;
  onCloseEdit: () => void;
  onCloseDelete: () => void;
  onClosePassword: () => void;
  onChangeFormData: (data: UserAdd) => void;
  onChangePasswordData: (data: UserPassword) => void;
  createMutation: { isPending: boolean };
  updateMutation: { isPending: boolean };
  passwordMutation: { isPending: boolean };
  deleteMutation: { isPending: boolean };
}

export default function UserDialogs({
  createDialogOpen,
  editDialogOpen,
  deleteDialogOpen,
  passwordDialogOpen,
  currentUser,
  formData,
  passwordData,
  selectedIds,
  onCreate,
  onEdit,
  onPassword,
  onDelete,
  onCloseCreate,
  onCloseEdit,
  onCloseDelete,
  onClosePassword,
  onChangeFormData,
  onChangePasswordData,
  createMutation,
  updateMutation,
  passwordMutation,
  deleteMutation
}: UserDialogsProps) {
  return (
    <>
      <Dialog open={createDialogOpen} onClose={onCloseCreate} maxWidth="sm" fullWidth>
        <DialogTitle>新建用户</DialogTitle>
        <DialogContent>
          <Box sx={{ mt: 1 }}>
            <TextField
              fullWidth
              label="用户名"
              value={formData.username}
              onChange={(e) => onChangeFormData({ ...formData, username: e.target.value })}
              margin="normal"
              required
            />
            <TextField
              fullWidth
              label="邮箱"
              type="email"
              value={formData.email || ''}
              onChange={(e) => onChangeFormData({ ...formData, email: e.target.value })}
              margin="normal"
            />
            <TextField
              fullWidth
              label="密码"
              type="password"
              value={formData.password}
              onChange={(e) => onChangeFormData({ ...formData, password: e.target.value })}
              margin="normal"
              required
            />
            <FormControl fullWidth margin="normal">
              <InputLabel>角色</InputLabel>
              <Select
                value={formData.role}
                label="角色"
                onChange={(e) => onChangeFormData({ ...formData, role: e.target.value as 'admin' | 'user' })}
              >
                <MenuItem value="admin">管理员</MenuItem>
                <MenuItem value="user">普通用户</MenuItem>
              </Select>
            </FormControl>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={onCloseCreate}>取消</Button>
          <Button
            onClick={onCreate}
            variant="contained"
            disabled={createMutation.isPending}
          >
            {createMutation.isPending ? <CircularProgress size={24} /> : '创建'}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={editDialogOpen} onClose={onCloseEdit} maxWidth="sm" fullWidth>
        <DialogTitle>编辑用户</DialogTitle>
        <DialogContent>
          <Box sx={{ mt: 1 }}>
            <TextField
              fullWidth
              label="用户名"
              value={formData.username}
              onChange={(e) => onChangeFormData({ ...formData, username: e.target.value })}
              margin="normal"
              required
            />
            <TextField
              fullWidth
              label="邮箱"
              type="email"
              value={formData.email || ''}
              onChange={(e) => onChangeFormData({ ...formData, email: e.target.value })}
              margin="normal"
            />
            <FormControl fullWidth margin="normal">
              <InputLabel>角色</InputLabel>
              <Select
                value={formData.role}
                label="角色"
                onChange={(e) => onChangeFormData({ ...formData, role: e.target.value as 'admin' | 'user' })}
              >
                <MenuItem value="admin">管理员</MenuItem>
                <MenuItem value="user">普通用户</MenuItem>
              </Select>
            </FormControl>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={onCloseEdit}>取消</Button>
          <Button
            onClick={onEdit}
            variant="contained"
            disabled={updateMutation.isPending}
          >
            {updateMutation.isPending ? <CircularProgress size={24} /> : '更新'}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={passwordDialogOpen} onClose={onClosePassword} maxWidth="sm" fullWidth>
        <DialogTitle>修改密码 - {currentUser?.username}</DialogTitle>
        <DialogContent>
          <Box sx={{ mt: 1 }}>
            <TextField
              fullWidth
              label="新密码"
              type="password"
              value={passwordData.password}
              onChange={(e) => onChangePasswordData({ ...passwordData, password: e.target.value })}
              margin="normal"
              required
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={onClosePassword}>取消</Button>
          <Button
            onClick={onPassword}
            variant="contained"
            disabled={passwordMutation.isPending}
          >
            {passwordMutation.isPending ? <CircularProgress size={24} /> : '确定'}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={deleteDialogOpen} onClose={onCloseDelete}>
        <DialogTitle>确认删除</DialogTitle>
        <DialogContent>
          <Typography>
            确定要删除选中的 {selectedIds.length} 个用户吗？此操作不可恢复。
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
            {deleteMutation.isPending ? <CircularProgress size={24} /> : '删除'}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}