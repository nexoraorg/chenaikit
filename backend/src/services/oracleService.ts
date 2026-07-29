import { PrismaClient } from '@prisma/client';
import { OracleNode, OracleSubmission, Dispute, SlashEvent, ReputationSnapshot } from '../models/oracleModels';

const prisma = new PrismaClient();

export class OracleService {
  /**
   * Register a new oracle node
   */
  async registerNode(data: {
    address: string;
    publicKey: string;
    stake: bigint;
    metadata?: Record<string, any>;
  }): Promise<OracleNode> {
    return await prisma.oracleNode.create({
      data: {
        address: data.address,
        publicKey: data.publicKey,
        stake: data.stake,
        metadata: data.metadata ? JSON.stringify(data.metadata) : '{}',
      },
    });
  }

  /**
   * Unregister an oracle node
   */
  async unregisterNode(nodeId: string): Promise<OracleNode> {
    return await prisma.oracleNode.update({
      where: { id: nodeId },
      data: {
        isActive: false,
        unregisteredAt: new Date(),
      },
    });
  }

  /**
   * Get all active oracle nodes
   */
  async getActiveNodes(): Promise<OracleNode[]> {
    return await prisma.oracleNode.findMany({
      where: { isActive: true },
      orderBy: { reputation: 'desc' },
    });
  }

  /**
   * Get a specific oracle node by address
   */
  async getNodeByAddress(address: string): Promise<OracleNode | null> {
    return await prisma.oracleNode.findUnique({
      where: { address },
    });
  }

  /**
   * Record a commit submission
   */
  async recordCommit(data: {
    requestId: string;
    nodeId: string;
    modelHash: string;
    commitHash: string;
  }): Promise<OracleSubmission> {
    return await prisma.oracleSubmission.create({
      data: {
        requestId: data.requestId,
        nodeId: data.nodeId,
        modelHash: data.modelHash,
        commitHash: data.commitHash,
        phase: 'commit',
        status: 'committed',
      },
    });
  }

  /**
   * Record a reveal submission
   */
  async recordReveal(data: {
    requestId: string;
    nodeId: string;
    score: number;
    salt: string;
  }): Promise<OracleSubmission> {
    return await prisma.oracleSubmission.updateMany({
      where: {
        requestId: data.requestId,
        nodeId: data.nodeId,
      },
      data: {
        score: data.score,
        salt: data.salt,
        phase: 'reveal',
        status: 'revealed',
        revealedAt: new Date(),
      },
    }).then(() => prisma.oracleSubmission.findFirst({
      where: {
        requestId: data.requestId,
        nodeId: data.nodeId,
      },
    })) as Promise<OracleSubmission>;
  }

  /**
   * Finalize a submission
   */
  async finalizeSubmission(requestId: string): Promise<void> {
    await prisma.oracleSubmission.updateMany({
      where: { requestId },
      data: {
        phase: 'finalized',
        status: 'finalized',
        finalizedAt: new Date(),
      },
    });
  }

  /**
   * Get all submissions for a request
   */
  async getSubmissionsByRequest(requestId: string): Promise<OracleSubmission[]> {
    return await prisma.oracleSubmission.findMany({
      where: { requestId },
      include: { node: true },
      orderBy: { committedAt: 'asc' },
    });
  }

  /**
   * File a dispute
   */
  async fileDispute(data: {
    requestId: string;
    disputerAddress: string;
    evidence: Record<string, any>;
  }): Promise<Dispute> {
    return await prisma.dispute.create({
      data: {
        requestId: data.requestId,
        disputerAddress: data.disputerAddress,
        evidence: JSON.stringify(data.evidence),
        status: 'pending',
      },
    });
  }

  /**
   * Resolve a dispute
   */
  async resolveDispute(disputeId: string, resolution: {
    status: 'accepted' | 'rejected';
    resolvedBy: string;
    resolutionNotes?: string;
  }): Promise<Dispute> {
    return await prisma.dispute.update({
      where: { id: disputeId },
      data: {
        status: resolution.status,
        resolvedBy: resolution.resolvedBy,
        resolvedAt: new Date(),
        resolutionNotes: resolution.resolutionNotes,
      },
    });
  }

  /**
   * Get disputes by request ID
   */
  async getDisputesByRequest(requestId: string): Promise<Dispute[]> {
    return await prisma.dispute.findMany({
      where: { requestId },
      orderBy: { filedAt: 'desc' },
    });
  }

