export interface ApiRequestOptions extends RequestInit {
  requireAuth?: boolean;
}


export interface PageParams {
  page?: number
  size?: number

  order_by?: string
  direction?: 'asc' | 'desc' | ''

  keyword?: string
}


export interface DataResult<T = string> {
  data?: T
  msg?: string
  status: number
}


export interface PageResult<T = string> {
  data: T[]
  total: number
  page?: number
  size?: number
}


// Auth types
export interface UserLogin {
  username: string;
  password: string;
}

export interface UserInfo {
  id: number;
  username: string;
  role: 'admin' | 'user';
  email?: string;
  is_active: boolean;
  created_at: string;
}

export interface UserAdd {
  username: string;
  email?: string;
  password: string;
  role: 'admin' | 'user';
}

export interface UserUpdate {
  username?: string;
  email?: string;
  role?: 'admin' | 'user';
  is_active?: boolean;
}

export interface UserPassword {
  password: string;
}

export interface AuthState {
  token: string | null;
  user: UserInfo | null;
  isAuthenticated: boolean;
  isLoading: boolean;
}

// Project types
export interface ProjectRunningTask {
  task_id: string;
  action: string;
  output_log: string;
  start_time?: string;
}

export interface ProjectInfo {
  id: number;
  name: string;
  description?: string;
  work_dir: string;
  is_active: boolean;
  command_count: number;
  health_status?: 'healthy' | 'unhealthy' | 'unknown';
  running_task?: ProjectRunningTask;
}

export interface ProjectAdd {
  name: string;
  description?: string;
  work_dir: string;
}

export interface ProjectUpdate {
  name?: string;
  description?: string;
  work_dir?: string;
  is_active?: boolean;
}

export interface CommandInfo {
  id: number;
  project_id: number;
  action_type: string;
  description?: string;
  shell_command: string;
  timeout: number;
  default_params?: Record<string, any>;
  work_dir?: string;
  is_health_check: boolean;
  requires_confirm: boolean;
}

export interface CommandAdd {
  project_id: number;
  action_type: string;
  description?: string;
  shell_command: string;
  timeout: number;
  default_params?: Record<string, any>;
  work_dir?: string;
  requires_confirm?: boolean;
}

export interface CommandUpdate {
  action_type?: string;
  description?: string;
  shell_command?: string;
  timeout?: number;
  default_params?: Record<string, any>;
  work_dir?: string;
  requires_confirm?: boolean;
}

export interface CommandExecute {
  project_name: string;
  action: string;
  params?: Record<string, any>;
}

export interface CommandExecuteResult {
  task_id: string;
  status: string;
  message: string;
}

export interface TaskInfo {
  task_id: string;
  project_name: string;
  action: string;
  status: 'pending' | 'running' | 'success' | 'failed' | 'timeout' | 'cancelled';
  output_log?: string;
  next_offset: number;
  start_time?: string;
  end_time?: string;
  timeout: number;
  created_at: string;
}

export interface TaskSubmitResult {
  task_id: string;
  status: string;
  message: string;
}

// API Key types
export interface ApiKeyInfo {
  id: number;
  token_name: string;
  token_prefix?: string;
  allowed_projects?: string[];
  is_active: boolean;
  created_by: number;
  created_by_name?: string;
}

export interface ApiKeyAdd {
  name: string;
  allowed_projects?: string[];
}

export interface ApiKeyUpdate {
  name?: string;
  allowed_projects?: string[];
  is_active?: boolean;
}

export interface ApiKeyCreated {
  id: number;
  name: string;
  key: string;
  prefix?: string;
}

export interface UserPassword {
  password: string;
}

export interface UserChangePassword {
  old_password: string;
  new_password: string;
}

// 操作日志类型
export interface AuditLogInfo {
  id: number;
  actor_type: string;
  actor_id: number;
  actor_name?: string;
  action_category: string;
  target_project?: string;
  action_details: Record<string, any>;
  status: string;
  output_log?: string;
  ip_address?: string;
  created_at: string;
}

export interface AuditLogQueryParams {
  page?: number;
  size?: number;
  keyword?: string;
  actor_type?: string;
  action_category?: string;
  status?: string;
  target_project?: string;
  order_by?: string;
  direction?: string;
}

export interface DashboardStats {
  project_count: number;
  api_key_count: number;
  user_count: number;
  audit_log_count: number;
}

export interface SystemMetrics {
  cpu_usage: number;
  mem_usage: number;
  mem_total_gb: number;
  mem_used_gb: number;
  disk_usage: number;
  disk_total_gb: number;
  disk_free_gb: number;
  node_name: string;
}

// 公共命令类型
export interface PublicCommandInfo {
  id: number;
  name: string;
  action_type: string;
  description?: string;
  shell_command: string;
  timeout: number;
  default_params?: Record<string, any>;
  tags?: string;
  is_active: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface PublicCommandAdd {
  name: string;
  action_type: string;
  description?: string;
  shell_command: string;
  timeout: number;
  default_params?: Record<string, any>;
  tags?: string;
}

export interface PublicCommandUpdate {
  name?: string;
  action_type?: string;
  description?: string;
  shell_command?: string;
  timeout?: number;
  default_params?: Record<string, any>;
  tags?: string;
  is_active?: boolean;
}

export interface PublicCommandImport {
  public_command_id: number;
  project_id: number;
}

export interface PublicCommandBatchImport {
  public_command_ids: number[];
  project_id: number;
}

// 自动化规则类型
export interface AutomationInfo {
  id: number;
  project_id: number;
  project_name: string;
  name: string;
  trigger_type: 'cron' | 'condition';
  cron_expression?: string;
  condition_script?: string;
  condition_interval?: number;
  command_id: number;
  command_action: string;
  command_description?: string;
  is_enabled: boolean;
  last_run_time?: string;
  last_run_status?: string;
  created_at: string;
  updated_at: string;
}

export interface AutomationAdd {
  project_id: number;
  name: string;
  trigger_type: 'cron' | 'condition';
  cron_expression?: string;
  condition_script?: string;
  condition_interval?: number;
  command_id: number;
  is_enabled?: boolean;
}

export interface AutomationUpdate {
  name?: string;
  trigger_type?: 'cron' | 'condition';
  cron_expression?: string;
  condition_script?: string;
  condition_interval?: number;
  command_id?: number;
  is_enabled?: boolean;
}
