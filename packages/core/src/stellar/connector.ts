import { Server } from '@stellar/stellar-sdk';

export interface StellarConfig {
  network: 'testnet' | 'mainnet';
  horizonUrl?: string;
}

export class StellarConnector {
  private server: Server;
  private config: StellarConfig;

  constructor(config: StellarConfig) {
    this.config = config;
    this.server = new Server(config.horizonUrl || this.getDefaultHorizonUrl());
  }

  private getDefaultHorizonUrl(): string {
    return this.config.network === 'testnet' 
      ? 'https://horizon-testnet.stellar.org'
      : 'https://horizon.stellar.org';
  }

  async getAccount(accountId: string) {
    // TODO: Implement account fetching
    throw new Error('Not implemented yet');
  }

  async getAccountBalances(accountId: string) {
    // TODO: Implement balance fetching
    throw new Error('Not implemented yet');
  }

  async getAccountTransactions(accountId: string, limit = 10) {
    // TODO: Implement transaction history fetching
    throw new Error('Not implemented yet');
  }
}
