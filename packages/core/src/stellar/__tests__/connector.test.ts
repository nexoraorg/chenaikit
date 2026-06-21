import { StellarConnector } from '../connector';
import { StellarConfig } from '../types';

describe('StellarConnector', () => {
  const mockConfig: StellarConfig = {
    network: 'testnet',
    horizonUrl: 'https://horizon-testnet.stellar.org',
    apiKey: 'test-api-key'
  };

  let connector: StellarConnector;

  beforeEach(() => {
    connector = new StellarConnector(mockConfig);
  });

  describe('constructor', () => {
    it('should create instance with config', () => {
      expect(connector).toBeInstanceOf(StellarConnector);
    });

    it('should work with minimal config', () => {
      const minimalConfig: StellarConfig = { network: 'mainnet' };
      const minimalConnector = new StellarConnector(minimalConfig);
      expect(minimalConnector).toBeInstanceOf(StellarConnector);
    });
  });

  describe('getAccount', () => {
    it('should throw error as not implemented', async () => {
      await expect(connector.getAccount('G1234567890123456789012345678901234567890'))
        .rejects.toThrow('Not implemented yet - see issue #24');
    });
  });

  describe('submitTransaction', () => {
    it('should throw error as not implemented', async () => {
      const mockTransaction = { to: 'G123', amount: '100' };
      await expect(connector.submitTransaction(mockTransaction))
        .rejects.toThrow('Not implemented yet - see issue #24');
    });
  });

  describe('getFee', () => {
    it('should throw error as not implemented', async () => {
      await expect(connector.getFee())
        .rejects.toThrow('Not implemented yet - see issue #24');
    });
  });

  describe('getNetworkPassphrase', () => {
    it('should throw error as not implemented', async () => {
      await expect(connector.getNetworkPassphrase())
        .rejects.toThrow('Not implemented yet - see issue #24');
    });
  });
});
