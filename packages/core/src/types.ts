/**
 * Type definitions for ChenAIKit Core SDK
 */

import { Keypair } from 'stellar-sdk';

/**
 * Configuration interface for ChenAIKit
 */
export interface ChenAIKitConfig {
  stellar: StellarConfig;
  ai: AIConfig;
  cache: CacheConfig;
}

/**
 * Stellar blockchain configuration
 */
export interface StellarConfig {
  network: 'testnet' | 'mainnet';
  horizonUrl: string;
  keypair?: Keypair;
  passphrase?: string;
}

/**
 * AI services configuration
 */
export interface AIConfig {
  apiBaseUrl: string;
  apiKey?: string;
  timeout?: number;
}

/**
 * Cache configuration
 */
export interface CacheConfig {
  ttl: number; // Time to live in seconds
  enabled?: boolean;
}

/**
 * User profile information
 */
export interface UserProfile {
  id: string;
  walletAddress: string;
  username?: string;
  email?: string;
  avatar?: string;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Quest information
 */
export interface Quest {
  id: string;
  title: string;
  description: string;
  category: QuestCategory;
  difficulty: QuestDifficulty;
  prerequisites: string[];
  rewards: QuestRewards;
  status: QuestStatus;
  progress?: QuestProgress;
}

/**
 * Quest categories
 */
export type QuestCategory = 
  | 'frontend'
  | 'backend' 
  | 'blockchain'
  | 'algorithms'
  | 'devops'
  | 'security'
  | 'testing';

/**
 * Quest difficulty levels
 */
export type QuestDifficulty = 'beginner' | 'intermediate' | 'advanced' | 'expert';

/**
 * Quest rewards
 */
export interface QuestRewards {
  experiencePoints: number;
  badges: BadgeReward[];
  skills: string[];
  nfts?: NFTReward[];
}

/**
 * Badge reward information
 */
export interface BadgeReward {
  id: string;
  name: string;
  description: string;
  rarity: BadgeRarity;
  imageUrl?: string;
}

/**
 * Badge rarity levels
 */
export type BadgeRarity = 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary';

/**
 * NFT reward information
 */
export interface NFTReward {
  id: string;
  name: string;
  description: string;
  imageUrl?: string;
  metadata?: Record<string, any>;
}

/**
 * Quest status
 */
export type QuestStatus = 
  | 'not_started'
  | 'in_progress'
  | 'completed'
  | 'failed'
  | 'locked';

/**
 * Quest progress tracking
 */
export interface QuestProgress {
  completionPercentage: number;
  stepsCompleted: string[];
  currentStep?: string;
  timeSpent: number; // in minutes
  attempts: number;
  hintsUsed: number;
}

/**
 * Skill information
 */
export interface Skill {
  id: string;
  name: string;
  description: string;
  category: QuestCategory;
  level: number;
  maxLevel: number;
  experience: number;
  experienceToNextLevel: number;
  isUnlocked: boolean;
  unlockedAt?: Date;
}

/**
 * User progress summary
 */
export interface UserProgress {
  userId: string;
  level: number;
  totalExperience: number;
  questsCompleted: number;
  questsInProgress: number;
  badgesEarned: number;
  skillsUnlocked: number;
  completionRate: number;
  streakDays: number;
  lastActivity?: Date;
}

/**
 * API response wrapper
 */
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
  timestamp: Date;
}

/**
 * Error types
 */
export class ChenAIKitError extends Error {
  constructor(
    message: string,
    public code?: string,
    public details?: any
  ) {
    super(message);
    this.name = 'ChenAIKitError';
  }
}

export class StellarError extends ChenAIKitError {
  constructor(message: string, details?: any) {
    super(message, 'STELLAR_ERROR', details);
    this.name = 'StellarError';
  }
}

export class APIError extends ChenAIKitError {
  constructor(message: string, public statusCode?: number, details?: any) {
    super(message, 'API_ERROR', details);
    this.name = 'APIError';
  }
}

export class ValidationError extends ChenAIKitError {
  constructor(message: string, details?: any) {
    super(message, 'VALIDATION_ERROR', details);
    this.name = 'ValidationError';
  }
}

/**
 * Event types for the SDK
 */
export interface SDKEvents {
  'quest:started': { questId: string; userId: string };
  'quest:completed': { questId: string; userId: string; rewards: QuestRewards };
  'skill:unlocked': { skillId: string; userId: string };
  'badge:earned': { badgeId: string; userId: string };
  'nft:minted': { nftId: string; userId: string; type: string };
  'error': { error: ChenAIKitError };
}

/**
 * Event listener type
 */
export type EventListener<T = any> = (data: T) => void | Promise<void>;
