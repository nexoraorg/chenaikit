import { ApiResponse } from '@chenaikit/core/src/types/common';

// Account types
export interface Account {
  id: string;
  name: string;
  email: string;
  publicKey: string;
  balance: number;
  createdAt: string;
  updatedAt: string;
  isActive: boolean;
}

export interface AccountCreationRequest {
  name: string;
  email: string;
  publicKey: string;
}

export interface Transaction {
  id: string;
  accountId: string;
  amount: number;
  type: 'credit' | 'debit';
  description: string;
  timestamp: string;
  fromAccount?: string;
  toAccount?: string;
  status: 'pending' | 'completed' | 'failed';
}

export interface PaginationQuery {
  page?: string;
  limit?: string;
  sortBy?: 'timestamp' | 'amount';
  sortOrder?: 'asc' | 'desc';
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    pages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
}

// API Response types
export interface AccountResponse extends ApiResponse<Account> {}
export interface AccountBalanceResponse extends ApiResponse<{ balance: number; accountId: string }> {}
export interface TransactionsResponse extends ApiResponse<PaginatedResponse<Transaction>> {}
export interface AccountCreationResponse extends ApiResponse<Account> {}

// Error types
export interface ValidationError {
  field: string;
  message: string;
}

export interface ApiError {
  code: string;
  message: string;
  details?: ValidationError[];
  timestamp: string;
}