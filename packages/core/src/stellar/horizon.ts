import axios, { AxiosInstance, AxiosRequestConfig, AxiosResponse } from 'axios';
import { EventEmitter } from 'events';

// TypeScript interfaces for Stellar Horizon API responses
export interface HorizonAccount {
  id: string;
  account_id: string;
  sequence: string;
  subentry_count: number;
  num_sponsoring: number;
  num_sponsored: number;
  inflation_destination?: string;
  home_domain?: string;
  last_modified_ledger: number;
  last_modified_time: string;
  thresholds: {
    low_threshold: number;
    med_threshold: number;
    high_threshold: number;
  };
  flags: {
    auth_required: boolean;
    auth_revocable: boolean;
    auth_immutable: boolean;
    auth_clawback_enabled: boolean;
  };
  balances: HorizonBalance[];
  signers: HorizonSigner[];
  data: Record<string, string>;
}

export interface HorizonBalance {
  balance: string;
  buying_liabilities: string;
  selling_liabilities: string;
  asset_type: string;
  asset_code?: string;
  asset_issuer?: string;
  limit?: string;
  is_authorized?: boolean;
  is_authorized_to_maintain_liabilities?: boolean;
  is_clawback_enabled?: boolean;
}

export interface HorizonSigner {
  weight: number;
  key: string;
  type: string;
}

export interface HorizonTransaction {
  id: string;
  paging_token: string;
  successful: boolean;
  hash: string;
  ledger: number;
  created_at: string;
  source_account: string;
  source_account_sequence: string;
  fee_account?: string;
  fee_charged: string;
  max_fee: string;
  operation_count: number;
  envelope_xdr: string;
  result_xdr: string;
  result_meta_xdr: string;
  fee_meta_xdr: string;
  memo_type: string;
  memo?: string;
  signatures: string[];
  valid_after?: string;
  valid_before?: string;
  operations: HorizonOperation[];
  effects: HorizonEffect[];
  precedes: string;
  succeeds: string;
}

export interface HorizonOperation {
  id: string;
  paging_token: string;
  transaction_successful: boolean;
  source_account: string;
  type: string;
  type_i: number;
  created_at: string;
  transaction_hash: string;
  asset_type?: string;
  asset_code?: string;
  asset_issuer?: string;
  from?: string;
  to?: string;
  amount?: string;
  [key: string]: any;
}

export interface HorizonEffect {
  id: string;
  paging_token: string;
  account: string;
  type: string;
  type_i: number;
  created_at: string;
  [key: string]: any;
}

export interface HorizonLedger {
  id: string;
  paging_token: string;
  hash: string;
  prev_hash: string;
  sequence: number;
  successful_transaction_count: number;
  failed_transaction_count: number;
  operation_count: number;
  tx_set_operation_count: number;
  closed_at: string;
  total_coins: string;
  fee_pool: string;
  base_fee_in_stroops: number;
  base_reserve_in_stroops: number;
  max_tx_set_size: number;
  protocol_version: number;
  header_xdr: string;
}

export interface HorizonPaymentOperation extends HorizonOperation {
  type: 'payment';
  from: string;
  to: string;
  asset_type: string;
  asset_code?: string;
  asset_issuer?: string;
  amount: string;
}

export interface PaginationOptions {
  cursor?: string;
  order?: 'asc' | 'desc';
  limit?: number;
}

export interface HorizonError {
  type: string;
  title: string;
  status: number;
  detail: string;
  instance: string;
  extras?: {
    result_codes?: {
      transaction?: string;
      operations?: string[];
    };
  };
}

export interface RateLimitConfig {
  requestsPerMinute: number;
  burstLimit: number;
  retryAfterMs: number;
}

export interface HorizonConfig {
  horizonUrl: string;
  networkPassphrase: string;
  apiKey?: string;
  rateLimit?: RateLimitConfig;
  timeout?: number;
  retryAttempts?: number;
  retryDelay?: number;
}

export class HorizonConnector extends EventEmitter {
  private httpClient: AxiosInstance;
  private config: HorizonConfig;
  private requestQueue: Array<() => Promise<any>> = [];
  private isProcessingQueue = false;
  private lastRequestTime = 0;
  private requestCount = 0;
  private rateLimitResetTime = 0;

  constructor(config: HorizonConfig) {
    super();
    this.config = {
      timeout: 30000,
      retryAttempts: 3,
      retryDelay: 1000,
      rateLimit: {
        requestsPerMinute: 60,
        burstLimit: 10,
        retryAfterMs: 1000
      },
      ...config
    };

    this.httpClient = axios.create({
      baseURL: this.config.horizonUrl,
      timeout: this.config.timeout,
      headers: {
        'Content-Type': 'application/json',
        ...(this.config.apiKey && { 'Authorization': `Bearer ${this.config.apiKey}` })
      }
    });

    this.setupInterceptors();
  }

