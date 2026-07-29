import { CommitRevealManager } from '../CommitRevealManager';
import { OracleConfig } from '../types';

describe('CommitRevealManager', () => {
  let mockConfig: OracleConfig;
  let manager: CommitRevealManager;

  beforeEach(() => {
    mockConfig = {
      nodeKeypair: {
        publicKey: 'test-public-key',
        secretKey: 'test-secret-key',
      },
      rpcUrl: 'http://localhost:8000',
      contractAddress: 'test-contract-address',
      modelPath: '/models/test.pkl',
      driftThreshold: 0.15,
    };
    manager = new CommitRevealManager(mockConfig);
  });

  describe('commit submission', () => {
    it('should generate commit hash correctly', () => {
      const value = 100;
      const salt = 'test-salt';
      
      const commitHash = manager.generateCommitHash(value, salt);
      
      expect(commitHash).toBeDefined();
      expect(typeof commitHash).toBe('string');
      expect(commitHash.length).toBeGreaterThan(0);
    });

    it('should generate different hashes for different values', () => {
      const salt = 'test-salt';
      
      const hash1 = manager.generateCommitHash(100, salt);
      const hash2 = manager.generateCommitHash(200, salt);
      
      expect(hash1).not.toBe(hash2);
    });

    it('should generate different hashes for different salts', () => {
      const value = 100;
      
      const hash1 = manager.generateCommitHash(value, 'salt1');
      const hash2 = manager.generateCommitHash(value, 'salt2');
      
      expect(hash1).not.toBe(hash2);
    });

    it('should submit commit transaction', async () => {
      const commitHash = 'test-commit-hash';
      const modelHash = 'test-model-hash';
      
      const result = await manager.submitCommit(commitHash, modelHash);
      
      expect(result).toBeDefined();
      expect(result.success).toBe(true);
      expect(result.transactionId).toBeDefined();
    });
  });

  describe('reveal submission', () => {
    it('should submit reveal transaction', async () => {
      const value = 100;
      const salt = 'test-salt';
      
      const result = await manager.submitReveal(value, salt);
      
      expect(result).toBeDefined();
      expect(result.success).toBe(true);
      expect(result.transactionId).toBeDefined();
    });

    it('should verify commit hash matches reveal', () => {
      const value = 100;
      const salt = 'test-salt';
      
      const commitHash = manager.generateCommitHash(value, salt);
      const isValid = manager.verifyCommitHash(commitHash, value, salt);
      
      expect(isValid).toBe(true);
    });

    it('should reject mismatched commit hash', () => {
      const value = 100;
      const salt = 'test-salt';
      const wrongCommitHash = 'wrong-commit-hash';
      
      const isValid = manager.verifyCommitHash(wrongCommitHash, value, salt);
      
      expect(isValid).toBe(false);
    });
  });

  describe('salt generation', () => {
    it('should generate random salt', () => {
      const salt = manager.generateSalt();
      
      expect(salt).toBeDefined();
      expect(typeof salt).toBe('string');
      expect(salt.length).toBeGreaterThan(0);
    });

    it('should generate different salts on multiple calls', () => {
      const salt1 = manager.generateSalt();
      const salt2 = manager.generateSalt();
      
      expect(salt1).not.toBe(salt2);
    });
  });

  describe('retry logic', () => {
    it('should retry failed transactions', async () => {
      const commitHash = 'test-commit-hash';
      const modelHash = 'test-model-hash';
      
      // Mock a failed first attempt
      let attemptCount = 0;
      const mockSubmit = jest.spyOn(manager as any, 'executeTransaction').mockImplementation(async () => {
        attemptCount++;
        if (attemptCount === 1) {
          throw new Error('Network error');
        }
        return { success: true, transactionId: 'test-tx-id' };
      });
      
      const result = await manager.submitCommit(commitHash, modelHash);
      
      expect(result.success).toBe(true);
      expect(attemptCount).toBe(2);
      
      mockSubmit.mockRestore();
    });

    it('should respect max retry limit', async () => {
      const commitHash = 'test-commit-hash';
      const modelHash = 'test-model-hash';
      
      const mockSubmit = jest.spyOn(manager as any, 'executeTransaction').mockRejectedValue(
        new Error('Persistent error')
      );
      
      await expect(manager.submitCommit(commitHash, modelHash)).rejects.toThrow();
      
      mockSubmit.mockRestore();
    });
  });

  describe('timing', () => {
    it('should wait for commit phase to end before reveal', async () => {
      const commitHash = 'test-commit-hash';
      const modelHash = 'test-model-hash';
      
      await manager.submitCommit(commitHash, modelHash);
      
      // Should wait for commit phase to end
      const canReveal = await manager.canReveal();
      
      expect(canReveal).toBeDefined();
    });

    it('should respect phase timeouts', async () => {
      const value = 100;
      const salt = 'test-salt';
      
      // Mock that reveal phase has ended
      jest.spyOn(manager as any, 'isRevealPhaseActive').mockReturnValue(false);
      
      await expect(manager.submitReveal(value, salt)).rejects.toThrow('Reveal phase not active');
    });
  });

  describe('error handling', () => {
    it('should handle network errors gracefully', async () => {
      const commitHash = 'test-commit-hash';
      const modelHash = 'test-model-hash';
      
      const mockSubmit = jest.spyOn(manager as any, 'executeTransaction').mockRejectedValue(
        new Error('Network unreachable')
      );
      
      await expect(manager.submitCommit(commitHash, modelHash)).rejects.toThrow();
      
      mockSubmit.mockRestore();
    });

    it('should handle invalid commit hash', async () => {
      const invalidCommitHash = '';
      const modelHash = 'test-model-hash';
      
      await expect(manager.submitCommit(invalidCommitHash, modelHash)).rejects.toThrow();
    });
  });
});
