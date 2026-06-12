'use client';

import {
  Box,
  Typography,
  Container,
  Paper,
  Button,
} from '@mui/material';
import { Add } from '@mui/icons-material';
import ProtectedRoute from '@/components/protected-route';
import MainLayout from '@/components/main-layout';


export default function ProjectsPage() {
  return (
    <ProtectedRoute>
      <MainLayout>
        <Container maxWidth="lg">
          <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 3 }}>
            <Typography variant="h4" component="h1">
              项目管理
            </Typography>
            <Button variant="contained" startIcon={<Add />}>
              添加项目
            </Button>
          </Box>
          
          <Paper sx={{ p: 3, textAlign: 'center' }}>
            <Typography variant="h6" color="text.secondary">
              项目管理功能开发中...
            </Typography>
          </Paper>
        </Container>
      </MainLayout>
    </ProtectedRoute>
  );
}
