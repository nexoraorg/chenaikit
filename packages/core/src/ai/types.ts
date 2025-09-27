/**
 * AI-specific types
 */

/**
 * AI service configuration
 */
export interface AIServiceConfig {
  apiBaseUrl: string;
  apiKey?: string;
  timeout?: number;
  retries?: number;
  retryDelay?: number;
}

/**
 * Learning analytics data
 */
export interface LearningAnalytics {
  userId: string;
  totalTimeSpent: number; // in minutes
  questsCompleted: number;
  averageCompletionTime: number;
  difficultyProgression: DifficultyProgression[];
  skillGrowth: SkillGrowth[];
  learningStreak: number;
  lastActivity: Date;
}

/**
 * Difficulty progression tracking
 */
export interface DifficultyProgression {
  difficulty: string;
  questsCompleted: number;
  averageTime: number;
  successRate: number;
  completedAt: Date;
}

/**
 * Skill growth tracking
 */
export interface SkillGrowth {
  skillId: string;
  skillName: string;
  level: number;
  experience: number;
  growthRate: number;
  lastUpdated: Date;
}

/**
 * AI recommendation
 */
export interface AIRecommendation {
  type: 'quest' | 'skill' | 'path';
  itemId: string;
  title: string;
  description: string;
  confidence: number;
  reason: string;
  estimatedTime?: number;
  difficulty?: string;
}

/**
 * Learning path suggestion
 */
export interface LearningPath {
  id: string;
  title: string;
  description: string;
  difficulty: string;
  estimatedTime: number;
  quests: string[];
  skills: string[];
  prerequisites: string[];
  rewards: string[];
}

/**
 * Performance metrics
 */
export interface PerformanceMetrics {
  userId: string;
  period: 'daily' | 'weekly' | 'monthly';
  questsCompleted: number;
  averageScore: number;
  timeSpent: number;
  skillsImproved: number;
  badgesEarned: number;
  nftsMinted: number;
  completionRate: number;
  improvementRate: number;
}

/**
 * Adaptive learning parameters
 */
export interface AdaptiveLearningParams {
  userId: string;
  learningStyle: 'visual' | 'auditory' | 'kinesthetic' | 'reading';
  pace: 'slow' | 'normal' | 'fast';
  difficultyPreference: 'conservative' | 'balanced' | 'challenging';
  focusAreas: string[];
  avoidAreas: string[];
  timeConstraints: {
    daily: number; // minutes per day
    weekly: number; // minutes per week
  };
}

/**
 * AI-generated content
 */
export interface AIGeneratedContent {
  type: 'hint' | 'explanation' | 'example' | 'exercise';
  content: string;
  difficulty: string;
  category: string;
  metadata: Record<string, any>;
}

/**
 * Chat message for AI interaction
 */
export interface ChatMessage {
  id: string;
  userId: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
  context?: {
    questId?: string;
    skillId?: string;
    topic?: string;
  };
}

/**
 * AI chat session
 */
export interface ChatSession {
  id: string;
  userId: string;
  messages: ChatMessage[];
  context: {
    currentQuest?: string;
    currentSkill?: string;
    learningGoal?: string;
  };
  startedAt: Date;
  lastActivity: Date;
}
