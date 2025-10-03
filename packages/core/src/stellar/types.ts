export interface StellarConfig {
  network: 'testnet' | 'mainnet';
  horizonUrl?: string;
  apiKey?: string;
}

export interface AccountData {
  id: string;
  balance: string;
  assets: any[];
  sequence: string;
}

export interface TransactionResult {
  hash: string;
  success: boolean;
  error?: string;
}

export interface MultiSigOptions {
  low: number;
  medium: number;
  high: number;
}

export interface Signer {
  publicKey: string;
  weight: number;
}

export interface AssetData {
  code: string;
  issuer: string;
}
