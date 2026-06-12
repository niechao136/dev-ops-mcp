import { getToken, clearToken, saveToken } from '@/utils/cookie';
import type { 
  DataResult, UserLogin, UserInfo, PageResult, 
  ProjectInfo, ProjectAdd, ProjectUpdate, 
  CommandInfo, CommandAdd, CommandUpdate 
} from '@/types/api';

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

  // Project API
  async getProjects(params?: { 
    page?: number, 
    size?: number, 
    keyword?: string, 
    order_by?: string, 
    direction?: string 
  }): Promise<PageResult<ProjectInfo>> {
    const query = new URLSearchParams();
    if (params?.page) query.append('page', params.page.toString());
    if (params?.size) query.append('size', params.size.toString());
    if (params?.keyword) query.append('keyword', params.keyword);
    if (params?.order_by) query.append('order_by', params.order_by);
    if (params?.direction) query.append('direction', params.direction);
    
    const url = `/projects${query.toString() ? '?' + query.toString() : ''}`;
    return this.request<PageResult<ProjectInfo>>(url);
  }

  async getProject(id: number): Promise<DataResult<ProjectInfo>> {
    return this.request<DataResult<ProjectInfo>>(`/projects/${id}`);
  }

  async createProject(data: ProjectAdd): Promise<DataResult<number>> {
    return this.request<DataResult<number>>('/projects', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateProject(id: number, data: ProjectUpdate): Promise<DataResult<boolean>> {
    return this.request<DataResult<boolean>>(`/projects/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async deleteProjects(ids: number[]): Promise<DataResult<boolean>> {
    return this.request<DataResult<boolean>>('/projects', {
      method: 'DELETE',
      body: JSON.stringify({ ids }),
    });
  }

  // Command API
  async getProjectCommands(projectId: number): Promise<PageResult<CommandInfo>> {
    return this.request<PageResult<CommandInfo>>(`/projects/${projectId}/commands`);
  }

  async createCommand(data: CommandAdd): Promise<DataResult<number>> {
    return this.request<DataResult<number>>(`/projects/${data.project_id}/commands`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateCommand(id: number, data: CommandUpdate): Promise<DataResult<boolean>> {
    return this.request<DataResult<boolean>>(`/projects/commands/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async deleteCommands(ids: number[]): Promise<DataResult<boolean>> {
    return this.request<DataResult<boolean>>('/projects/commands', {
      method: 'DELETE',
      body: JSON.stringify({ ids }),
    });
  }
}

export const apiService = new ApiService(API_BASE_URL);
