import { Box, Button, Chip, CircularProgress, Dialog, DialogActions, DialogContent, DialogTitle, LinearProgress, TextField, Typography } from '@mui/material';
import { PlayArrow, Cancel } from '@mui/icons-material';
import type { CommandInfo, ProjectInfo } from '@/types/api';

type TaskStatus = 'pending' | 'running' | 'success' | 'failed' | 'timeout' | 'cancelled' | null;

interface ExecuteDialogProps {
  open: boolean;
  onClose: () => void;
  project: ProjectInfo | undefined;
  currentCommand: CommandInfo | null;
  executeParams: Record<string, string>;
  onExecuteParamsChange: (key: string, value: string) => void;
  taskId: string | null;
  taskStatus: TaskStatus;
  taskLog: string;
  isSubmitting: boolean;
  isTaskRunning: boolean;
  logContainerRef: React.RefObject<HTMLDivElement | null>;
  onExecute: (project: ProjectInfo | undefined) => void;
  onCancelTask: () => void;
}

export function ExecuteDialog({
  open,
  onClose,
  project,
  currentCommand,
  executeParams,
  onExecuteParamsChange,
  taskId,
  taskStatus,
  taskLog,
  isSubmitting,
  isTaskRunning,
  logContainerRef,
  onExecute,
  onCancelTask
}: ExecuteDialogProps) {
  return (
    <Dialog open={open} onClose={onClose} maxWidth="lg" fullWidth>
      <DialogTitle>执行命令</DialogTitle>
      <DialogContent>
        <Box sx={{ pt: 1, display: 'flex', flexDirection: 'column', gap: 2 }}>
          <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
            <Chip
              label={`项目: ${project?.name || ''}`}
              size="small"
              color="primary"
            />
            <Chip
              label={`操作: ${currentCommand?.action_type || ''}`}
              size="small"
              color="secondary"
            />
            {taskId && (
              <Chip
                label={`任务ID: ${taskId}`}
                size="small"
                variant="outlined"
              />
            )}
          </Box>

          <Typography variant="subtitle2" color="text.secondary">
            命令脚本：
          </Typography>
          <Box
            sx={{
              fontFamily: 'monospace',
              bgcolor: (theme) =>
                theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.08)' : 'grey.100',
              color: (theme) =>
                theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.9)' : 'inherit',
              p: 2,
              borderRadius: 1,
              border: 1,
              borderColor: (theme) =>
                theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.12)' : 'divider'
            }}
          >
            {currentCommand?.shell_command || ''}
          </Box>

          {!isTaskRunning && Object.keys(executeParams).length > 0 && (
            <>
              <Typography variant="subtitle2" color="text.secondary">
                参数：
              </Typography>
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2 }}>
                {Object.entries(executeParams).map(([key, value]) => (
                  <TextField
                    key={key}
                    label={`${key}`}
                    value={value}
                    onChange={(e) => onExecuteParamsChange(key, e.target.value)}
                    placeholder={`请输入 ${key}`}
                    sx={{ width: 200 }}
                    disabled={isSubmitting || isTaskRunning}
                  />
                ))}
              </Box>
            </>
          )}

          {(isSubmitting || isTaskRunning || taskStatus) && (
            <>
              <Typography variant="subtitle2" color="text.secondary">
                任务状态：
              </Typography>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                {isSubmitting && (
                  <>
                    <CircularProgress size={20} />
                    <Typography>提交中...</Typography>
                  </>
                )}
                {taskStatus === 'pending' && !isSubmitting && (
                  <>
                    <CircularProgress size={20} color="warning" />
                    <Typography>排队中...</Typography>
                  </>
                )}
                {taskStatus === 'running' && (
                  <>
                    <CircularProgress size={20} color="info" />
                    <Typography>运行中...</Typography>
                    <LinearProgress sx={{ flex: 1 }} />
                  </>
                )}
                {taskStatus === 'success' && (
                  <Chip label="成功" size="small" color="success" />
                )}
                {taskStatus === 'failed' && (
                  <Chip label="失败" size="small" color="error" />
                )}
                {taskStatus === 'timeout' && (
                  <Chip label="超时" size="small" color="warning" />
                )}
                {taskStatus === 'cancelled' && (
                  <Chip label="已取消" size="small" variant="outlined" />
                )}
              </Box>
            </>
          )}

          {(isTaskRunning || taskLog) && (
            <>
              <Typography variant="subtitle2" color="text.secondary">
                实时日志：
              </Typography>
              <Box
                ref={logContainerRef as React.Ref<HTMLDivElement>}
                sx={{
                  bgcolor: (theme) =>
                    theme.palette.mode === 'dark' ? 'rgba(0,0,0,0.4)' : 'rgba(0,0,0,0.05)',
                  color: (theme) =>
                    theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.9)' : 'inherit',
                  p: 2,
                  borderRadius: 1,
                  border: 1,
                  borderColor: (theme) =>
                    theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.12)' : 'divider',
                  maxHeight: '300px',
                  overflowY: 'auto',
                  fontFamily: 'monospace',
                  whiteSpace: 'pre-wrap',
                  fontSize: '0.875rem'
                }}
              >
                {taskLog || '等待任务开始...'}
              </Box>
            </>
          )}
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>关闭</Button>
        {!isTaskRunning && !isSubmitting && (
          <Button
            onClick={() => onExecute(project)}
            variant="contained"
            color="success"
            disabled={isSubmitting || isTaskRunning}
            startIcon={<PlayArrow />}
          >
            {isSubmitting ? <CircularProgress size={20} /> : '执行'}
          </Button>
        )}
        {isTaskRunning && taskStatus === 'running' && (
          <Button
            onClick={onCancelTask}
            variant="contained"
            color="error"
            startIcon={<Cancel />}
          >
            取消任务
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
}