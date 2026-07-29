import { OracleService } from '../oracleService';
import { PrismaClient } from '@prisma/client';

describe('OracleService', () => {
  let service: OracleService;
  let prisma: PrismaClient;

  beforeEach(() => {
    prisma = new PrismaClient();
    service = new OracleService(prisma);
  });

  afterEach(async () => {
    await prisma.$disconnect();
  });

  describe('node registration', () => {
    it('should register a new oracle node', async () => {
      const nodeData = {
        address: 'test-node-address',
        stake: 1000000,
        reputation: 1000,
      };

      const node = await service.registerNode(nodeData);

      expect(node).toBeDefined();
      expect(node.address).toBe(nodeData.address);
      expect(node.stake).toBe(nodeData.stake);
      expect(node.reputation).toBe(nodeData.reputation);
      expect(node.isActive).toBe(true);
    });

    it('should not register duplicate node addresses', async () => {
      const nodeData = {
        address: 'test-node-address',
        stake: 1000000,
        reputation: 1000,
      };

      await service.registerNode(nodeData);

      await expect(service.registerNode(nodeData)).rejects.toThrow();
    });

    it('should update existing node', async () => {
      const nodeData = {
        address: 'test-node-address',
        stake: 1000000,
        reputation: 1000,
      };

      await service.registerNode(nodeData);

      const updatedNode = await service.updateNode('test-node-address', {
        stake: 2000000,
        reputation: 1100,
      });

      expect(updatedNode.stake).toBe(2000000);
      expect(updatedNode.reputation).toBe(1100);
    });
  });

  describe('submission tracking', () => {
    it('should create a commit submission', async () => {
      const submissionData = {
        requestId: 'test-request-1',
        nodeId: 'test-node-address',
        phase: 'commit' as const,
        commitHash: 'test-commit-hash',
        modelHash: 'test-model-hash',
      };

      const submission = await service.createSubmission(submissionData);

      expect(submission).toBeDefined();
      expect(submission.requestId).toBe(submissionData.requestId);
      expect(submission.phase).toBe('commit');
      expect(submission.commitHash).toBe(submissionData.commitHash);
    });

    it('should update submission to reveal phase', async () => {
      const submissionData = {
        requestId: 'test-request-2',
        nodeId: 'test-node-address',
        phase: 'commit' as const,
        commitHash: 'test-commit-hash',
        modelHash: 'test-model-hash',
      };

      const submission = await service.createSubmission(submissionData);

      const revealedSubmission = await service.updateSubmission(submission.id, {
        phase: 'reveal',
        value: 100,
      });

      expect(revealedSubmission.phase).toBe('reveal');
      expect(revealedSubmission.value).toBe(100);
    });

    it('should get submissions by request ID', async () => {
      const submissionData = {
        requestId: 'test-request-3',
        nodeId: 'test-node-address',
        phase: 'commit' as const,
        commitHash: 'test-commit-hash',
        modelHash: 'test-model-hash',
      };

      await service.createSubmission(submissionData);

      const submissions = await service.getSubmissionsByRequestId('test-request-3');

      expect(submissions).toHaveLength(1);
      expect(submissions[0].requestId).toBe('test-request-3');
    });
  });

  describe('dispute handling', () => {
    it('should create a dispute', async () => {
      const disputeData = {
        requestId: 'test-request-4',
        disputerId: 'test-disputer',
        reason: 'high variance',
      };

      const dispute = await service.createDispute(disputeData);

      expect(dispute).toBeDefined();
      expect(dispute.requestId).toBe(disputeData.requestId);
      expect(dispute.disputerId).toBe(disputeData.disputerId);
      expect(dispute.reason).toBe(disputeData.reason);
      expect(dispute.status).toBe('pending');
    });

    it('should update dispute votes', async () => {
      const disputeData = {
        requestId: 'test-request-5',
        disputerId: 'test-disputer',
        reason: 'high variance',
      };

      const dispute = await service.createDispute(disputeData);

      const updatedDispute = await service.updateDispute(dispute.id, {
        votesFor: 5,
        votesAgainst: 2,
      });

      expect(updatedDispute.votesFor).toBe(5);
      expect(updatedDispute.votesAgainst).toBe(2);
    });

    it('should resolve dispute', async () => {
      const disputeData = {
        requestId: 'test-request-6',
        disputerId: 'test-disputer',
        reason: 'high variance',
      };

      const dispute = await service.createDispute(disputeData);

      const resolvedDispute = await service.resolveDispute(dispute.id, 'approved');

      expect(resolvedDispute.status).toBe('resolved');
      expect(resolvedDispute.resolution).toBe('approved');
    });
  });

  describe('slash events', () => {
    it('should create a slash event', async () => {
      const slashData = {
        nodeId: 'test-node-address',
        reason: 'no reveal',
        amount: 100000,
      };

      const slashEvent = await service.createSlashEvent(slashData);

      expect(slashEvent).toBeDefined();
      expect(slashEvent.nodeId).toBe(slashData.nodeId);
      expect(slashEvent.reason).toBe(slashData.reason);
      expect(slashEvent.amount).toBe(slashData.amount);
    });

    it('should get slash events by node ID', async () => {
      const slashData = {
        nodeId: 'test-node-address',
        reason: 'no reveal',
        amount: 100000,
      };

      await service.createSlashEvent(slashData);

      const slashEvents = await service.getSlashEventsByNodeId('test-node-address');

      expect(slashEvents).toHaveLength(1);
      expect(slashEvents[0].nodeId).toBe('test-node-address');
    });
  });

  describe('reputation snapshots', () => {
    it('should create a reputation snapshot', async () => {
      const snapshotData = {
        nodeId: 'test-node-address',
        reputation: 1050,
      };

      const snapshot = await service.createReputationSnapshot(snapshotData);

      expect(snapshot).toBeDefined();
      expect(snapshot.nodeId).toBe(snapshotData.nodeId);
      expect(snapshot.reputation).toBe(snapshotData.reputation);
    });

    it('should get reputation history for node', async () => {
      const snapshotData = {
        nodeId: 'test-node-address',
        reputation: 1050,
      };

      await service.createReputationSnapshot(snapshotData);

      const history = await service.getReputationHistory('test-node-address');

      expect(history).toHaveLength(1);
      expect(history[0].reputation).toBe(1050);
    });
  });

  describe('network statistics', () => {
    it('should calculate network statistics', async () => {
      // Register some nodes
      await service.registerNode({ address: 'node1', stake: 1000000, reputation: 1000 });
      await service.registerNode({ address: 'node2', stake: 2000000, reputation: 1100 });
      await service.registerNode({ address: 'node3', stake: 1500000, reputation: 950 });

      const stats = await service.getNetworkStatistics();

      expect(stats.totalNodes).toBe(3);
      expect(stats.activeNodes).toBe(3);
      expect(stats.totalStake).toBe(4500000);
      expect(stats.averageReputation).toBeCloseTo(1016.67);
    });

    it('should calculate node statistics', async () => {
      await service.registerNode({ address: 'node1', stake: 1000000, reputation: 1000 });

      const stats = await service.getNodeStatistics('node1');

      expect(stats).toBeDefined();
      expect(stats.address).toBe('node1');
      expect(stats.stake).toBe(1000000);
      expect(stats.reputation).toBe(1000);
    });
  });

  describe('error handling', () => {
    it('should handle non-existent node updates', async () => {
      await expect(
        service.updateNode('non-existent-node', { stake: 2000000 })
      ).rejects.toThrow();
    });

    it('should handle non-existent dispute updates', async () => {
      await expect(
        service.updateDispute('non-existent-id', { votesFor: 5 })
      ).rejects.toThrow();
    });

    it('should handle invalid submission data', async () => {
      const invalidData = {
        requestId: '',
        nodeId: 'test-node',
        phase: 'commit' as const,
        commitHash: 'test-hash',
        modelHash: 'test-model',
      };

      await expect(service.createSubmission(invalidData)).rejects.toThrow();
    });
  });
});
