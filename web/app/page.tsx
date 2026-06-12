'use client';

import {
  Box,
  Card,
  CardContent,
  Typography,
  Container,
} from '@mui/material';
import {
  Dashboard,
  Storage,
  Security,
  Build,
} from '@mui/icons-material';
import ProtectedRoute from '@/components/protected-route';
import MainLayout from '@/components/main-layout';


const stats = [
  {
    title: '项目总数',
    value: '0',
    icon: <Storage sx={{ fontSize: 40 }} />,
    color: '#1976d2',
  },
  {
    title: 'API Keys',
    value: '0',
    icon: <Security sx={{ fontSize: 40 }} />,
    color: '#dc004e',
  },
  {
    title: '运行中任务',
    value: '0',
    icon: <Build sx={{ fontSize: 40 }} />,
    color: '#ff9800',
  },
  {
    title: '系统状态',
    value: '正常',
    icon: <Dashboard sx={{ fontSize: 40 }} />,
    color: '#4caf50',
  },
];


export default function HomePage() {
  return (
    <ProtectedRoute>
      <MainLayout>
      <Container maxWidth="lg">
        <Typography variant="h4" gutterBottom sx={{ mb: 4 }}>
          仪表板
        </Typography>
        
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
