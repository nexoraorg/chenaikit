import { Address } from '@soroban-react/types';

export interface OracleConfig {
  // Soroban network configuration
  networkUrl: string;
  networkPassphrase: string;
  
  // Oracle contract configuration
  oracleContractId: string;
  
  // Node identity
  nodeKeypair: {
    publicKey: string;
    secretKey: string;
  };
  
  // ML model configuration
  modelType: 'credit-score' | 'fraud-detect';
  modelPath?: string;
  
  // Timing configuration
  commitPhaseDuration: number; // in seconds
  revealPhaseDuration: number; // in seconds
  
  // Retry configuration
  maxRetries: number;
  retryDelay: number; // in milliseconds
  
  // Health check configuration
  healthCheckInterval: number; // in milliseconds
}

export interface ModelInferenceRequest {
  requestId: string;
  account: string;
  inputData: any;
  modelHash: string;
}

export interface ModelInferenceResult {
  requestId: string;
  score: number;
  confidence: number;
  modelHash: string;
  timestamp: number;
}

export interface CommitData {
  requestId: string;
  commitHash: Buffer;
  modelHash: Buffer;
  submittedAt: number;
}

export interface RevealData {
  requestId: string;
  score: number;
  salt: Buffer;
  revealedAt: number;
}

export interface OracleMetrics {
  nodeId: string;
  uptime: number;
  totalRequests: number;
  successfulSubmissions: number;
  failedSubmissions: number;
  averageResponseTime: number;
  currentReputation: number;
  lastSubmissionTime?: number;
}

export interface NodeInfo {
  address: Address;
  stake: bigint;
  reputation: number;
  registeredAt: number;
  isActive: boolean;
}
