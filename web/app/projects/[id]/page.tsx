'use client';

import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  Box,
  Button,
  Card,
  CardContent,
  Container,
  Typography,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  CircularProgress,
  IconButton,
  Tooltip,
  Alert,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Chip,
  Divider
} from '@mui/material';
import {
  Add,
  Edit,
  Delete,
  ArrowBack,
  Refresh
} from '@mui/icons-material';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { enqueueSnackbar } from 'notistack';
import ProtectedRoute from '@/components/protected-route';
import MainLayout from '@/components/main-layout';
import { apiService } from '@/services/api';
import type { ProjectInfo, CommandInfo, CommandAdd, CommandUpdate } from '@/types/api';


export default function ProjectDetailPage() {
  const params = useParams();
  const router = useRouter();
  const queryClient = useQueryClient();
  const projectId = parseInt(params.id as string);

  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [currentCommand, setCurrentCommand] = useState<CommandInfo | null>(null);
  const [commandToDelete, setCommandToDelete] = useState<number | null>(null);
  const [formData, setFormData] = useState<CommandAdd | CommandUpdate>({
    project_id: projectId,
    action_type: '',
    description: '',
    shell_command: '',
    timeout: 60
  });


  const { data: projectData, isLoading: projectLoading } = useQuery({
    queryKey: ['project', projectId],
    queryFn: () => apiService.getProject(projectId),
  });


  const { data: commandsData, isLoading: commandsLoading, refetch } = useQuery({
    queryKey: ['commands', projectId],
    queryFn: () => apiService.getProjectCommands(projectId),
  });


  const project = projectData?.data;


  const createMutation = useMutation({
    mutationFn: (data: CommandAdd) => apiService.createCommand(data),
    onSuccess: (result) => {
      if (result.status === 1) {
        enqueueSnackbar('命令创建成功', { variant: 'success' });
        setCreateDialogOpen(false);
        setFormData({
          project_id: projectId,
          action_type: '',
          description: '',
          shell_command: '',
          timeout: 60
        });
        queryClient.invalidateQueries({ queryKey: ['commands', projectId] });
      } else {
        enqueueSnackbar(result.msg || '创建失败', { variant: 'error' });
      }
    },
    onError: () => {
      enqueueSnackbar('创建失败', { variant: 'error' });
    }
  });


  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: CommandUpdate }) => 
      apiService.updateCommand(id, data),
    onSuccess: (result) => {
      if (result.status === 1) {
        enqueueSnackbar('命令更新成功', { variant: 'success' });
        setEditDialogOpen(false);
        setCurrentCommand(null);
        queryClient.invalidateQueries({ queryKey: ['commands', projectId] });
      } else {
        enqueueSnackbar(result.msg || '更新失败', { variant: 'error' });
      }
    },
    onError: () => {
      enqueueSnackbar('更新失败', { variant: 'error' });
    }
  });


  const deleteMutation = useMutation({
    mutationFn: (id: number) => apiService.deleteCommands([id]),
    onSuccess: (result) => {
      if (result.status === 1) {
        enqueueSnackbar('删除成功', { variant: 'success' });
        setDeleteDialogOpen(false);
        setCommandToDelete(null);
        queryClient.invalidateQueries({ queryKey: ['commands', projectId] });
      } else {
        enqueueSnackbar(result.msg || '删除失败', { variant: 'error' });
      }
    },
    onError: () => {
      enqueueSnackbar('删除失败', { variant: 'error' });
    }
  });


  const handleCreate = () => {
    if (!formData.action_type || !formData.shell_command) {
      enqueueSnackbar('请填写必填项', { variant: 'warning' });
      return;
    }
    createMutation.mutate({ ...formData, project_id: projectId } as CommandAdd);
  };


  const handleEdit = () => {
    if (!currentCommand) return;
    updateMutation.mutate({ 
      id: currentCommand.id, 
      data: formData 
    });
  };


  const handleDelete = () => {
    if (commandToDelete === null) return;
    deleteMutation.mutate(commandToDelete);
  };


  const openEditDialog = (command: CommandInfo) => {
    setCurrentCommand(command);
    setFormData({
      action_type: command.action_type,
      description: command.description,
      shell_command: command.shell_command,
      timeout: command.timeout
    });
    setEditDialogOpen(true);
  };


  if (projectLoading) {
    return (
      <ProtectedRoute>
        <MainLayout>
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
            <CircularProgress />
          </Box>
        </MainLayout>
      </ProtectedRoute>
    );
  }


  if (!project) {
    return (
      <ProtectedRoute>
        <MainLayout>
          <Container maxWidth="lg">
            <Alert severity="error">项目不存在</Alert>
          </Container>
        </MainLayout>
      </ProtectedRoute>
    );
  }


  return (
    <ProtectedRoute>
      <MainLayout>
        <Container maxWidth="lg">
          <Box sx={{ mb: 4 }}>
            {/* 项目信息 */}
            <Box sx={{ mb: 4 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
                <IconButton onClick={() => router.back()} sx={{ mr: 2 }}>
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

            <Divider sx={{ mb: 4 }} />

            {/* 命令管理 */}
            <Box>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
                <Typography variant="h5" component="h2">
                  命令管理
                </Typography>
                <Box sx={{ display: 'flex', gap: 2 }}>
                  <Button
                    variant="outlined"
                    startIcon={<Refresh />}
                    onClick={() => refetch()}
                  >
                    刷新
                  </Button>
                  <Button
                    variant="contained"
                    startIcon={<Add />}
                    onClick={() => setCreateDialogOpen(true)}
                  >
                    新建命令
                  </Button>
                </Box>
              </Box>

              {commandsLoading ? (
                <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
                  <CircularProgress />
                </Box>
              ) : (
                <TableContainer component={Paper}>
                  <Table>
                    <TableHead>
                      <TableRow>
                        <TableCell>操作类型</TableCell>
                        <TableCell>描述</TableCell>
                        <TableCell>超时(秒)</TableCell>
                        <TableCell>命令内容</TableCell>
                        <TableCell align="right">操作</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {commandsData?.data?.map((command) => (
                        <TableRow key={command.id}>
                          <TableCell>
                            <Chip label={command.action_type} size="small" color="primary" />
                          </TableCell>
                          <TableCell>
                            {command.description || '-'}
                          </TableCell>
                          <TableCell>{command.timeout}</TableCell>
                          <TableCell>
                            <Tooltip title={command.shell_command} placement="top">
                              <Box 
                                sx={{ 
                                  maxWidth: 400,
                                  overflow: 'hidden',
                                  textOverflow: 'ellipsis',
                                  whiteSpace: 'nowrap',
                                  fontFamily: 'monospace',
                                  bgcolor: (theme) => 
                                    theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.08)' : 'grey.100',
                                  color: (theme) => 
                                    theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.9)' : 'inherit',
                                  p: 1,
                                  borderRadius: 1,
                                  cursor: 'pointer',
                                  border: 1,
                                  borderColor: (theme) => 
                                    theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.12)' : 'divider'
                                }}
                              >
                                {command.shell_command}
                              </Box>
                            </Tooltip>
                          </TableCell>
                          <TableCell align="right">
                            <Tooltip title="编辑">
                              <IconButton
                                size="small"
                                onClick={() => openEditDialog(command)}
                              >
                                <Edit />
                              </IconButton>
                            </Tooltip>
                            <Tooltip title="删除">
                              <IconButton
                                size="small"
                                color="error"
                                onClick={() => {
                                  setCommandToDelete(command.id);
                                  setDeleteDialogOpen(true);
                                }}
                              >
                                <Delete />
                              </IconButton>
                            </Tooltip>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              )}

              {!commandsLoading && commandsData?.data?.length === 0 && (
                <Alert severity="info" sx={{ mt: 2 }}>
                  暂无命令，请点击上方按钮创建
                </Alert>
              )}
            </Box>
          </Box>
        </Container>

        {/* 创建对话框 */}
        <Dialog open={createDialogOpen} onClose={() => setCreateDialogOpen(false)} maxWidth="md" fullWidth>
          <DialogTitle>新建命令</DialogTitle>
          <DialogContent>
            <Box sx={{ pt: 1, display: 'flex', flexDirection: 'column', gap: 2 }}>
              <TextField
                label="操作类型"
                fullWidth
                value={formData.action_type}
                onChange={(e) => setFormData({ ...formData, action_type: e.target.value })}
                placeholder="start, stop, deploy等"
              />
              <TextField
                label="描述"
                fullWidth
                value={formData.description || ''}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              />
              <TextField
                label="超时时间(秒)"
                fullWidth
                type="number"
                value={formData.timeout}
                onChange={(e) => setFormData({ ...formData, timeout: parseInt(e.target.value) || 60 })}
              />
              <TextField
                label="Shell命令"
                fullWidth
                multiline
                rows={6}
                value={formData.shell_command}
                onChange={(e) => setFormData({ ...formData, shell_command: e.target.value })}
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
            <Button onClick={() => setCreateDialogOpen(false)}>取消</Button>
            <Button 
              onClick={handleCreate} 
              variant="contained"
              disabled={createMutation.isPending}
            >
              {createMutation.isPending ? <CircularProgress size={20} /> : '创建'}
            </Button>
          </DialogActions>
        </Dialog>

        {/* 编辑对话框 */}
        <Dialog open={editDialogOpen} onClose={() => setEditDialogOpen(false)} maxWidth="md" fullWidth>
          <DialogTitle>编辑命令</DialogTitle>
          <DialogContent>
            <Box sx={{ pt: 1, display: 'flex', flexDirection: 'column', gap: 2 }}>
              <TextField
                label="操作类型"
                fullWidth
                value={formData.action_type}
                onChange={(e) => setFormData({ ...formData, action_type: e.target.value })}
              />
              <TextField
                label="描述"
                fullWidth
                value={formData.description || ''}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              />
              <TextField
                label="超时时间(秒)"
                fullWidth
                type="number"
                value={formData.timeout}
                onChange={(e) => setFormData({ ...formData, timeout: parseInt(e.target.value) || 60 })}
              />
              <TextField
                label="Shell命令"
                fullWidth
                multiline
                rows={6}
                value={formData.shell_command}
                onChange={(e) => setFormData({ ...formData, shell_command: e.target.value })}
                sx={{
                  '& .MuiInputBase-input': {
                    fontFamily: 'monospace'
                  }
                }}
              />
            </Box>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setEditDialogOpen(false)}>取消</Button>
            <Button 
              onClick={handleEdit} 
              variant="contained"
              disabled={updateMutation.isPending}
            >
              {updateMutation.isPending ? <CircularProgress size={20} /> : '保存'}
            </Button>
          </DialogActions>
        </Dialog>

        {/* 删除对话框 */}
        <Dialog open={deleteDialogOpen} onClose={() => setDeleteDialogOpen(false)}>
          <DialogTitle>确认删除</DialogTitle>
          <DialogContent>
            <Typography>
              确定要删除这个命令吗？此操作不可恢复。
            </Typography>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setDeleteDialogOpen(false)}>取消</Button>
            <Button 
              onClick={handleDelete} 
              color="error" 
              variant="contained"
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending ? <CircularProgress size={20} /> : '删除'}
            </Button>
          </DialogActions>
        </Dialog>
      </MainLayout>
    </ProtectedRoute>
  );
}
