import { StellarConfig } from './types';

export class StellarConnector {
  private config: StellarConfig;

  constructor(config: StellarConfig) {
    this.config = config;
  }

  async getAccount(accountId: string): Promise<any> {
    // TODO: Implement Stellar account retrieval - Issue #24
    throw new Error('Not implemented yet - see issue #24');
  }

  async submitTransaction(xdr: string): Promise<any> {
    // TODO: Implement transaction submission - Issue #24
    throw new Error('Not implemented yet - see issue #24');
  }
}
