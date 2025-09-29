/**
 * AI services client
 */

import axios, { AxiosInstance, AxiosRequestConfig } from 'axios';
import { ConfigManager } from '../config';
import { 
  UserProfile, 
  Quest, 
  UserProgress, 
  ApiResponse, 
  APIError 
} from '../types';

/**
 * AI client for backend API operations
 */
export class AIClient {
  private http: AxiosInstance;
  private config: ConfigManager;
  private initialized = false;

  constructor(config: ConfigManager) {
    this.config = config;
    this.http = axios.create({
      baseURL: this.config.get('ai').apiBaseUrl,
      timeout: this.config.get('ai').timeout || 30000,
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'ChenAIKit-Core/0.1.0',
      },
    });

    this.setupInterceptors();
  }

  /**
   * Initialize the AI client
   */
  async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }

    try {
      // Set API key if provided
      const apiKey = this.config.get('ai').apiKey;
      if (apiKey) {
        this.http.defaults.headers.common['Authorization'] = `Bearer ${apiKey}`;
      }

      // Test connection
      await this.http.get('/health');
      
      this.initialized = true;
    } catch (error) {
      throw new APIError(`Failed to initialize AI client: ${error}`, 0, error);
    }
  }

  /**
   * Check if client is initialized
   */
  isInitialized(): boolean {
    return this.initialized;
  }

  /**
   * Get user profile
   */
  async getUserProfile(userId: string): Promise<ApiResponse<UserProfile>> {
    this.ensureInitialized();
    
    try {
      const response = await this.http.get(`/api/users/${userId}/profile`);
      return {
        success: true,
        data: response.data,
        timestamp: new Date(),
      };
    } catch (error) {
      return this.handleError(error, 'Failed to get user profile');
    }
  }

  /**
   * Update user profile
   */
  async updateUserProfile(userId: string, updates: Partial<UserProfile>): Promise<ApiResponse<UserProfile>> {
    this.ensureInitialized();
    
    try {
      const response = await this.http.patch(`/api/users/${userId}/profile`, updates);
      return {
        success: true,
        data: response.data,
        timestamp: new Date(),
      };
    } catch (error) {
      return this.handleError(error, 'Failed to update user profile');
    }
  }

  /**
   * Get user progress
   */
  async getUserProgress(userId: string): Promise<ApiResponse<UserProgress>> {
    this.ensureInitialized();
    
    try {
      const response = await this.http.get(`/api/users/${userId}/progress`);
      return {
        success: true,
        data: response.data,
        timestamp: new Date(),
      };
    } catch (error) {
      return this.handleError(error, 'Failed to get user progress');
    }
  }

  /**
   * Get available quests
   */
  async getQuests(category?: string, difficulty?: string): Promise<ApiResponse<Quest[]>> {
    this.ensureInitialized();
    
    try {
      const params: any = {};
      if (category) params.category = category;
      if (difficulty) params.difficulty = difficulty;

      const response = await this.http.get('/api/quests', { params });
      return {
        success: true,
        data: response.data,
        timestamp: new Date(),
      };
    } catch (error) {
      return this.handleError(error, 'Failed to get quests');
    }
  }

  /**
   * Get quest by ID
   */
  async getQuest(questId: string): Promise<ApiResponse<Quest>> {
    this.ensureInitialized();
    
    try {
      const response = await this.http.get(`/api/quests/${questId}`);
      return {
        success: true,
        data: response.data,
        timestamp: new Date(),
      };
    } catch (error) {
      return this.handleError(error, 'Failed to get quest');
    }
  }

  /**
   * Start a quest
   */
  async startQuest(userId: string, questId: string): Promise<ApiResponse<Quest>> {
    this.ensureInitialized();
    
    try {
      const response = await this.http.post(`/api/users/${userId}/quests/${questId}/start`);
      return {
        success: true,
        data: response.data,
        timestamp: new Date(),
      };
    } catch (error) {
      return this.handleError(error, 'Failed to start quest');
    }
  }

  /**
   * Complete a quest
   */
  async completeQuest(userId: string, questId: string, progress?: any): Promise<ApiResponse<Quest>> {
    this.ensureInitialized();
    
    try {
      const response = await this.http.post(`/api/users/${userId}/quests/${questId}/complete`, {
        progress,
      });
      return {
        success: true,
        data: response.data,
        timestamp: new Date(),
      };
    } catch (error) {
      return this.handleError(error, 'Failed to complete quest');
    }
  }

  /**
   * Update quest progress
   */
  async updateQuestProgress(userId: string, questId: string, progress: any): Promise<ApiResponse<Quest>> {
    this.ensureInitialized();
    
    try {
      const response = await this.http.patch(`/api/users/${userId}/quests/${questId}/progress`, {
        progress,
      });
      return {
        success: true,
        data: response.data,
        timestamp: new Date(),
      };
    } catch (error) {
      return this.handleError(error, 'Failed to update quest progress');
    }
  }

  /**
   * Get user's quests
   */
  async getUserQuests(userId: string, status?: string): Promise<ApiResponse<Quest[]>> {
    this.ensureInitialized();
    
    try {
      const params: any = {};
      if (status) params.status = status;

      const response = await this.http.get(`/api/users/${userId}/quests`, { params });
      return {
        success: true,
        data: response.data,
        timestamp: new Date(),
      };
    } catch (error) {
      return this.handleError(error, 'Failed to get user quests');
    }
  }

  /**
   * Get user's badges
   */
  async getUserBadges(userId: string): Promise<ApiResponse<any[]>> {
    this.ensureInitialized();
    
    try {
      const response = await this.http.get(`/api/users/${userId}/badges`);
      return {
        success: true,
        data: response.data,
        timestamp: new Date(),
      };
    } catch (error) {
      return this.handleError(error, 'Failed to get user badges');
    }
  }

  /**
   * Get user's NFTs
   */
  async getUserNFTs(userId: string): Promise<ApiResponse<any[]>> {
    this.ensureInitialized();
    
    try {
      const response = await this.http.get(`/api/users/${userId}/nfts`);
      return {
        success: true,
        data: response.data,
        timestamp: new Date(),
      };
    } catch (error) {
      return this.handleError(error, 'Failed to get user NFTs');
    }
  }

  /**
   * Get progress graph
   */
  async getProgressGraph(userId: string): Promise<ApiResponse<any>> {
    this.ensureInitialized();
    
    try {
      const response = await this.http.get(`/api/users/${userId}/progress/graph`);
      return {
        success: true,
        data: response.data,
        timestamp: new Date(),
      };
    } catch (error) {
      return this.handleError(error, 'Failed to get progress graph');
    }
  }

  /**
   * Setup HTTP interceptors
   */
  private setupInterceptors(): void {
    // Request interceptor
    this.http.interceptors.request.use(
      (config) => {
        // Add timestamp to requests
        config.metadata = { startTime: Date.now() };
        return config;
      },
      (error) => Promise.reject(error)
    );

    // Response interceptor
    this.http.interceptors.response.use(
      (response) => {
        // Log response time
        const duration = Date.now() - (response.config.metadata?.startTime || 0);
        console.debug(`API request completed in ${duration}ms`);
        return response;
      },
      (error) => {
        // Log error details
        console.error('API request failed:', error.response?.data || error.message);
        return Promise.reject(error);
      }
    );
  }

  /**
   * Handle API errors
   */
  private handleError(error: any, message: string): ApiResponse<any> {
    const statusCode = error.response?.status || 0;
    const errorMessage = error.response?.data?.message || error.message || message;
    
    return {
      success: false,
      error: errorMessage,
      timestamp: new Date(),
    };
  }

  /**
   * Ensure client is initialized
   */
  private ensureInitialized(): void {
    if (!this.initialized) {
      throw new APIError('AI client must be initialized before use');
    }
  }

  /**
   * Dispose of resources
   */
  async dispose(): Promise<void> {
    this.initialized = false;
  }
}
