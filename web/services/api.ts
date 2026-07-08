import { getToken, clearToken, saveToken } from '@/utils/cookie';
import {
  DataResult, UserLogin, UserInfo, PageResult,
  ProjectInfo, ProjectAdd, ProjectUpdate,
  CommandInfo, CommandAdd, CommandUpdate, CommandExecute, CommandExecuteResult,
  ApiKeyInfo, ApiKeyAdd, ApiKeyUpdate, ApiKeyCreated,
  UserAdd, UserUpdate, UserPassword, UserChangePassword,
  AuditLogInfo, AuditLogQueryParams,
  DashboardStats, SystemMetrics,
  PublicCommandInfo, PublicCommandAdd, PublicCommandUpdate, PublicCommandImport, PublicCommandBatchImport,
  TaskInfo, TaskSubmitResult
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
  async getProjectCommands(projectId: number, params?: {
    page?: number;
    size?: number;
  }): Promise<PageResult<CommandInfo>> {
    const query = new URLSearchParams();
    if (params?.page) query.set('page', params.page.toString());
    if (params?.size) query.set('size', params.size.toString());
    const queryString = query.toString();
    const url = queryString ? `/projects/${projectId}/commands?${queryString}` : `/projects/${projectId}/commands`;
    return this.request<PageResult<CommandInfo>>(url);
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

  async executeCommand(data: CommandExecute): Promise<DataResult<CommandExecuteResult>> {
    return this.request<DataResult<CommandExecuteResult>>('/projects/execute', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  // API Key API
  async getApiKeys(params?: {
    page?: number,
    size?: number,
    keyword?: string,
    order_by?: string,
    direction?: string
  }): Promise<PageResult<ApiKeyInfo>> {
    const query = new URLSearchParams();
    if (params?.page) query.append('page', params.page.toString());
    if (params?.size) query.append('size', params.size.toString());
    if (params?.keyword) query.append('keyword', params.keyword);
    if (params?.order_by) query.append('order_by', params.order_by);
    if (params?.direction) query.append('direction', params.direction);

    const url = `/api_key${query.toString() ? '?' + query.toString() : ''}`;
    return this.request<PageResult<ApiKeyInfo>>(url);
  }

  async getApiKey(id: number): Promise<DataResult<ApiKeyInfo>> {
    return this.request<DataResult<ApiKeyInfo>>(`/api_key/${id}`);
  }

  async createApiKey(data: ApiKeyAdd): Promise<DataResult<ApiKeyCreated>> {
    return this.request<DataResult<ApiKeyCreated>>('/api_key', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateApiKey(id: number, data: ApiKeyUpdate): Promise<DataResult<boolean>> {
    return this.request<DataResult<boolean>>(`/api_key/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async deleteApiKeys(ids: number[]): Promise<DataResult<boolean>> {
    return this.request<DataResult<boolean>>('/api_key', {
      method: 'DELETE',
      body: JSON.stringify({ ids }),
    });
  }

  async regenerateApiKey(id: number): Promise<DataResult<ApiKeyCreated>> {
    return this.request<DataResult<ApiKeyCreated>>(`/api_key/${id}/regenerate`, {
      method: 'POST',
    });
  }

  async getFullApiKey(id: number): Promise<DataResult<string>> {
    return this.request<DataResult<string>>(`/api_key/${id}/get_key`, {
      method: 'POST',
    });
  }

  async getApiKeysCount(): Promise<DataResult<number>> {
    return this.request<DataResult<number>>('/api_key/count');
  }

  // User API
  async getUsers(params?: {
    page?: number,
    size?: number,
    keyword?: string,
    order_by?: string,
    direction?: string
  }): Promise<PageResult<UserInfo>> {
    const query = new URLSearchParams();
    if (params?.page) query.append('page', params.page.toString());
    if (params?.size) query.append('size', params.size.toString());
    if (params?.keyword) query.append('keyword', params.keyword);
    if (params?.order_by) query.append('order_by', params.order_by);
    if (params?.direction) query.append('direction', params.direction);

    const url = `/user${query.toString() ? '?' + query.toString() : ''}`;
    return this.request<PageResult<UserInfo>>(url);
  }

  async getUser(id: number): Promise<DataResult<UserInfo>> {
    return this.request<DataResult<UserInfo>>(`/user/${id}`);
  }

  async changeMyPassword(data: UserChangePassword): Promise<DataResult> {
    return this.request<DataResult>('/user/me/password', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async createUser(data: UserAdd): Promise<DataResult<UserInfo>> {
    return this.request<DataResult<UserInfo>>('/user', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateUser(id: number, data: UserUpdate): Promise<DataResult<UserInfo>> {
    return this.request<DataResult<UserInfo>>(`/user/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async changeUserPassword(id: number, data: UserPassword): Promise<DataResult> {
    return this.request<DataResult>(`/user/${id}/password`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async toggleUserStatus(id: number): Promise<DataResult<UserInfo>> {
    return this.request<DataResult<UserInfo>>(`/user/${id}/toggle`, {
      method: 'PUT',
    });
  }

  async deleteUsers(ids: number[]): Promise<DataResult> {
    return this.request<DataResult>('/user', {
      method: 'DELETE',
      body: JSON.stringify({ ids }),
    });
  }

  async getUsersCount(): Promise<DataResult<number>> {
    return this.request<DataResult<number>>('/user/count');
  }

  // 公共命令 API
  async getPublicCommands(params?: {
    page?: number;
    size?: number;
    keyword?: string;
    tags?: string;
    order_by?: string;
    direction?: string;
  }): Promise<PageResult<PublicCommandInfo>> {
    const query = new URLSearchParams();
    if (params?.page) query.set('page', params.page.toString());
    if (params?.size) query.set('size', params.size.toString());
    if (params?.keyword) query.set('keyword', params.keyword);
    if (params?.tags) query.set('tags', params.tags);
    if (params?.order_by) query.set('order_by', params.order_by);
    if (params?.direction) query.set('direction', params.direction);
    const queryString = query.toString();
    const url = `/public_commands${queryString ? '?' + queryString : ''}`;
    return this.request<PageResult<PublicCommandInfo>>(url);
  }

  async getPublicCommand(id: number): Promise<DataResult<PublicCommandInfo>> {
    return this.request<DataResult<PublicCommandInfo>>(`/public_commands/${id}`);
  }

  async createPublicCommand(data: PublicCommandAdd): Promise<DataResult<number>> {
    return this.request<DataResult<number>>('/public_commands', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updatePublicCommand(id: number, data: PublicCommandUpdate): Promise<DataResult<PublicCommandInfo>> {
    return this.request<DataResult<PublicCommandInfo>>(`/public_commands/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async deletePublicCommands(ids: number[]): Promise<DataResult> {
    return this.request<DataResult>('/public_commands', {
      method: 'DELETE',
      body: JSON.stringify({ ids }),
    });
  }

  async importPublicCommand(data: PublicCommandImport): Promise<DataResult<number>> {
    return this.request<DataResult<number>>('/public_commands/import', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async batchImportPublicCommands(data: PublicCommandBatchImport): Promise<DataResult<number[]>> {
    return this.request<DataResult<number[]>>('/public_commands/batch_import', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  // Audit Log API
  async getAuditLogs(params?: AuditLogQueryParams): Promise<PageResult<AuditLogInfo>> {
    const query = new URLSearchParams();
    if (params?.page) query.append('page', params.page.toString());
    if (params?.size) query.append('size', params.size.toString());
    if (params?.keyword) query.append('keyword', params.keyword);
    if (params?.actor_type) query.append('actor_type', params.actor_type);
    if (params?.action_category) query.append('action_category', params.action_category);
    if (params?.status) query.append('status', params.status);
    if (params?.target_project) query.append('target_project', params.target_project);
    if (params?.order_by) query.append('order_by', params.order_by);
    if (params?.direction) query.append('direction', params.direction);

    const url = `/audit_log${query.toString() ? '?' + query.toString() : ''}`;
    return this.request<PageResult<AuditLogInfo>>(url);
  }

  async getAuditLog(id: number): Promise<DataResult<AuditLogInfo>> {
    return this.request<DataResult<AuditLogInfo>>(`/audit_log/${id}`);
  }

  async deleteAuditLogs(ids: number[]): Promise<DataResult<boolean>> {
    return this.request<DataResult<boolean>>('/audit_log', {
      method: 'DELETE',
      body: JSON.stringify({ ids }),
    });
  }

  async getAuditLogsCount(): Promise<DataResult<number>> {
    return this.request<DataResult<number>>('/audit_log/count');
  }

  // Dashboard API
  async getDashboardStats(): Promise<DataResult<DashboardStats>> {
    return this.request<DataResult<DashboardStats>>('/dashboard/stats');
  }

  async getSystemMetrics(): Promise<DataResult<SystemMetrics>> {
    return this.request<DataResult<SystemMetrics>>('/dashboard/metrics');
  }

  // Task API
  async executeTask(data: CommandExecute): Promise<DataResult<TaskSubmitResult>> {
    return this.request<DataResult<TaskSubmitResult>>('/tasks/execute', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async getTaskStatus(taskId: string, logOffset?: number): Promise<DataResult<TaskInfo>> {
    const url = logOffset !== undefined && logOffset > 0
      ? `/tasks/${taskId}?log_offset=${logOffset}`
      : `/tasks/${taskId}`;
    return this.request<DataResult<TaskInfo>>(url);
  }

  async getTasks(params?: {
    project_name?: string;
    status?: string;
    page?: number;
    size?: number;
  }): Promise<PageResult<TaskInfo>> {
    const query = new URLSearchParams();
    if (params?.project_name) query.set('project_name', params.project_name);
    if (params?.status) query.set('status', params.status);
    if (params?.page) query.set('page', params.page.toString());
    if (params?.size) query.set('size', params.size.toString());
    const queryString = query.toString();
    const url = `/tasks${queryString ? '?' + queryString : ''}`;
    return this.request<PageResult<TaskInfo>>(url);
  }

  async cancelTask(taskId: string): Promise<DataResult<boolean>> {
    return this.request<DataResult<boolean>>(`/tasks/${taskId}/cancel`, {
      method: 'POST',
    });
  }

  async subscribeTaskStream(taskId: string, callback: (data: string, status?: string) => void): Promise<() => void> {
    const token = await getToken();
    const url = new URL(`${this.baseUrl}/tasks/${taskId}/stream`);
    if (token) {
      url.searchParams.set('token', token);
    }
    const eventSource = new EventSource(url.toString());

    eventSource.onmessage = (event) => {
      try {
        const parsed = JSON.parse(event.data);
        if (parsed.error) {
          callback('', 'error');
          eventSource.close();
        } else if (parsed.status && parsed.end) {
          callback('', parsed.status);
          eventSource.close();
        } else {
          callback(event.data);
        }
      } catch {
        callback(event.data);
      }
    };

    eventSource.onerror = () => {
      eventSource.close();
    };

    return () => eventSource.close();
  }
}

export const apiService = new ApiService(API_BASE_URL);
