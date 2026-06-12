'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '@/stores/auth';
import { useRouter, usePathname } from 'next/navigation';
import { useEffect, useRef } from 'react';


export function useAuth() {
  return useAuthStore();
}


export function useLogin() {
  const queryClient = useQueryClient();
  const login = useAuthStore((state) => state.login);
  
  return useMutation({
    mutationFn: async ({ username, password }: { username: string; password: string }) => {
      return await login(username, password);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['auth'] });
    },
  });
}


export function useAuthCheck(required: boolean = true) {
  const { isAuthenticated, isLoading, initializeAuth } = useAuthStore();
  const router = useRouter();
  const pathname = usePathname();
  const initialized = useRef(false);

  useEffect(() => {
    if (!initialized.current) {
      initializeAuth();
      initialized.current = true;
    }
  }, [initializeAuth]);

  useEffect(() => {
    if (!isLoading) {
      if (required && !isAuthenticated && pathname !== '/login') {
        router.push('/login');
      } else if (isAuthenticated && pathname === '/login') {
        router.push('/');
      }
    }
  }, [isAuthenticated, isLoading, required, pathname, router]);

  return { isAuthenticated, isLoading };
}
