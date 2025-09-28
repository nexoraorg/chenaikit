export interface BaseConfig {
  timeout?: number;
  retries?: number;
}

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  timestamp: string;
}
