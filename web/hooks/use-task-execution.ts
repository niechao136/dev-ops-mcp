import { useState, useEffect, useRef, useCallback } from 'react';
import { useMutation } from '@tanstack/react-query';
import { enqueueSnackbar } from 'notistack';
import { apiService } from '@/services/api';
import type { CommandInfo, ProjectInfo, CommandExecute } from '@/types/api';

type TaskStatus = 'pending' | 'running' | 'success' | 'failed' | 'timeout' | 'cancelled' | null;

export function useTaskExecution() {
  const [executeDialogOpen, setExecuteDialogOpen] = useState(false);
  const [currentCommand, setCurrentCommand] = useState<CommandInfo | null>(null);
  const [executeParams, setExecuteParams] = useState<Record<string, string>>({});
  const [taskId, setTaskId] = useState<string | null>(null);
  const [taskStatus, setTaskStatus] = useState<TaskStatus>(null);
  const [taskLog, setTaskLog] = useState<string>('');
  const logOffsetRef = useRef(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isTaskRunning, setIsTaskRunning] = useState(false);
  const logContainerRef = useRef<HTMLDivElement>(null);

  const executeMutation = useMutation({
    mutationFn: (data: CommandExecute) => apiService.executeTask(data),
    onSuccess: (result) => {
      if (result.status === 1) {
        const taskData = result.data!;
        setTaskId(taskData.task_id);
        setTaskStatus('pending');
        setTaskLog('');
        logOffsetRef.current = 0;
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

  const openExecuteDialog = useCallback((command: CommandInfo) => {
    setCurrentCommand(command);
    const placeholders = command.shell_command.match(/\$\{(\w+)\}/g) || [];
    const params: Record<string, string> = {};
    placeholders.forEach(p => {
      const key = p.replace(/\$\{|\}/g, '');
      params[key] = command.default_params?.[key]?.toString() || '';
    });
    setExecuteParams(params);
    setTaskId(null);
    setTaskStatus(null);
    setTaskLog('');
    logOffsetRef.current = 0;
    setIsTaskRunning(false);
    setIsSubmitting(false);
    setExecuteDialogOpen(true);
  }, []);

  const handleExecute = useCallback((project: ProjectInfo | undefined) => {
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
  }, [currentCommand, executeParams, executeMutation]);

  const handleCancelTask = useCallback(() => {
    if (!taskId) return;
    cancelTaskMutation.mutate(taskId);
    setTaskStatus('cancelled');
    setIsTaskRunning(false);
  }, [taskId, cancelTaskMutation]);

  useEffect(() => {
    let interval: ReturnType<typeof setInterval>;

    const pollTaskStatus = async () => {
      if (!taskId) return;

      try {
        const result = await apiService.getTaskStatus(taskId, logOffsetRef.current);
        if (result.status === 1 && result.data) {
          const task = result.data;
          setTaskStatus(task.status);

          if (task.output_log) {
            setTaskLog(prev => prev + task.output_log);
          }

          if (task.next_offset !== undefined) {
            logOffsetRef.current = task.next_offset;
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

  const updateExecuteParams = useCallback((key: string, value: string) => {
    setExecuteParams(prev => ({ ...prev, [key]: value }));
  }, []);

  return {
    executeDialogOpen,
    setExecuteDialogOpen,
    currentCommand,
    executeParams,
    updateExecuteParams,
    taskId,
    taskStatus,
    taskLog,
    isSubmitting,
    isTaskRunning,
    logContainerRef,
    openExecuteDialog,
    handleExecute,
    handleCancelTask
  };
}
