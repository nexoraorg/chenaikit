/**
 * Stellar blockchain client
 */

import { Keypair, Asset, Operation, TransactionBuilder, Networks } from 'stellar-sdk';
import { Server } from 'stellar-sdk';
import { ConfigManager } from '../config';
import { StellarError, ApiResponse } from '../types';

/**
 * Stellar client for blockchain operations
 */
export class StellarClient {
  private server: Server;
  private config: ConfigManager;
  private initialized = false;

  constructor(config: ConfigManager) {
    this.config = config;
    const horizonUrl = this.config.get('stellar').horizonUrl;
    this.server = new Server(horizonUrl);
  }

  /**
   * Initialize the Stellar client
   */
  async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }

    try {
      // Set the network passphrase
      const network = this.config.get('stellar').network;
      const passphrase = this.config.get('stellar').passphrase || 
        (network === 'mainnet' ? Networks.PUBLIC : Networks.TESTNET);
      
      // Test connection
      await this.server.loadAccount('GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF');
      
      this.initialized = true;
    } catch (error) {
      throw new StellarError(`Failed to initialize Stellar client: ${error}`, error);
    }
  }

  /**
   * Check if client is initialized
   */
  isInitialized(): boolean {
    return this.initialized;
  }

  /**
   * Get account information
   */
  async getAccount(accountId: string): Promise<ApiResponse<any>> {
    this.ensureInitialized();
    
    try {
      const account = await this.server.loadAccount(accountId);
      return {
        success: true,
        data: account,
        timestamp: new Date(),
      };
    } catch (error) {
      return {
        success: false,
        error: `Failed to load account: ${error}`,
        timestamp: new Date(),
      };
    }
  }

  /**
   * Create a new account
   */
  async createAccount(): Promise<ApiResponse<{ publicKey: string; secretKey: string }>> {
    this.ensureInitialized();
    
    try {
      const keypair = Keypair.random();
      
      return {
        success: true,
        data: {
          publicKey: keypair.publicKey(),
          secretKey: keypair.secret(),
        },
        timestamp: new Date(),
      };
    } catch (error) {
      throw new StellarError(`Failed to create account: ${error}`, error);
    }
  }

  /**
   * Fund account with testnet tokens (testnet only)
   */
  async fundAccount(publicKey: string): Promise<ApiResponse<any>> {
    this.ensureInitialized();
    
    if (this.config.isMainnet()) {
      throw new StellarError('Cannot fund account on mainnet');
    }

    try {
      const response = await fetch(`https://friendbot.stellar.org?addr=${publicKey}`);
      const result = await response.json();
      
      return {
        success: response.ok,
        data: result,
        timestamp: new Date(),
      };
    } catch (error) {
      throw new StellarError(`Failed to fund account: ${error}`, error);
    }
  }

  /**
   * Mint NFT for quest completion
   */
  async mintNFT(userId: string, questId: string, nftType: 'badge' | 'character'): Promise<ApiResponse<any>> {
    this.ensureInitialized();
    
    try {
      // This would integrate with the Soroban smart contract
      // For now, return a mock response
      const nftId = `nft_${nftType}_${questId}_${userId}`;
      
      return {
        success: true,
        data: {
          id: nftId,
          type: nftType,
          questId,
          userId,
          mintedAt: new Date(),
        },
        timestamp: new Date(),
      };
    } catch (error) {
      throw new StellarError(`Failed to mint NFT: ${error}`, error);
    }
  }

  /**
   * Get user's NFTs
   */
  async getUserNFTs(userId: string): Promise<ApiResponse<any[]>> {
    this.ensureInitialized();
    
    try {
      // This would query the smart contract for user's NFTs
      // For now, return mock data
      return {
        success: true,
        data: [],
        timestamp: new Date(),
      };
    } catch (error) {
      throw new StellarError(`Failed to get user NFTs: ${error}`, error);
    }
  }

  /**
   * Transfer NFT
   */
  async transferNFT(nftId: string, fromUserId: string, toUserId: string): Promise<ApiResponse<any>> {
    this.ensureInitialized();
    
    try {
      // This would execute a transfer operation on the smart contract
      return {
        success: true,
        data: {
          nftId,
          fromUserId,
          toUserId,
          transferredAt: new Date(),
        },
        timestamp: new Date(),
      };
    } catch (error) {
      throw new StellarError(`Failed to transfer NFT: ${error}`, error);
    }
  }

  /**
   * Get transaction history
   */
  async getTransactionHistory(accountId: string, limit = 10): Promise<ApiResponse<any[]>> {
    this.ensureInitialized();
    
    try {
      const transactions = await this.server.transactions()
        .forAccount(accountId)
        .limit(limit)
        .call();
      
      return {
        success: true,
        data: transactions.records,
        timestamp: new Date(),
      };
    } catch (error) {
      return {
        success: false,
        error: `Failed to get transaction history: ${error}`,
        timestamp: new Date(),
      };
    }
  }

  /**
   * Get server instance
   */
  getServer(): Server {
    return this.server;
  }

  /**
   * Ensure client is initialized
   */
  private ensureInitialized(): void {
    if (!this.initialized) {
      throw new StellarError('Stellar client must be initialized before use');
    }
  }

  /**
   * Dispose of resources
   */
  async dispose(): Promise<void> {
    this.initialized = false;
  }
}
