/**
 * Stellar utility functions
 */

import { Keypair, StrKey } from 'stellar-sdk';

/**
 * Validate Stellar address
 */
export function isValidAddress(address: string): boolean {
  try {
    return StrKey.isValidEd25519PublicKey(address);
  } catch {
    return false;
  }
}

/**
 * Validate secret key
 */
export function isValidSecretKey(secretKey: string): boolean {
  try {
    return StrKey.isValidEd25519SecretKey(secretKey);
  } catch {
    return false;
  }
}

/**
 * Create keypair from secret key
 */
export function createKeypairFromSecret(secretKey: string): Keypair {
  if (!isValidSecretKey(secretKey)) {
    throw new Error('Invalid secret key format');
  }
  
  return Keypair.fromSecret(secretKey);
}

/**
 * Generate random keypair
 */
export function generateRandomKeypair(): Keypair {
  return Keypair.random();
}

/**
 * Format asset code for display
 */
export function formatAssetCode(assetCode: string, assetIssuer?: string): string {
  if (assetCode === 'XLM') {
    return 'XLM';
  }
  
  if (assetIssuer) {
    return `${assetCode}:${assetIssuer.substring(0, 8)}...`;
  }
  
  return assetCode;
}

/**
 * Convert stroops to lumens
 */
export function stroopsToLumens(stroops: number): number {
  return stroops / 10000000;
}

/**
 * Convert lumens to stroops
 */
export function lumensToStroops(lumens: number): number {
  return Math.floor(lumens * 10000000);
}

/**
 * Format amount for display
 */
export function formatAmount(amount: string | number, assetCode = 'XLM'): string {
  const numAmount = typeof amount === 'string' ? parseFloat(amount) : amount;
  
  if (assetCode === 'XLM') {
    return `${numAmount.toFixed(7)} XLM`;
  }
  
  return `${numAmount} ${assetCode}`;
}

/**
 * Generate transaction memo
 */
export function generateMemo(type: 'quest' | 'nft' | 'reward', data: string): string {
  const timestamp = Date.now();
  return `${type}:${data}:${timestamp}`;
}

/**
 * Parse transaction memo
 */
export function parseMemo(memo: string): { type: string; data: string; timestamp: number } | null {
  try {
    const parts = memo.split(':');
    if (parts.length !== 3) {
      return null;
    }
    
    return {
      type: parts[0],
      data: parts[1],
      timestamp: parseInt(parts[2], 10),
    };
  } catch {
    return null;
  }
}

/**
 * Check if account needs funding (testnet only)
 */
export function needsFunding(balance: string): boolean {
  const numBalance = parseFloat(balance);
  return numBalance < 1; // Less than 1 XLM
}

/**
 * Calculate transaction fee
 */
export function calculateTransactionFee(operationCount: number): number {
  // Base fee is 100 stroops per operation
  return operationCount * 100;
}

/**
 * Generate unique NFT token ID
 */
export function generateNFTTokenId(userId: string, questId: string, nftType: string): string {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 8);
  return `${nftType}_${questId}_${userId}_${timestamp}_${random}`;
}