  private setupInterceptors(): void {
    // Request interceptor for rate limiting
    this.httpClient.interceptors.request.use(
      async (config) => {
        await this.enforceRateLimit();
        return config;
      },
      (error) => Promise.reject(error)
    );

    // Response interceptor for error handling
    this.httpClient.interceptors.response.use(
      (response) => response,
      async (error) => {
        if (error.response?.status === 429) {
          // Rate limited - wait and retry
          const retryAfter = error.response.headers['retry-after'];
          const delay = retryAfter ? parseInt(retryAfter) * 1000 : this.config.rateLimit!.retryAfterMs;
          await this.delay(delay);
          return this.httpClient.request(error.config);
        }
        return Promise.reject(this.handleError(error));
      }
    );
  }

  private async enforceRateLimit(): Promise<void> {
    const now = Date.now();
    const timeSinceLastRequest = now - this.lastRequestTime;
    
    // Reset counter if a minute has passed
    if (timeSinceLastRequest > 60000) {
      this.requestCount = 0;
      this.rateLimitResetTime = now + 60000;
    }

    // Check if we're within rate limits
    if (this.requestCount >= this.config.rateLimit!.requestsPerMinute) {
      const waitTime = this.rateLimitResetTime - now;
      if (waitTime > 0) {
        await this.delay(waitTime);
        this.requestCount = 0;
        this.rateLimitResetTime = now + 60000;
      }
    }

    this.lastRequestTime = now;
    this.requestCount++;
  }

  private async delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  private handleError(error: any): Error {
    if (error.response?.data) {
      const horizonError = error.response.data as HorizonError;
      return new Error(`Horizon API Error (${horizonError.status}): ${horizonError.detail}`);
    }
    if (error.code === 'ECONNABORTED') {
      return new Error('Request timeout - Horizon API is not responding');
    }
    if (error.code === 'ENOTFOUND') {
      return new Error('Network error - Cannot reach Horizon API');
    }
    return new Error(`Request failed: ${error.message}`);
  }

