'use client';

import {
  Box,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  CircularProgress,
  Typography,
  Chip,
  Divider,
  Paper,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
} from '@mui/material';
import { ExpandMore, Search } from '@mui/icons-material';
import type { AuditLogInfo, AuditLogQueryParams } from '@/types/api';

interface AuditLogDialogsProps {
  deleteDialogOpen: boolean;
  detailDialogOpen: boolean;
  currentLog: AuditLogInfo | null;
  selectedIds: number[];
  search: string;
  filters: AuditLogQueryParams;
  projects: string[];
  onDelete: () => void;
  onCloseDelete: () => void;
  onCloseDetail: () => void;
  onChangeSearch: (search: string) => void;
  onUpdateFilters: (filters: Partial<AuditLogQueryParams>) => void;
  formatDate: (dateString: string) => string;
  getActorTypeLabel: (type: string) => string;
  getStatusColor: (status: string) => 'success' | 'error' | 'warning' | 'default';
  getStatusLabel: (status: string) => string;
  deleteMutation: { isPending: boolean };
}

export default function AuditLogDialogs({
  deleteDialogOpen,
  detailDialogOpen,
  currentLog,
  selectedIds,
  search,
  filters,
  projects,
  onDelete,
  onCloseDelete,
  onCloseDetail,
  onChangeSearch,
  onUpdateFilters,
  formatDate,
  getActorTypeLabel,
  getStatusColor,
  getStatusLabel,
  deleteMutation
}: AuditLogDialogsProps) {
  return (
    <>
      <Accordion defaultExpanded sx={{ mb: 3 }}>
        <AccordionSummary expandIcon={<ExpandMore />}>
          <Typography>搜索和筛选</Typography>
        </AccordionSummary>
        <AccordionDetails>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', bgcolor: 'background.paper', p: 1, borderRadius: 1, border: 1, borderColor: 'divider' }}>
              <Search color="action" />
              <input
                style={{
                  flex: 1,
                  border: 'none',
                  outline: 'none',
                  fontSize: '1rem',
                  background: 'transparent'
                }}
                placeholder="搜索操作日志..."
                value={search}
                onChange={(e) => onChangeSearch(e.target.value)}
              />
            </Box>
            <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
              <FormControl sx={{ minWidth: 200 }}>
                <InputLabel>操作者类型</InputLabel>
                <Select
                  value={filters.actor_type || ''}
                  label="操作者类型"
                  onChange={(e) => onUpdateFilters({ actor_type: e.target.value || undefined })}
                >
                  <MenuItem value="">全部</MenuItem>
                  <MenuItem value="user">用户</MenuItem>
                  <MenuItem value="api_key">API Key</MenuItem>
                </Select>
              </FormControl>
              <FormControl sx={{ minWidth: 200 }}>
                <InputLabel>操作状态</InputLabel>
                <Select
                  value={filters.status || ''}
                  label="操作状态"
                  onChange={(e) => onUpdateFilters({ status: e.target.value || undefined })}
                >
                  <MenuItem value="">全部</MenuItem>
                  <MenuItem value="success">成功</MenuItem>
                  <MenuItem value="failed">失败</MenuItem>
                  <MenuItem value="timeout">超时</MenuItem>
                  <MenuItem value="cancelled">已取消</MenuItem>
                </Select>
              </FormControl>
              <FormControl sx={{ minWidth: 200 }}>
                <InputLabel>目标项目</InputLabel>
                <Select
                  value={filters.target_project || ''}
                  label="目标项目"
                  onChange={(e) => onUpdateFilters({ target_project: e.target.value || undefined })}
                >
                  <MenuItem value="">全部</MenuItem>
                  {projects.map(project => (
                    <MenuItem key={project} value={project}>{project}</MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Box>
          </Box>
        </AccordionDetails>
      </Accordion>

      <Dialog open={detailDialogOpen} onClose={onCloseDetail} maxWidth="md" fullWidth>
        <DialogTitle>操作日志详情</DialogTitle>
        <DialogContent>
          <Box sx={{ mt: 1 }}>
            {currentLog && (
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                  <Typography variant="subtitle2">基本信息</Typography>
                </Box>
                <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 2 }}>
                  <Box>
                    <Typography variant="body2" color="text.secondary">ID</Typography>
                    <Typography variant="body1">{currentLog.id}</Typography>
                  </Box>
                  <Box>
                    <Typography variant="body2" color="text.secondary">操作时间</Typography>
                    <Typography variant="body1">{formatDate(currentLog.created_at)}</Typography>
                  </Box>
                  <Box>
                    <Typography variant="body2" color="text.secondary">操作者</Typography>
                    <Typography variant="body1">{currentLog.actor_name || '-'}</Typography>
                  </Box>
                  <Box>
                    <Typography variant="body2" color="text.secondary">操作者类型</Typography>
                    <Chip
                      label={getActorTypeLabel(currentLog.actor_type)}
                      size="small"
                    />
                  </Box>
                  <Box>
                    <Typography variant="body2" color="text.secondary">操作类型</Typography>
                    <Typography variant="body1">{currentLog.action_category}</Typography>
                  </Box>
                  <Box>
                    <Typography variant="body2" color="text.secondary">目标项目</Typography>
                    <Typography variant="body1">{currentLog.target_project || '-'}</Typography>
                  </Box>
                  <Box>
                    <Typography variant="body2" color="text.secondary">状态</Typography>
                    <Chip
                      label={getStatusLabel(currentLog.status)}
                      color={getStatusColor(currentLog.status)}
                      size="small"
                    />
                  </Box>
                  <Box>
                    <Typography variant="body2" color="text.secondary">IP 地址</Typography>
                    <Typography variant="body1">{currentLog.ip_address || '-'}</Typography>
                  </Box>
                </Box>

                <Divider sx={{ my: 1 }} />

                <Box>
                  <Typography variant="subtitle2" sx={{ mb: 1 }}>操作详情</Typography>
                  <Paper sx={{ p: 2, bgcolor: 'background.default' }}>
                    <pre style={{ margin: 0, whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>
                      {JSON.stringify(currentLog.action_details, null, 2)}
                    </pre>
                  </Paper>
                </Box>

                {currentLog.output_log && (
                  <>
                    <Divider sx={{ my: 1 }} />
                    <Box>
                      <Typography variant="subtitle2" sx={{ mb: 1 }}>输出日志</Typography>
                      <Paper sx={{ p: 2, bgcolor: 'background.default' }}>
                        <pre style={{ margin: 0, whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>
                          {currentLog.output_log}
                        </pre>
                      </Paper>
                    </Box>
                  </>
                )}
              </Box>
            )}
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={onCloseDetail}>关闭</Button>
        </DialogActions>
      </Dialog>

      <Dialog open={deleteDialogOpen} onClose={onCloseDelete}>
        <DialogTitle>确认删除</DialogTitle>
        <DialogContent>
          <Typography>
            确定要删除选中的 {selectedIds.length} 条操作日志吗？此操作不可恢复。
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
