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