  private async makeRequest<T>(endpoint: string, params?: Record<string, any>): Promise<T> {
    try {
      const response: AxiosResponse<T> = await this.httpClient.get(endpoint, { params });
      return response.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  private async makeRequestWithRetry<T>(
    endpoint: string, 
    params?: Record<string, any>,
    attempt: number = 1
  ): Promise<T> {
    try {
      return await this.makeRequest<T>(endpoint, params);
    } catch (error) {
      if (attempt < this.config.retryAttempts!) {
        await this.delay(this.config.retryDelay! * attempt);
        return this.makeRequestWithRetry<T>(endpoint, params, attempt + 1);
      }
      throw error;
    }
  }

  // Account data fetching methods
  async getAccount(accountId: string): Promise<HorizonAccount> {
    if (!this.isValidStellarAddress(accountId)) {
      throw new Error('Invalid Stellar address format');
    }

    try {
      return await this.makeRequestWithRetry<HorizonAccount>(`/accounts/${accountId}`);
    } catch (error) {
      if ((error as Error).message.includes('404')) {
        throw new Error(`Account not found: ${accountId}`);
      }
      throw error;
    }
  }

  async getAccountBalances(accountId: string): Promise<HorizonBalance[]> {
    const account = await this.getAccount(accountId);
    return account.balances;
  }

  async getAccountTransactions(
    accountId: string, 
    options: PaginationOptions = {}
  ): Promise<{ records: HorizonTransaction[]; next?: string; prev?: string }> {
    if (!this.isValidStellarAddress(accountId)) {
      throw new Error('Invalid Stellar address format');
    }

    const params: Record<string, any> = {};
    if (options.cursor) params.cursor = options.cursor;
    if (options.order) params.order = options.order;
    if (options.limit) params.limit = Math.min(options.limit, 200); // Horizon limit

    const response = await this.makeRequestWithRetry<{
      _embedded: { records: HorizonTransaction[] };
      _links: { next?: { href: string }; prev?: { href: string } };
    }>(`/accounts/${accountId}/transactions`, params);

    return {
      records: response._embedded.records,
      next: response._links.next?.href,
      prev: response._links.prev?.href
    };
  }

  async getAccountPayments(
    accountId: string, 
    options: PaginationOptions = {}
  ): Promise<{ records: HorizonPaymentOperation[]; next?: string; prev?: string }> {
    if (!this.isValidStellarAddress(accountId)) {
      throw new Error('Invalid Stellar address format');
    }

    const params: Record<string, any> = {};
    if (options.cursor) params.cursor = options.cursor;
    if (options.order) params.order = options.order;
    if (options.limit) params.limit = Math.min(options.limit, 200);

    const response = await this.makeRequestWithRetry<{
      _embedded: { records: HorizonPaymentOperation[] };
      _links: { next?: { href: string }; prev?: { href: string } };
    }>(`/accounts/${accountId}/payments`, params);

    return {
      records: response._embedded.records,
      next: response._links.next?.href,
      prev: response._links.prev?.href
    };
  }

  // Transaction methods
  async getTransaction(transactionHash: string): Promise<HorizonTransaction> {
    if (!this.isValidTransactionHash(transactionHash)) {
      throw new Error('Invalid transaction hash format');
    }

    try {
      return await this.makeRequestWithRetry<HorizonTransaction>(`/transactions/${transactionHash}`);
    } catch (error) {
      if ((error as Error).message.includes('404')) {
        throw new Error(`Transaction not found: ${transactionHash}`);
      }
      throw error;
    }
  }

  async getTransactionOperations(
    transactionHash: string,
    options: PaginationOptions = {}
  ): Promise<{ records: HorizonOperation[]; next?: string; prev?: string }> {
    if (!this.isValidTransactionHash(transactionHash)) {
      throw new Error('Invalid transaction hash format');
    }

    const params: Record<string, any> = {};
    if (options.cursor) params.cursor = options.cursor;
    if (options.order) params.order = options.order;
    if (options.limit) params.limit = Math.min(options.limit, 200);

    const response = await this.makeRequestWithRetry<{
      _embedded: { records: HorizonOperation[] };
      _links: { next?: { href: string }; prev?: { href: string } };
    }>(`/transactions/${transactionHash}/operations`, params);

    return {
      records: response._embedded.records,
      next: response._links.next?.href,
      prev: response._links.prev?.href
    };
  }

  async getTransactionEffects(
    transactionHash: string,
    options: PaginationOptions = {}
  ): Promise<{ records: HorizonEffect[]; next?: string; prev?: string }> {
    if (!this.isValidTransactionHash(transactionHash)) {
      throw new Error('Invalid transaction hash format');
    }

    const params: Record<string, any> = {};
    if (options.cursor) params.cursor = options.cursor;
    if (options.order) params.order = options.order;
    if (options.limit) params.limit = Math.min(options.limit, 200);

    const response = await this.makeRequestWithRetry<{
      _embedded: { records: HorizonEffect[] };
      _links: { next?: { href: string }; prev?: { href: string } };
    }>(`/transactions/${transactionHash}/effects`, params);

    return {
      records: response._embedded.records,
      next: response._links.next?.href,
      prev: response._links.prev?.href
    };
  }

  // Ledger methods
  async getLedger(ledgerSequence: number): Promise<HorizonLedger> {
    try {
      return await this.makeRequestWithRetry<HorizonLedger>(`/ledgers/${ledgerSequence}`);
    } catch (error) {
      if ((error as Error).message.includes('404')) {
        throw new Error(`Ledger not found: ${ledgerSequence}`);
      }
      throw error;
    }
  }

  async getLedgers(options: PaginationOptions = {}): Promise<{ records: HorizonLedger[]; next?: string; prev?: string }> {
    const params: Record<string, any> = {};
    if (options.cursor) params.cursor = options.cursor;
    if (options.order) params.order = options.order;
    if (options.limit) params.limit = Math.min(options.limit, 200);

    const response = await this.makeRequestWithRetry<{
      _embedded: { records: HorizonLedger[] };
      _links: { next?: { href: string }; prev?: { href: string } };
    }>('/ledgers', params);

    return {
      records: response._embedded.records,
      next: response._links.next?.href,
      prev: response._links.prev?.href
    };
  }

  // Network info methods
  async getNetworkInfo(): Promise<any> {
    return await this.makeRequestWithRetry('/');
  }

  async getFeeStats(): Promise<any> {
    return await this.makeRequestWithRetry('/fee_stats');
  }

  // Utility methods
  private isValidStellarAddress(address: string): boolean {
    // Basic validation for Stellar address format
    return /^[G-Z][A-Z0-9]{55}$/.test(address);
  }

  private isValidTransactionHash(hash: string): boolean {
    // Basic validation for transaction hash format
    return /^[a-f0-9]{64}$/.test(hash);
  }

  // Event streaming methods (for real-time updates)
  async streamAccount(accountId: string, callback: (data: any) => void): Promise<void> {
    if (!this.isValidStellarAddress(accountId)) {
      throw new Error('Invalid Stellar address format');
    }

    // This would typically use Server-Sent Events or WebSocket
    // For now, we'll implement a polling mechanism
    const pollInterval = 5000; // 5 seconds
    
    const poll = async () => {
      try {
        const account = await this.getAccount(accountId);
        callback(account);
      } catch (error) {
        this.emit('error', error as Error);
      }
    };

    // Start polling
    poll();
    const intervalId = setInterval(poll, pollInterval);

    // Return cleanup function
    return new Promise<void>((resolve) => {
      this.once('stop-streaming', () => {
        clearInterval(intervalId);
        resolve();
      });
    });
  }

  stopStreaming(): void {
    this.emit('stop-streaming');
  }

  // Health check
  async healthCheck(): Promise<boolean> {
    try {
      await this.getNetworkInfo();
      return true;
    } catch {
      return false;
    }
  }
}
