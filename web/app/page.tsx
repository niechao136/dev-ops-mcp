'use client';

import {
  Box,
  Card,
  CardContent,
  Typography,
  Container,
  CircularProgress,
  LinearProgress,
  Chip,
  Tooltip,
  Alert,
} from '@mui/material';
import {
  Dashboard,
  Storage,
  Security,
  People,
  History,
  Monitor,
  Memory,
  CheckCircle,
  Error,
  Help,
} from '@mui/icons-material';
import { useQuery } from '@tanstack/react-query';
import ProtectedRoute from '@/components/protected-route';
import MainLayout from '@/components/main-layout';
import { apiService } from '@/services/api';
import type { SystemMetrics, ProjectInfo } from '@/types/api';


export default function HomePage() {
  const { data: statsData, isLoading: statsLoading } = useQuery({
    queryKey: ['dashboard-stats'],
    queryFn: () => apiService.getDashboardStats(),
  });

  const { data: metricsData, isLoading: metricsLoading } = useQuery({
    queryKey: ['system-metrics'],
    queryFn: () => apiService.getSystemMetrics(),
    refetchInterval: 5000,
  });

  const { data: projectsData, isLoading: projectsLoading } = useQuery({
    queryKey: ['dashboard-projects'],
    queryFn: () => apiService.getProjects({ page: 1, size: 20 }),
    refetchInterval: 30000,
  });

  const stats = [
    {
      title: '项目总数',
      value: statsData?.data?.project_count?.toString() || '0',
      icon: <Storage sx={{ fontSize: 40 }} />,
      color: '#1976d2',
    },
    {
      title: 'API Keys',
      value: statsData?.data?.api_key_count?.toString() || '0',
      icon: <Security sx={{ fontSize: 40 }} />,
      color: '#dc004e',
    },
    {
      title: '用户总数',
      value: statsData?.data?.user_count?.toString() || '0',
      icon: <People sx={{ fontSize: 40 }} />,
      color: '#9c27b0',
    },
    {
      title: '操作日志',
      value: statsData?.data?.audit_log_count?.toString() || '0',
      icon: <History sx={{ fontSize: 40 }} />,
      color: '#00bcd4',
    },
  ];

  const metrics = metricsData?.data;

  const getColor = (value: number): string => {
    if (value >= 90) return '#dc004e';
    if (value >= 75) return '#f57c00';
    return '#4caf50';
  };

  const getStatusText = (value: number): string => {
    if (value >= 90) return '警告';
    if (value >= 75) return '偏高';
    return '正常';
  };

  return (
    <ProtectedRoute>
      <MainLayout>
        <Container maxWidth="lg">
          <Typography variant="h4" gutterBottom sx={{ mb: 4 }}>
            仪表板
          </Typography>

          {statsLoading || metricsLoading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
              <CircularProgress />
            </Box>
          ) : (
            <>
              <Box sx={{
                display: 'grid',
                gridTemplateColumns: {
                  xs: '1fr',
                  sm: '1fr 1fr',
                  md: '1fr 1fr 1fr 1fr',
                },
                gap: 3,
              }}>
                {stats.map((stat, index) => (
                  <Card key={index} sx={{ height: '100%' }}>
                    <CardContent>
                      <Box sx={{ display: 'flex', alignItems: 'center' }}>
                        <Box sx={{ flexGrow: 1 }}>
                          <Typography variant="body2" color="text.secondary" gutterBottom>
                            {stat.title}
                          </Typography>
                          <Typography variant="h4" component="div">
                            {stat.value}
                          </Typography>
                        </Box>
                        <Box sx={{ color: stat.color }}>
                          {stat.icon}
                        </Box>
                      </Box>
                    </CardContent>
                  </Card>
                ))}
              </Box>

              <Box sx={{ mt: 4 }}>
                <Typography variant="h6" gutterBottom>
                  系统资源监控
                </Typography>
                <Box sx={{
                  display: 'grid',
                  gridTemplateColumns: {
                    xs: '1fr',
                    sm: '1fr 1fr',
                    md: '1fr 1fr 1fr',
                  },
                  gap: 3,
                }}>
                  <Card>
                    <CardContent>
                      <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                        <Monitor sx={{ fontSize: 32, color: '#1976d2' }} />
                        <Typography variant="body2" color="text.secondary" sx={{ ml: 2 }}>
                          CPU 使用率
                        </Typography>
                        <Typography
                          variant="body2"
                          sx={{ ml: 'auto', color: getColor(metrics?.cpu_usage || 0) }}
                        >
                          {getStatusText(metrics?.cpu_usage || 0)}
                        </Typography>
                      </Box>
                      <Typography variant="h5" component="div" sx={{ mb: 1 }}>
                        {metrics?.cpu_usage?.toFixed(1)}%
                      </Typography>
                      <LinearProgress
                        variant="determinate"
                        value={metrics?.cpu_usage || 0}
                        sx={{
                          height: 8,
                          borderRadius: 4,
                          backgroundColor: '#e0e0e0',
                          '& .MuiLinearProgress-bar': {
                            backgroundColor: getColor(metrics?.cpu_usage || 0),
                            borderRadius: 4,
                          },
                        }}
                      />
                    </CardContent>
                  </Card>

                  <Card>
                    <CardContent>
                      <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                        <Memory sx={{ fontSize: 32, color: '#9c27b0' }} />
                        <Typography variant="body2" color="text.secondary" sx={{ ml: 2 }}>
                          内存使用
                        </Typography>
                        <Typography
                          variant="body2"
                          sx={{ ml: 'auto', color: getColor(metrics?.mem_usage || 0) }}
                        >
                          {getStatusText(metrics?.mem_usage || 0)}
                        </Typography>
                      </Box>
                      <Typography variant="h5" component="div" sx={{ mb: 1 }}>
                        {metrics?.mem_usage?.toFixed(1)}%
                        <Typography variant="body2" color="text.secondary" component="span" sx={{ ml: 1 }}>
                          ({metrics?.mem_used_gb?.toFixed(1)}GB / {metrics?.mem_total_gb?.toFixed(1)}GB)
                        </Typography>
                      </Typography>
                      <LinearProgress
                        variant="determinate"
                        value={metrics?.mem_usage || 0}
                        sx={{
                          height: 8,
                          borderRadius: 4,
                          backgroundColor: '#e0e0e0',
                          '& .MuiLinearProgress-bar': {
                            backgroundColor: getColor(metrics?.mem_usage || 0),
                            borderRadius: 4,
                          },
                        }}
                      />
                    </CardContent>
                  </Card>

                  <Card>
                    <CardContent>
                      <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                        <Storage sx={{ fontSize: 32, color: '#4caf50' }} />
                        <Typography variant="body2" color="text.secondary" sx={{ ml: 2 }}>
                          磁盘空间
                        </Typography>
                        <Typography
                          variant="body2"
                          sx={{ ml: 'auto', color: getColor(metrics?.disk_usage || 0) }}
                        >
                          {getStatusText(metrics?.disk_usage || 0)}
                        </Typography>
                      </Box>
                      <Typography variant="h5" component="div" sx={{ mb: 1 }}>
                        {metrics?.disk_usage?.toFixed(1)}%
                        <Typography variant="body2" color="text.secondary" component="span" sx={{ ml: 1 }}>
                          ({metrics?.disk_free_gb?.toFixed(1)}GB / {metrics?.disk_total_gb?.toFixed(1)}GB)
                        </Typography>
                      </Typography>
                      <LinearProgress
                        variant="determinate"
                        value={metrics?.disk_usage || 0}
                        sx={{
                          height: 8,
                          borderRadius: 4,
                          backgroundColor: '#e0e0e0',
                          '& .MuiLinearProgress-bar': {
                            backgroundColor: getColor(metrics?.disk_usage || 0),
                            borderRadius: 4,
                          },
                        }}
                      />
                    </CardContent>
                  </Card>
                </Box>
                <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
                  节点: {metrics?.node_name || '-'} | 数据每 5 秒自动刷新
                </Typography>
              </Box>

              <Box sx={{ mt: 4 }}>
                <Typography variant="h6" gutterBottom>
                  项目健康状态
                </Typography>
                {projectsLoading ? (
                  <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
                    <CircularProgress />
                  </Box>
                ) : (
                  <Box sx={{
                    display: 'grid',
                    gridTemplateColumns: {
                      xs: '1fr',
                      sm: '1fr 1fr',
                      md: '1fr 1fr 1fr 1fr',
                    },
                    gap: 2,
                  }}>
                    {(projectsData?.data || []).map((project) => (
                      <Card key={project.id} sx={{ height: '100%' }}>
                        <CardContent>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                            <Box sx={{ flexGrow: 1 }}>
                              <Typography variant="subtitle1" sx={{ fontWeight: 'bold' }}>
                                {project.name}
                              </Typography>
                              {project.description && (
                                <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                                  {project.description}
                                </Typography>
                              )}
                            </Box>
                            <Chip
                              icon={project.health_status === 'healthy' ? <CheckCircle sx={{ fontSize: 16 }} /> :
                                project.health_status === 'unhealthy' ? <Error sx={{ fontSize: 16 }} /> :
                                  <Help sx={{ fontSize: 16 }} />}
                              label={project.health_status === 'healthy' ? '健康' :
                                project.health_status === 'unhealthy' ? '异常' : '未知'}
                              color={project.health_status === 'healthy' ? 'success' :
                                project.health_status === 'unhealthy' ? 'error' : 'default'}
                              size="small"
                            />
                          </Box>
                        </CardContent>
                      </Card>
                    ))}
                  </Box>
                )}
                {!projectsLoading && (projectsData?.data?.length || 0) === 0 && (
                  <Alert severity="info" sx={{ mt: 2 }}>
                    暂无项目，请创建项目并配置健康检查命令
                  </Alert>
                )}
                <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
                  数据每 30 秒自动刷新 | 健康状态基于配置的健康检查命令执行结果
                </Typography>
              </Box>
            </>
          )}

          <Box sx={{ mt: 4 }}>
            <Typography variant="h6" gutterBottom>
              欢迎使用 DevOps MCP 运维管理平台
            </Typography>
            <Typography variant="body1" color="text.secondary">
              这是一个基于 MCP 协议的运维管理平台，用于管理项目和自动化运维任务。
            </Typography>
          </Box>
        </Container>
      </MainLayout>
    </ProtectedRoute>
  );
}
