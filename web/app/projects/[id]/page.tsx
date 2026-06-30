'use client';

import { useState, useEffect, useRef } from 'react';
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
  Divider,
  TablePagination,
  LinearProgress
} from '@mui/material';
import {
  PlayArrow,
  Add,
  Edit,
  Delete,
  ArrowBack,
  Refresh,
  HelpOutlined,
  Download,
  Cancel
} from '@mui/icons-material';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { enqueueSnackbar } from 'notistack';
import ProtectedRoute from '@/components/protected-route';
import MainLayout from '@/components/main-layout';
import { apiService } from '@/services/api';
import type { ProjectInfo, CommandInfo, CommandAdd, CommandUpdate, CommandExecute, CommandExecuteResult, PublicCommandInfo, TaskInfo, TaskSubmitResult } from '@/types/api';


export default function ProjectDetailPage() {
  const params = useParams();
  const router = useRouter();
  const queryClient = useQueryClient();
  const projectId = parseInt(params.id as string);

  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [executeDialogOpen, setExecuteDialogOpen] = useState(false);
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [currentCommand, setCurrentCommand] = useState<CommandInfo | null>(null);
  const [commandToDelete, setCommandToDelete] = useState<number | null>(null);
  const [executeParams, setExecuteParams] = useState<Record<string, string>>({});
  const [executeResult, setExecuteResult] = useState<CommandExecuteResult | null>(null);
  const [taskId, setTaskId] = useState<string | null>(null);
  const [taskStatus, setTaskStatus] = useState<'pending' | 'running' | 'success' | 'failed' | 'timeout' | 'cancelled' | null>(null);
  const [taskLog, setTaskLog] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isTaskRunning, setIsTaskRunning] = useState(false);
  const logContainerRef = useRef<HTMLDivElement>(null);
  const [formData, setFormData] = useState<CommandAdd | CommandUpdate>({
    project_id: projectId,
    action_type: '',
    description: '',
    shell_command: '',
    timeout: 600,
    default_params: undefined
  });
  const [defaultParamsText, setDefaultParamsText] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize] = useState(10);
  const [importSearch, setImportSearch] = useState('');


  const { data: projectData, isLoading: projectLoading } = useQuery({
    queryKey: ['project', projectId],
    queryFn: () => apiService.getProject(projectId),
  });


  const { data: commandsData, isLoading: commandsLoading, refetch } = useQuery({
    queryKey: ['commands', projectId, page],
    queryFn: () => apiService.getProjectCommands(projectId, {
      page,
      size: pageSize
    }),
  });

  // 获取公共命令列表用于导入
  const { data: publicCommandsData } = useQuery({
    queryKey: ['publicCommands', importSearch],
    queryFn: () => apiService.getPublicCommands({
      page: 1,
      size: 100,
      keyword: importSearch || undefined
    }),
    enabled: importDialogOpen,
  });

  // 导入公共命令 mutation
  const importMutation = useMutation({
    mutationFn: (publicCommandId: number) => apiService.importPublicCommand({
      public_command_id: publicCommandId,
      project_id: projectId
    }),
    onSuccess: (result) => {
      if (result.status === 1) {
        enqueueSnackbar('导入成功', { variant: 'success' });
        setImportDialogOpen(false);
        queryClient.invalidateQueries({ queryKey: ['commands', projectId] });
      } else {
        enqueueSnackbar(result.msg || '导入失败', { variant: 'error' });
      }
    },
    onError: () => {
      enqueueSnackbar('导入失败', { variant: 'error' });
    }
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
          timeout: 600,
          default_params: undefined
        });
        setDefaultParamsText('');
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


  const executeMutation = useMutation({
    mutationFn: (data: CommandExecute) => apiService.executeTask(data),
    onSuccess: (result) => {
      if (result.status === 1) {
        const taskData = result.data!;
        setTaskId(taskData.task_id);
        setTaskStatus('pending');
        setTaskLog('');
        setIsSubmitting(false);
        setIsTaskRunning(true);
        enqueueSnackbar(taskData.message, { variant: 'info' });
      } else {
        setIsSubmitting(false);
        enqueueSnackbar(result.msg || '提交失败', { variant: 'error' });
      }
    },
    onError: () => {
      setIsSubmitting(false);
      enqueueSnackbar('提交失败', { variant: 'error' });
    }
  });

  const cancelTaskMutation = useMutation({
    mutationFn: (taskId: string) => apiService.cancelTask(taskId),
    onSuccess: (result) => {
      if (result.status === 1) {
        enqueueSnackbar('任务已取消', { variant: 'info' });
      } else {
        enqueueSnackbar(result.msg || '取消失败', { variant: 'error' });
      }
    },
    onError: () => {
      enqueueSnackbar('取消失败', { variant: 'error' });
    }
  });


  const handleCreate = () => {
    if (!formData.action_type || !formData.shell_command) {
      enqueueSnackbar('请填写必填项', { variant: 'warning' });
      return;
    }

    let parsedDefaultParams: Record<string, any> | null = null;
    if (defaultParamsText.trim()) {
      try {
        parsedDefaultParams = JSON.parse(defaultParamsText);
      } catch {
        enqueueSnackbar('默认参数 JSON 格式错误', { variant: 'error' });
        return;
      }
    }

    createMutation.mutate({
      ...formData,
      project_id: projectId,
      default_params: parsedDefaultParams
    } as CommandAdd);
  };


  const handleEdit = () => {
    if (!currentCommand) return;

    let parsedDefaultParams: Record<string, any> | undefined = undefined;
    if (defaultParamsText.trim()) {
      try {
        parsedDefaultParams = JSON.parse(defaultParamsText);
      } catch {
        enqueueSnackbar('默认参数 JSON 格式错误', { variant: 'error' });
        return;
      }
    }

    updateMutation.mutate({
      id: currentCommand.id,
      data: {
        ...formData,
        default_params: parsedDefaultParams
      }
    });
  };


  const handleDelete = () => {
    if (commandToDelete === null) return;
    deleteMutation.mutate(commandToDelete);
  };


  const openExecuteDialog = (command: CommandInfo) => {
    setCurrentCommand(command);
    const placeholders = command.shell_command.match(/\$\{(\w+)\}/g) || [];
    const params: Record<string, string> = {};
    placeholders.forEach(p => {
      const key = p.replace(/\$\{|\}/g, '');
      params[key] = command.default_params?.[key]?.toString() || '';
    });
    setExecuteParams(params);
    setExecuteResult(null);
    setTaskId(null);
    setTaskStatus(null);
    setTaskLog('');
    setIsTaskRunning(false);
    setIsSubmitting(false);
    setExecuteDialogOpen(true);
  };


  const handleExecute = () => {
    if (!currentCommand || !project) return;

    const paramsObj: Record<string, any> = {};
    Object.entries(executeParams).forEach(([key, value]) => {
      if (value.trim()) {
        paramsObj[key] = value.trim();
      }
    });

    setIsSubmitting(true);
    executeMutation.mutate({
      project_name: project.name,
      action: currentCommand.action_type,
      params: Object.keys(paramsObj).length > 0 ? paramsObj : undefined
    });
  };


  const handleCancelTask = () => {
    if (!taskId) return;
    cancelTaskMutation.mutate(taskId);
    setTaskStatus('cancelled');
    setIsTaskRunning(false);
  };


  useEffect(() => {
    let interval: ReturnType<typeof setInterval>;

    const pollTaskStatus = async () => {
      if (!taskId) return;

      try {
        const result = await apiService.getTaskStatus(taskId);
        if (result.status === 1 && result.data) {
          const task = result.data;
          setTaskStatus(task.status);
          if (task.output_log) {
            setTaskLog(task.output_log);
          }

          if (task.status === 'success' || task.status === 'failed' || task.status === 'timeout' || task.status === 'cancelled') {
            setIsTaskRunning(false);
            if (interval) {
              clearInterval(interval);
            }

            const statusMessages = {
              success: { message: '任务执行成功', variant: 'success' as const },
              failed: { message: '任务执行失败', variant: 'error' as const },
              timeout: { message: '任务执行超时', variant: 'warning' as const },
              cancelled: { message: '任务已取消', variant: 'info' as const }
            };

            const statusMsg = statusMessages[task.status];
            if (statusMsg) {
              enqueueSnackbar(statusMsg.message, { variant: statusMsg.variant });
            }
          }
        }
      } catch (error) {
        console.error('Failed to poll task status:', error);
      }
    };

    if (isTaskRunning && taskId) {
      pollTaskStatus();
      interval = setInterval(pollTaskStatus, 2000);
    }

    return () => {
      if (interval) {
        clearInterval(interval);
      }
    };
  }, [isTaskRunning, taskId]);


  useEffect(() => {
    if (logContainerRef.current) {
      logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
    }
  }, [taskLog]);


  const openEditDialog = (command: CommandInfo) => {
    setCurrentCommand(command);
    const defaultParams = command.default_params !== null && command.default_params !== undefined ? command.default_params : undefined;
    setFormData({
      action_type: command.action_type,
      description: command.description,
      shell_command: command.shell_command,
      timeout: command.timeout,
      default_params: defaultParams
    });
    setDefaultParamsText(defaultParams ? JSON.stringify(defaultParams, null, 2) : '');
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
                    variant="outlined"
                    startIcon={<Download />}
                    onClick={() => {
                      setImportSearch('');
                      setImportDialogOpen(true);
                    }}
                  >
                    导入公共命令
                  </Button>
                  <Button
                    variant="contained"
                    startIcon={<Add />}
                    onClick={() => {
                      setFormData({
                        project_id: projectId,
                        action_type: '',
                        description: '',
                        shell_command: '',
                        timeout: 600,
                        default_params: undefined
                      });
                      setDefaultParamsText('');
                      setCreateDialogOpen(true);
                    }}
                  >
                    新建命令
                  </Button>
                </Box>
              </Box>

              <Card sx={{ mb: 3 }}>
                <CardContent>
                  <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 2 }}>
                    <HelpOutlined sx={{ fontSize: 20, color: 'primary.main', mt: 0.25 }} />
                    <Box>
                      <Typography variant="subtitle2" sx={{ fontWeight: 'bold' }} color="text.primary">
                        可选参数设置说明
                      </Typography>
                      <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                        在命令脚本中使用 <code style={{ backgroundColor: 'rgba(0,0,0,0.08)', padding: '2px 4px', borderRadius: 2 }}>${'{'}参数名{'}'}</code> 格式定义占位符，执行时会被替换为实际传入的值。
                      </Typography>
                      <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                        <strong>示例：</strong>
                        <br />
                        <code style={{ backgroundColor: 'rgba(0,0,0,0.08)', padding: '2px 4px', borderRadius: 2 }}>git checkout ${'{'}version{'}'}</code>
                        <br />
                        执行时传入 <code style={{ backgroundColor: 'rgba(0,0,0,0.08)', padding: '2px 4px', borderRadius: 2 }}>{'{'}version: "v1.0.0"{'}'}</code>，实际执行：<code style={{ backgroundColor: 'rgba(0,0,0,0.08)', padding: '2px 4px', borderRadius: 2 }}>git checkout v1.0.0</code>
                      </Typography>
                    </Box>
                  </Box>
                </CardContent>
              </Card>

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
                            <Tooltip title="执行">
                              <IconButton
                                size="small"
                                color="success"
                                onClick={() => openExecuteDialog(command)}
                              >
                                <PlayArrow />
                              </IconButton>
                            </Tooltip>
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

              {commandsData && commandsData.total > 0 && (
                <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: 2 }}>
                  <TablePagination
                    component="div"
                    count={commandsData.total}
                    page={page - 1}
                    onPageChange={(event, newPage) => setPage(newPage + 1)}
                    rowsPerPage={pageSize}
                    rowsPerPageOptions={[10, 25, 50]}
                    labelRowsPerPage="每页行数"
                    labelDisplayedRows={({ from, to, count }) => `${from}-${to} 共 ${count}`}
                  />
                </Box>
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
                onChange={(e) => setFormData({ ...formData, timeout: parseInt(e.target.value) || 600 })}
              />
              <TextField
                label="默认参数 (JSON格式)"
                fullWidth
                multiline
                rows={4}
                value={defaultParamsText}
                onChange={(e) => setDefaultParamsText(e.target.value)}
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
                onChange={(e) => setFormData({ ...formData, timeout: parseInt(e.target.value) || 600 })}
              />
              <TextField
                label="默认参数 (JSON格式)"
                fullWidth
                multiline
                rows={4}
                value={defaultParamsText}
                onChange={(e) => setDefaultParamsText(e.target.value)}
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

        {/* 执行命令对话框 */}
        <Dialog open={executeDialogOpen} onClose={() => setExecuteDialogOpen(false)} maxWidth="lg" fullWidth>
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
                        onChange={(e) => setExecuteParams({ ...executeParams, [key]: e.target.value })}
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
                    ref={logContainerRef}
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
            <Button onClick={() => setExecuteDialogOpen(false)}>关闭</Button>
            {!isTaskRunning && !isSubmitting && (
              <Button
                onClick={handleExecute}
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
                onClick={handleCancelTask}
                variant="contained"
                color="error"
                startIcon={<Cancel />}
              >
                取消任务
              </Button>
            )}
          </DialogActions>
        </Dialog>

        {/* 导入公共命令对话框 */}
        <Dialog open={importDialogOpen} onClose={() => setImportDialogOpen(false)} maxWidth="md" fullWidth>
          <DialogTitle>导入公共命令</DialogTitle>
          <DialogContent>
            <Box sx={{ pt: 1 }}>
              <TextField
                label="搜索公共命令"
                fullWidth
                size="small"
                value={importSearch}
                onChange={(e) => setImportSearch(e.target.value)}
                placeholder="搜索名称、描述、操作类型..."
                sx={{ mb: 2 }}
              />
              <TableContainer component={Paper} sx={{ maxHeight: 400 }}>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>名称</TableCell>
                      <TableCell>操作类型</TableCell>
                      <TableCell>描述</TableCell>
                      <TableCell align="right">操作</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {publicCommandsData?.data?.map((cmd) => (
                      <TableRow key={cmd.id}>
                        <TableCell>{cmd.name}</TableCell>
                        <TableCell>
                          <Chip label={cmd.action_type} size="small" color="primary" />
                        </TableCell>
                        <TableCell>
                          <Tooltip title={cmd.description || ''}>
                            <Typography variant="body2" sx={{
                              maxWidth: 200,
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap'
                            }}>
                              {cmd.description || '-'}
                            </Typography>
                          </Tooltip>
                        </TableCell>
                        <TableCell align="right">
                          <Button
                            size="small"
                            variant="contained"
                            startIcon={<Download />}
                            onClick={() => importMutation.mutate(cmd.id)}
                            disabled={importMutation.isPending}
                          >
                            导入
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                    {(!publicCommandsData?.data || publicCommandsData.data.length === 0) && (
                      <TableRow>
                        <TableCell colSpan={4} align="center">
                          <Typography color="text.secondary" sx={{ py: 2 }}>
                            暂无公共命令
                          </Typography>
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </TableContainer>
            </Box>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setImportDialogOpen(false)}>关闭</Button>
          </DialogActions>
        </Dialog>
      </MainLayout>
    </ProtectedRoute>
  );
}
