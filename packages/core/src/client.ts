/**
 * Main ChenAIKit client class
 */

import { ConfigManager } from './config';
import { StellarClient } from './stellar';
import { AIClient } from './ai';
import { EventEmitter } from './utils/events';
import { 
  ChenAIKitConfig, 
  UserProfile, 
  Quest, 
  UserProgress, 
  ApiResponse,
  ChenAIKitError,
  SDKEvents,
  EventListener
} from './types';

/**
 * Main ChenAIKit client class
 */
export class ChenAIKitClient extends EventEmitter<SDKEvents> {
  private config: ConfigManager;
  private stellar: StellarClient;
  private ai: AIClient;
  private initialized = false;

  constructor(config?: Partial<ChenAIKitConfig>) {
    super();
    this.config = new ConfigManager(config);
    this.stellar = new StellarClient(this.config);
    this.ai = new AIClient(this.config);
  }

  /**
   * Initialize the client
   */
  async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }

    try {
      await this.stellar.initialize();
      await this.ai.initialize();
      this.initialized = true;
      
      this.emit('initialized', {});
    } catch (error) {
      this.emit('error', { error: error as ChenAIKitError });
      throw error;
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
    return this.ai.getUserProfile(userId);
  }

  /**
   * Update user profile
   */
  async updateUserProfile(userId: string, updates: Partial<UserProfile>): Promise<ApiResponse<UserProfile>> {
    this.ensureInitialized();
    return this.ai.updateUserProfile(userId, updates);
  }

  /**
   * Get user progress
   */
  async getUserProgress(userId: string): Promise<ApiResponse<UserProgress>> {
    this.ensureInitialized();
    return this.ai.getUserProgress(userId);
  }

  /**
   * Get available quests
   */
  async getQuests(category?: string, difficulty?: string): Promise<ApiResponse<Quest[]>> {
    this.ensureInitialized();
    return this.ai.getQuests(category, difficulty);
  }

  /**
   * Start a quest
   */
  async startQuest(userId: string, questId: string): Promise<ApiResponse<Quest>> {
    this.ensureInitialized();
    
    try {
      const response = await this.ai.startQuest(userId, questId);
      
      if (response.success) {
        this.emit('quest:started', { questId, userId });
      }
      
      return response;
    } catch (error) {
      this.emit('error', { error: error as ChenAIKitError });
      throw error;
    }
  }

  /**
   * Complete a quest
   */
  async completeQuest(userId: string, questId: string, progress?: any): Promise<ApiResponse<Quest>> {
    this.ensureInitialized();
    
    try {
      const response = await this.ai.completeQuest(userId, questId, progress);
      
      if (response.success && response.data) {
        this.emit('quest:completed', {
          questId,
          userId,
          rewards: response.data.rewards
        });
      }
      
      return response;
    } catch (error) {
      this.emit('error', { error: error as ChenAIKitError });
      throw error;
    }
  }

  /**
   * Mint NFT for quest completion
   */
  async mintQuestNFT(userId: string, questId: string, nftType: 'badge' | 'character'): Promise<ApiResponse<any>> {
    this.ensureInitialized();
    
    try {
      const response = await this.stellar.mintNFT(userId, questId, nftType);
      
      if (response.success) {
        this.emit('nft:minted', {
          nftId: response.data?.id || '',
          userId,
          type: nftType
        });
      }
      
      return response;
    } catch (error) {
      this.emit('error', { error: error as ChenAIKitError });
      throw error;
    }
  }

  /**
   * Get user's NFTs
   */
  async getUserNFTs(userId: string): Promise<ApiResponse<any[]>> {
    this.ensureInitialized();
    return this.stellar.getUserNFTs(userId);
  }

  /**
   * Get Stellar client instance
   */
  getStellar(): StellarClient {
    return this.stellar;
  }

  /**
   * Get AI client instance
   */
  getAI(): AIClient {
    return this.ai;
  }

  /**
   * Get configuration
   */
  getConfig(): ConfigManager {
    return this.config;
  }

  /**
   * Update configuration
   */
  updateConfig(config: Partial<ChenAIKitConfig>): void {
    this.config.updateConfig(config);
  }

  /**
   * Ensure client is initialized
   */
  private ensureInitialized(): void {
    if (!this.initialized) {
      throw new ChenAIKitError('Client must be initialized before use. Call initialize() first.');
    }
  }

  /**
   * Dispose of resources
   */
  async dispose(): Promise<void> {
    if (this.stellar) {
      await this.stellar.dispose();
    }
    
    if (this.ai) {
      await this.ai.dispose();
    }
    
    this.initialized = false;
    this.removeAllListeners();
  }
}

/**
 * Create a new ChenAIKit client instance
 */
export function createClient(config?: Partial<ChenAIKitConfig>): ChenAIKitClient {
  return new ChenAIKitClient(config);
}

/**
 * Default client instance
 */
let defaultClient: ChenAIKitClient | null = null;

/**
 * Get or create default client
 */
export function getDefaultClient(config?: Partial<ChenAIKitConfig>): ChenAIKitClient {
  if (!defaultClient) {
    defaultClient = new ChenAIKitClient(config);
  }
  return defaultClient;
}

/**
 * Initialize default client
 */
export async function initializeDefaultClient(config?: Partial<ChenAIKitConfig>): Promise<ChenAIKitClient> {
  const client = getDefaultClient(config);
  await client.initialize();
  return client;
}
