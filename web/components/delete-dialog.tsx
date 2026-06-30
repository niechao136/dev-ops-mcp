import { Button, Dialog, DialogActions, DialogContent, DialogTitle, CircularProgress, Typography } from '@mui/material';

interface DeleteDialogProps {
  open: boolean;
  onClose: () => void;
  onDelete: () => void;
  isDeleting: boolean;
}

export function DeleteDialog({
  open,
  onClose,
  onDelete,
  isDeleting
}: DeleteDialogProps) {
  return (
    <Dialog open={open} onClose={onClose}>
      <DialogTitle>确认删除</DialogTitle>
      <DialogContent>
        <Typography>
          确定要删除这个命令吗？此操作不可恢复。
        </Typography>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>取消</Button>
        <Button
          onClick={onDelete}
          color="error"
          variant="contained"
          disabled={isDeleting}
        >
          {isDeleting ? <CircularProgress size={20} /> : '删除'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}