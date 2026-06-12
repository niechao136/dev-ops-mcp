'use client';

import { create } from 'zustand';
import type { AuthState, UserInfo } from '@/types/api';
import { saveToken, clearToken, getToken } from '@/utils/cookie';
import { apiService } from '@/services/api';


interface AuthStore extends AuthState {
  login: (username: string, password: string) => Promise<boolean>;
  logout: () => void;
  fetchUser: () => Promise<void>;
  initializeAuth: () => Promise<void>;
}


export const useAuthStore = create<AuthStore>((set, get) => ({
  token: null,
  user: null,
  isAuthenticated: false,
  isLoading: true, // 初始状态设置为 loading，避免过早的路由判断

  login: async (username: string, password: string) => {
    set({ isLoading: true });
    try {
      const result = await apiService.login({ username, password });
      
      if (result.status === 1 && result.data) {
        saveToken(result.data);
        set({ token: result.data, isAuthenticated: true, isLoading: false });
        
        // Fetch user info after login
        await get().fetchUser();
        return true;
      }
      
      set({ isLoading: false });
      return false;
    } catch (error) {
      console.error('Login error:', error);
      set({ isLoading: false });
      return false;
    }
  },

  logout: () => {
    clearToken();
    set({ token: null, user: null, isAuthenticated: false, isLoading: false });
  },

  fetchUser: async () => {
    try {
      const result = await apiService.getCurrentUser();
      
      if (result.status === 1 && result.data) {
        set({ user: result.data, isAuthenticated: true });
      } else {
        set({ user: null, isAuthenticated: false });
      }
    } catch (error) {
      console.error('Fetch user error:', error);
      set({ user: null, isAuthenticated: false });
    }
  },

  initializeAuth: async () => {
    const token = await getToken();
    
    if (token) {
      set({ token, isAuthenticated: true });
      await get().fetchUser();
    } else {
      set({ isAuthenticated: false });
    }
    
    set({ isLoading: false });
  },
}));
