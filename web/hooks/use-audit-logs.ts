import { useState, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { enqueueSnackbar } from 'notistack';
import { apiService } from '@/services/api';
import type { AuditLogInfo, AuditLogQueryParams } from '@/types/api';

export function useAuditLogs() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [filters, setFilters] = useState<AuditLogQueryParams>({});

  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [detailDialogOpen, setDetailDialogOpen] = useState(false);
  const [currentLog, setCurrentLog] = useState<AuditLogInfo | null>(null);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['auditLogs', page, pageSize, search, filters],
    queryFn: () => apiService.getAuditLogs({
      page,
      size: pageSize,
      keyword: search || undefined,
      ...filters,
      order_by: 'created_at',
      direction: 'desc'
    }),
  });

  const { data: projectsData } = useQuery({
    queryKey: ['auditLogProjects'],
    queryFn: () => apiService.getAuditLogProjects(),
  });

  const deleteMutation = useMutation({
    mutationFn: (ids: number[]) => apiService.deleteAuditLogs(ids),
    onSuccess: (result) => {
      if (result.status === 1) {
        enqueueSnackbar('删除成功', { variant: 'success' });
        setDeleteDialogOpen(false);
        setSelectedIds([]);
        queryClient.invalidateQueries({ queryKey: ['auditLogs'] });
      } else {
        enqueueSnackbar(result.msg || '删除失败', { variant: 'error' });
      }
    },
    onError: () => {
      enqueueSnackbar('删除失败', { variant: 'error' });
    }
  });

  const handleDelete = useCallback(() => {
    if (selectedIds.length === 0) return;
    deleteMutation.mutate(selectedIds);
  }, [selectedIds, deleteMutation]);

  const openDetailDialog = useCallback((log: AuditLogInfo) => {
    setCurrentLog(log);
    setDetailDialogOpen(true);
  }, []);

  const toggleSelect = useCallback((id: number) => {
    setSelectedIds(prev =>
      prev.includes(id)
        ? prev.filter(item => item !== id)
        : [...prev, id]
    );
  }, []);

  const toggleSelectAll = useCallback(() => {
    if (!data?.data) return;
    const allIds = data.data.map(item => item.id);
    const allSelected = selectedIds.length === allIds.length;
    setSelectedIds(allSelected ? [] : allIds);
  }, [data?.data, selectedIds.length]);

  const formatDate = useCallback((dateString: string) => {
    // 后端返回的 created_at 是 UTC 时间但未携带时区标识（数据库 DateTime 字段无 timezone）
    // 浏览器会把无时区字符串当作本地时间解析，导致显示比实际本地时间晚 8 小时（跨日时表现为日期错误）
    // 通过附加 'Z' 标记为 UTC，让浏览器自动转换为本地时区显示
    const hasTimezone = /Z$|[+-]\d{2}:\d{2}$/.test(dateString);
    const normalized = hasTimezone ? dateString : `${dateString}Z`;
    return new Date(normalized).toLocaleString('zh-CN');
  }, []);

  const getActorTypeLabel = useCallback((type: string) => {
    const labels: Record<string, string> = {
      'user': '用户',
      'api_key': 'API Key',
      'system': '系统'
    };
    return labels[type] || type;
  }, []);

  const getStatusColor = useCallback((status: string) => {
    const colors: Record<string, 'success' | 'error' | 'warning' | 'default'> = {
      'success': 'success',
      'failed': 'error',
      'timeout': 'warning',
      'cancelled': 'default'
    };
    return colors[status] || 'default';
  }, []);

  const getStatusLabel = useCallback((status: string) => {
    const labels: Record<string, string> = {
      'success': '成功',
      'failed': '失败',
      'timeout': '超时',
      'cancelled': '已取消'
    };
    return labels[status] || status;
  }, []);

  const updateFilters = useCallback((newFilters: Partial<AuditLogQueryParams>) => {
    setFilters(prev => ({ ...prev, ...newFilters }));
    setPage(1);
  }, []);

  return {
    logs: data?.data as AuditLogInfo[] | undefined,
    total: data?.total || 0,
    isLoading,
    refetch,
    search,
    setSearch,
    selectedIds,
    setSelectedIds,
    page,
    setPage,
    pageSize,
    setPageSize,
    filters,
    updateFilters,
    projects: projectsData?.data || [],
    deleteDialogOpen,
    setDeleteDialogOpen,
    detailDialogOpen,
    setDetailDialogOpen,
    currentLog,
    setCurrentLog,
    handleDelete,
    openDetailDialog,
    toggleSelect,
    toggleSelectAll,
    formatDate,
    getActorTypeLabel,
    getStatusColor,
    getStatusLabel,
    deleteMutation
  };
}
