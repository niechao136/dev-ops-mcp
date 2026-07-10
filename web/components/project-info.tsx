import { Box, Card, CardContent, Chip, IconButton, Typography, Button, CircularProgress } from '@mui/material';
import { ArrowBack, Stop, NotificationImportant, Terminal } from '@mui/icons-material';
import type { ProjectInfo } from '@/types/api';

interface ProjectInfoProps {
  project: ProjectInfo;
  onBack: () => void;
  onCancelRunningTask?: (taskId: string) => void;
  isCancelling?: boolean;
  onOpenTerminal?: () => void;
}

export function ProjectInfo({ project, onBack, onCancelRunningTask, isCancelling, onOpenTerminal }: ProjectInfoProps) {
  return (
    <Box sx={{ mb: 4 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
        <IconButton onClick={onBack} sx={{ mr: 2 }}>
          <ArrowBack />
        </IconButton>
        <Typography variant="h4" component="h1">
          {project.name}
        </Typography>
        <Chip
          label={project.is_active ? '启用' : '禁用'}
          color={project.is_active ? 'success' : 'default'}
          size="small"
          sx={{ ml: 2 }}
        />
        <IconButton
          onClick={onOpenTerminal}
          sx={{ ml: 2, color: '#0dbc79' }}
          title="打开终端"
        >
          <Terminal />
        </IconButton>
      </Box>

      {project.running_task && (
        <Card sx={{ mb: 4, bgcolor: 'warning.light' }}>
          <CardContent>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
              <NotificationImportant sx={{ color: 'warning.main' }} />
              <Typography sx={{ fontWeight: 'bold' }} variant="subtitle1" color="warning.main">
                正在执行命令: {project.running_task.action}
              </Typography>
              <CircularProgress size={20} color="warning" />
              <Button
                variant="contained"
                color="error"
                startIcon={<Stop />}
                onClick={() => onCancelRunningTask?.(project?.running_task?.task_id ?? '')}
                disabled={isCancelling}
                size="small"
              >
                {isCancelling ? <CircularProgress size={16} /> : '停止'}
              </Button>
            </Box>
            <Box sx={{ bgcolor: 'black', color: 'white', p: 2, borderRadius: 1, maxHeight: 150, overflowY: 'auto', fontFamily: 'monospace', fontSize: '0.875rem' }}>
              <Typography sx={{ whiteSpace: 'pre-wrap' }} variant="body2" component="pre">
                {project.running_task.output_log || '等待输出...'}
              </Typography>
            </Box>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
            <Box sx={{ display: 'flex', gap: 2 }}>
              <Typography variant="subtitle2" color="text.secondary">
                工作目录:
              </Typography>
              <Typography>{project.work_dir}</Typography>
            </Box>
            {project.description && (
              <Box>
                <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 0.5 }}>
                  描述:
                </Typography>
                <Typography>{project.description}</Typography>
              </Box>
            )}
          </Box>
        </CardContent>
      </Card>
    </Box>
  );
}