  /**
   * Record a slash event
   */
  async recordSlashEvent(data: {
    nodeId: string;
    requestId?: string;
    slashAmount: bigint;
    reason: string;
    treasuryShare: bigint;
    disputerShare?: string;
    disputerReward?: bigint;
  }): Promise<SlashEvent> {
    return await prisma.slashEvent.create({
      data: {
        nodeId: data.nodeId,
        requestId: data.requestId,
        slashAmount: data.slashAmount,
        reason: data.reason,
        treasuryShare: data.treasuryShare,
        disputerShare: data.disputerShare,
        disputerReward: data.disputerReward,
      },
    });
  }

  /**
   * Get slash events for a node
   */
  async getSlashEventsByNode(nodeId: string): Promise<SlashEvent[]> {
    return await prisma.slashEvent.findMany({
      where: { nodeId },
      include: { node: true },
      orderBy: { slashedAt: 'desc' },
    });
  }

  /**
   * Create a reputation snapshot
   */
  async createReputationSnapshot(data: {
    nodeId: string;
    reputation: number;
    delta: number;
    reason?: string;
  }): Promise<ReputationSnapshot> {
    return await prisma.reputationSnapshot.create({
      data: {
        nodeId: data.nodeId,
        reputation: data.reputation,
        delta: data.delta,
        reason: data.reason,
      },
    });
  }

  /**
   * Get reputation history for a node
   */
  async getReputationHistory(nodeId: string, limit: number = 100): Promise<ReputationSnapshot[]> {
    return await prisma.reputationSnapshot.findMany({
      where: { nodeId },
      orderBy: { snapshotAt: 'desc' },
      take: limit,
    });
  }

  /**
   * Update node reputation
   */
  async updateNodeReputation(nodeId: string, delta: number, reason?: string): Promise<OracleNode> {
    const node = await prisma.oracleNode.findUnique({
      where: { id: nodeId },
    });

    if (!node) {
      throw new Error('Node not found');
    }

    const newReputation = Math.max(0, node.reputation + delta);

    // Update node reputation
    const updatedNode = await prisma.oracleNode.update({
      where: { id: nodeId },
      data: { reputation: newReputation },
    });

    // Create reputation snapshot
    await this.createReputationSnapshot({
      nodeId,
      reputation: newReputation,
      delta,
      reason,
    });

    return updatedNode;
  }

  /**
   * Get oracle network statistics
   */
  async getNetworkStats(): Promise<{
    totalNodes: number;
    activeNodes: number;
    totalStake: bigint;
    averageReputation: number;
    totalSubmissions: number;
    totalDisputes: number;
    totalSlashes: number;
  }> {
    const [totalNodes, activeNodes, totalStake, totalSubmissions, totalDisputes, totalSlashes] = await Promise.all([
      prisma.oracleNode.count(),
      prisma.oracleNode.count({ where: { isActive: true } }),
      prisma.oracleNode.aggregate({
        _sum: { stake: true },
        where: { isActive: true },
      }),
      prisma.oracleSubmission.count(),
      prisma.dispute.count(),
      prisma.slashEvent.count(),
    ]);

    const avgReputation = await prisma.oracleNode.aggregate({
      _avg: { reputation: true },
      where: { isActive: true },
    });

    return {
      totalNodes,
      activeNodes,
      totalStake: totalStake._sum.stake || BigInt(0),
      averageReputation: avgReputation._avg.reputation || 0,
      totalSubmissions,
      totalDisputes,
      totalSlashes,
    };
  }

  /**
   * Get recent activity
   */
  async getRecentActivity(limit: number = 50): Promise<{
    submissions: OracleSubmission[];
    disputes: Dispute[];
    slashEvents: SlashEvent[];
  }> {
    const [submissions, disputes, slashEvents] = await Promise.all([
      prisma.oracleSubmission.findMany({
        take: limit,
        orderBy: { committedAt: 'desc' },
        include: { node: true },
      }),
      prisma.dispute.findMany({
        take: limit,
        orderBy: { filedAt: 'desc' },
      }),
      prisma.slashEvent.findMany({
        take: limit,
        orderBy: { slashedAt: 'desc' },
        include: { node: true },
      }),
    ]);

    return { submissions, disputes, slashEvents };
  }
}

export const oracleService = new OracleService();
