import { getToken, clearToken, saveToken } from '@/utils/cookie';
import type { DataResult, UserLogin, UserInfo } from '@/types/api';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || '/api';


class ApiService {
  private baseUrl: string;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl;
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {},
    requireAuth: boolean = true
  ): Promise<T> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...options.headers as Record<string, string>,
    };

    if (requireAuth) {
      const token = await getToken();
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }
    }

    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      ...options,
      headers,
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    return response.json();
  }

  // Auth API
  async login(credentials: UserLogin): Promise<DataResult<string>> {
    return this.request<DataResult<string>>(
      '/auth/login',
      {
        method: 'POST',
        body: JSON.stringify(credentials),
      },
      false
    );
  }

  async getCurrentUser(): Promise<DataResult<UserInfo | null>> {
    return this.request<DataResult<UserInfo | null>>('/user/me');
  }
}

export const apiService = new ApiService(API_BASE_URL);
