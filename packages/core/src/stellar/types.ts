/**
 * Stellar-specific types
 */

import { Keypair, Asset } from 'stellar-sdk';

/**
 * Stellar account information
 */
export interface StellarAccount {
  accountId: string;
  balances: AssetBalance[];
  sequence: string;
  subentryCount: number;
  flags: AccountFlags;
}

/**
 * Asset balance information
 */
export interface AssetBalance {
  assetType: string;
  assetCode?: string;
  assetIssuer?: string;
  balance: string;
  limit?: string;
  buyingLiabilities?: string;
  sellingLiabilities?: string;
  isAuthorized?: boolean;
  isAuthorizedToMaintainLiabilities?: boolean;
  isClawbackEnabled?: boolean;
}

/**
 * Account flags
 */
export interface AccountFlags {
  authRequired: boolean;
  authRevocable: boolean;
  authImmutable: boolean;
  authClawbackEnabled: boolean;
}

/**
 * NFT metadata
 */
export interface NFTMetadata {
  id: string;
  tokenId: string;
  type: 'badge' | 'character';
  name: string;
  description: string;
  image?: string;
  attributes: NFTAttribute[];
  properties: Record<string, any>;
  owner: string;
  mintedAt: Date;
}

/**
 * NFT attribute
 */
export interface NFTAttribute {
  traitType: string;
  value: string | number;
  displayType?: string;
}

/**
 * Transaction information
 */
export interface StellarTransaction {
  id: string;
  hash: string;
  ledger: number;
  createdAt: Date;
  sourceAccount: string;
  sourceAccountSequence: string;
  feeAccount?: string;
  feeCharged: string;
  operationCount: number;
  envelopeXdr: string;
  resultXdr: string;
  resultMetaXdr: string;
  feeMetaXdr: string;
  memoType?: string;
  memo?: string;
  signatures: string[];
  validAfter?: Date;
  validBefore?: Date;
}

/**
 * Operation types
 */
export type StellarOperationType = 
  | 'createAccount'
  | 'payment'
  | 'pathPaymentStrictReceive'
  | 'pathPaymentStrictSend'
  | 'manageBuyOffer'
  | 'manageSellOffer'
  | 'createPassiveSellOffer'
  | 'setOptions'
  | 'changeTrust'
  | 'allowTrust'
  | 'accountMerge'
  | 'inflation'
  | 'manageData'
  | 'bumpSequence'
  | 'createClaimableBalance'
  | 'claimClaimableBalance'
  | 'beginSponsoringFutureReserves'
  | 'endSponsoringFutureReserves'
  | 'revokeSponsorship';

/**
 * Smart contract operation types
 */
export type SorobanOperationType = 
  | 'invokeContract'
  | 'deployContract'
  | 'createContract'
  | 'restoreFootprint';

/**
 * Contract instance information
 */
export interface ContractInstance {
  contractId: string;
  wasmId: string;
  address: string;
  deployedAt: Date;
}

/**
 * Contract function result
 */
export interface ContractResult {
  success: boolean;
  data?: any;
  error?: string;
  gasUsed?: number;
}
