'use client';

import {
  Box,
  Typography,
  Container,
  Paper,
} from '@mui/material';
import ProtectedRoute from '@/components/protected-route';
import MainLayout from '@/components/main-layout';


export default function SettingsPage() {
  return (
    <ProtectedRoute>
      <MainLayout>
        <Container maxWidth="lg">
          <Typography variant="h4" component="h1" gutterBottom>
            系统设置
          </Typography>
          
          <Paper sx={{ p: 3, textAlign: 'center' }}>
            <Typography variant="h6" color="text.secondary">
              系统设置功能开发中...
            </Typography>
          </Paper>
        </Container>
      </MainLayout>
    </ProtectedRoute>
  );
}
