import { Box, Button, Dialog, DialogActions, DialogContent, DialogTitle, TextField, CircularProgress } from '@mui/material';
import type { CommandAdd, CommandUpdate } from '@/types/api';

interface CommandDialogProps {
  open: boolean;
  onClose: () => void;
  title: string;
  formData: CommandAdd | CommandUpdate;
  defaultParamsText: string;
  onFormDataChange: (data: CommandAdd | CommandUpdate) => void;
  onDefaultParamsTextChange: (text: string) => void;
  onSubmit: () => void;
  isSubmitting: boolean;
  submitText: string;
}

export function CommandDialog({
  open,
  onClose,
  title,
  formData,
  defaultParamsText,
  onFormDataChange,
  onDefaultParamsTextChange,
  onSubmit,
  isSubmitting,
  submitText
}: CommandDialogProps) {
  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>{title}</DialogTitle>
      <DialogContent>
        <Box sx={{ pt: 1, display: 'flex', flexDirection: 'column', gap: 2 }}>
          <TextField
            label="操作类型"
            fullWidth
            value={formData.action_type}
            onChange={(e) => onFormDataChange({ ...formData, action_type: e.target.value })}
            placeholder="start, stop, deploy等"
          />
          <TextField
            label="描述"
            fullWidth
            value={formData.description || ''}
            onChange={(e) => onFormDataChange({ ...formData, description: e.target.value })}
          />
          <TextField
            label="超时时间(秒)"
            fullWidth
            type="number"
            value={formData.timeout}
            onChange={(e) => onFormDataChange({ ...formData, timeout: parseInt(e.target.value) || 600 })}
          />
          <TextField
            label="默认参数 (JSON格式)"
            fullWidth
            multiline
            rows={4}
            value={defaultParamsText}
            onChange={(e) => onDefaultParamsTextChange(e.target.value)}
            placeholder='{"version": "v1.0.0", "env": "production"}'
            helperText="使用 JSON 格式设置可选参数的默认值，执行时会自动填充到占位符"
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
            onChange={(e) => onFormDataChange({ ...formData, shell_command: e.target.value })}
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
        <Button onClick={onClose}>取消</Button>
        <Button
          onClick={onSubmit}
          variant="contained"
          disabled={isSubmitting}
        >
          {isSubmitting ? <CircularProgress size={20} /> : submitText}
        </Button>
      </DialogActions>
    </Dialog>
  );
}