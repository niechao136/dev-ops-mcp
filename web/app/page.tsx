'use client';

import {
  Box,
  Card,
  CardContent,
  Typography,
  Container,
  CircularProgress,
} from '@mui/material';
import {
  Dashboard,
  Storage,
  Security,
  People,
  History,
} from '@mui/icons-material';
import { useQuery } from '@tanstack/react-query';
import ProtectedRoute from '@/components/protected-route';
import MainLayout from '@/components/main-layout';
import { apiService } from '@/services/api';


export default function HomePage() {
  const { data: statsData, isLoading } = useQuery({
    queryKey: ['dashboard-stats'],
    queryFn: () => apiService.getDashboardStats(),
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

  return (
    <ProtectedRoute>
      <MainLayout>
        <Container maxWidth="lg">
          <Typography variant="h4" gutterBottom sx={{ mb: 4 }}>
            仪表板
          </Typography>
          
          {isLoading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
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
