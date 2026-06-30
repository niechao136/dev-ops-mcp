import { Box, Card, CardContent, Chip, IconButton, Typography } from '@mui/material';
import { ArrowBack } from '@mui/icons-material';
import type { ProjectInfo } from '@/types/api';

interface ProjectInfoProps {
  project: ProjectInfo;
  onBack: () => void;
}

export function ProjectInfo({ project, onBack }: ProjectInfoProps) {
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
      </Box>

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