import { Asset } from '@stellar/stellar-sdk';
import { StellarConnector } from '../connector';
import { 
  createTrustline, 
  removeTrustline, 
  issueAsset, 
  transferAsset 
} from '../assetManager';

// Mock the StellarConnector
jest.mock('../connector');

describe('AssetManager', () => {
  let mockConnector: jest.Mocked<StellarConnector>;
  let mockAsset: Asset;

  beforeEach(() => {
    mockConnector = new StellarConnector({ network: 'testnet' }) as jest.Mocked<StellarConnector>;
    mockAsset = new Asset('USD', 'GTEST123456789012345678901234567890123456789');

    // Mock connector methods
    mockConnector.getAccount = jest.fn().mockResolvedValue({
      id: 'GTEST123456789012345678901234567890123456789',
      sequence: '1'
    });
    mockConnector.getFee = jest.fn().mockResolvedValue('100');
    mockConnector.getNetworkPassphrase = jest.fn().mockResolvedValue('Test SDF Network ; September 2015');
    mockConnector.submitTransaction = jest.fn().mockResolvedValue({ hash: 'test-hash', success: true });
  });

  describe('createTrustline', () => {
    it('should create a trustline with default limit', async () => {
      const sourceSecret = 'S1234567890123456789012345678901234567890123456789012345678901234';

      await createTrustline(mockConnector, sourceSecret, mockAsset);

      expect(mockConnector.getAccount).toHaveBeenCalledWith(expect.any(String));
      expect(mockConnector.getFee).toHaveBeenCalled();
      expect(mockConnector.getNetworkPassphrase).toHaveBeenCalled();
      expect(mockConnector.submitTransaction).toHaveBeenCalled();
    });

    it('should create a trustline with custom limit', async () => {
      const sourceSecret = 'S1234567890123456789012345678901234567890123456789012345678901234';
      const limit = '1000';

      await createTrustline(mockConnector, sourceSecret, mockAsset, limit);

      expect(mockConnector.submitTransaction).toHaveBeenCalled();
    });

    it('should handle errors when creating trustline', async () => {
      const sourceSecret = 'S1234567890123456789012345678901234567890123456789012345678901234';
      mockConnector.submitTransaction.mockRejectedValue(new Error('Transaction failed'));

      await expect(createTrustline(mockConnector, sourceSecret, mockAsset))
        .rejects.toThrow('Transaction failed');
    });
  });

  describe('removeTrustline', () => {
    it('should remove a trustline by setting limit to 0', async () => {
      const sourceSecret = 'S1234567890123456789012345678901234567890123456789012345678901234';

      await removeTrustline(mockConnector, sourceSecret, mockAsset);

      expect(mockConnector.getAccount).toHaveBeenCalled();
      expect(mockConnector.submitTransaction).toHaveBeenCalled();
    });
  });

  describe('issueAsset', () => {
    it('should issue an asset to distribution account', async () => {
      const issuerSecret = 'S1234567890123456789012345678901234567890123456789012345678901234';
      const distributionPublicKey = 'GDIST123456789012345678901234567890123456789';
      const amount = '1000';

      await issueAsset(mockConnector, issuerSecret, distributionPublicKey, mockAsset, amount);

      expect(mockConnector.getAccount).toHaveBeenCalled();
      expect(mockConnector.submitTransaction).toHaveBeenCalled();
    });

    it('should handle errors when issuing asset', async () => {
      const issuerSecret = 'S1234567890123456789012345678901234567890123456789012345678901234';
      const distributionPublicKey = 'GDIST123456789012345678901234567890123456789';
      const amount = '1000';
      mockConnector.submitTransaction.mockRejectedValue(new Error('Insufficient balance'));

      await expect(issueAsset(mockConnector, issuerSecret, distributionPublicKey, mockAsset, amount))
        .rejects.toThrow('Insufficient balance');
    });
  });

  describe('transferAsset', () => {
    it('should transfer asset between accounts', async () => {
      const sourceSecret = 'S1234567890123456789012345678901234567890123456789012345678901234';
      const destinationPublicKey = 'GDEST123456789012345678901234567890123456789';
      const amount = '500';

      await transferAsset(mockConnector, sourceSecret, destinationPublicKey, mockAsset, amount);

      expect(mockConnector.getAccount).toHaveBeenCalled();
      expect(mockConnector.submitTransaction).toHaveBeenCalled();
    });

    it('should handle errors when transferring asset', async () => {
      const sourceSecret = 'S1234567890123456789012345678901234567890123456789012345678901234';
      const destinationPublicKey = 'GDEST123456789012345678901234567890123456789';
      const amount = '500';
      mockConnector.submitTransaction.mockRejectedValue(new Error('No trustline'));

      await expect(transferAsset(mockConnector, sourceSecret, destinationPublicKey, mockAsset, amount))
        .rejects.toThrow('No trustline');
    });
  });

  describe('Asset validation', () => {
    it('should work with native asset (XLM)', () => {
      const nativeAsset = Asset.native();
      expect(nativeAsset.isNative()).toBe(true);
    });

    it('should work with custom asset', () => {
      const customAsset = new Asset('USD', 'GTEST123456789012345678901234567890123456789');
      expect(customAsset.isNative()).toBe(false);
      expect(customAsset.getCode()).toBe('USD');
    });
  });
});
