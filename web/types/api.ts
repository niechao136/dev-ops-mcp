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
  created_at: string;
}

export interface AuthState {
  token: string | null;
  user: UserInfo | null;
  isAuthenticated: boolean;
  isLoading: boolean;
}

// Project types
export interface ProjectInfo {
  id: number;
  name: string;
  description?: string;
  work_dir: string;
  is_active: boolean;
  command_count: number;
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
}

export interface CommandAdd {
  project_id: number;
  action_type: string;
  description?: string;
  shell_command: string;
  timeout: number;
}

export interface CommandUpdate {
  action_type?: string;
  description?: string;
  shell_command?: string;
  timeout?: number;
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
