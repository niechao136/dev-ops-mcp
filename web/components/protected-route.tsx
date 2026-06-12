'use client';

import { ReactNode } from 'react';
import { CircularProgress, Box } from '@mui/material';
import { useAuthCheck } from '@/hooks/auth-query';


interface ProtectedRouteProps {
  children: ReactNode;
  required?: boolean;
}


export default function ProtectedRoute({ children, required = true }: ProtectedRouteProps) {
  const { isAuthenticated, isLoading } = useAuthCheck(required);

  if (isLoading) {
    return (
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          minHeight: '100vh',
        }}
      >
        <CircularProgress />
      </Box>
    );
  }

  return <>{children}</>;
}
