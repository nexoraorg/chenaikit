import { PrismaClient } from '@prisma/client';
import { oracleService } from '../services/oracleService';
import { jobQueue } from '../services/jobQueue';

const prisma = new PrismaClient();

interface ChainEvent {
  type: 'NodeRegistered' | 'CommitSubmitted' | 'RevealSubmitted' | 'AggregationFinalized' | 'DisputeFiled' | 'DisputeResolved' | 'NodeSlashed' | 'ReputationUpdated' | 'ModelVersionApproved';
  data: any;
  timestamp: number;
  txHash: string;
}

export class OracleEventReconciliationJob {
  private isRunning: boolean = false;
  private pollInterval: number = 5000; // 5 seconds
  private lastProcessedLedger: number = 0;

  /**
   * Start the event reconciliation job
   */
  async start(): Promise<void> {
    if (this.isRunning) {
      console.log('Oracle event reconciliation job is already running');
      return;
    }

    this.isRunning = true;
    console.log('Starting oracle event reconciliation job...');

    // Load last processed ledger from database
    await this.loadLastProcessedLedger();

    // Start polling for events
    this.poll();
  }

  /**
   * Stop the event reconciliation job
   */
  async stop(): Promise<void> {
    this.isRunning = false;
    console.log('Oracle event reconciliation job stopped');
  }

  /**
   * Poll for new chain events
   */
  private async poll(): Promise<void> {
    while (this.isRunning) {
      try {
        await this.processNewEvents();
      } catch (error) {
        console.error('Error processing oracle events:', error);
      }

      await new Promise(resolve => setTimeout(resolve, this.pollInterval));
    }
  }

  /**
   * Process new events from the chain
   */
  private async processNewEvents(): Promise<void> {
    // In production, this would use Soroban SDK to fetch events from the chain
    // For now, we'll simulate event processing
    
    const events = await this.fetchChainEvents(this.lastProcessedLedger);
    
    for (const event of events) {
      await this.processEvent(event);
    }

    if (events.length > 0) {
      const lastEvent = events[events.length - 1];
      this.lastProcessedLedger = lastEvent.timestamp;
      await this.saveLastProcessedLedger();
    }
  }

  /**
   * Fetch chain events since the last processed ledger
   */
  private async fetchChainEvents(fromLedger: number): Promise<ChainEvent[]> {
    // In production, this would use Soroban SDK to fetch events
    // For now, return empty array
    return [];
  }

  /**
   * Process a single chain event
   */
  private async processEvent(event: ChainEvent): Promise<void> {
    console.log(`Processing event: ${event.type}`, event.data);

    switch (event.type) {
      case 'NodeRegistered':
        await this.handleNodeRegistered(event.data);
        break;
      case 'CommitSubmitted':
        await this.handleCommitSubmitted(event.data);
        break;
      case 'RevealSubmitted':
        await this.handleRevealSubmitted(event.data);
        break;
      case 'AggregationFinalized':
        await this.handleAggregationFinalized(event.data);
        break;
      case 'DisputeFiled':
        await this.handleDisputeFiled(event.data);
        break;
      case 'DisputeResolved':
        await this.handleDisputeResolved(event.data);
        break;
      case 'NodeSlashed':
        await this.handleNodeSlashed(event.data);
        break;
      case 'ReputationUpdated':
        await this.handleReputationUpdated(event.data);
        break;
      case 'ModelVersionApproved':
        await this.handleModelVersionApproved(event.data);
        break;
      default:
        console.warn(`Unknown event type: ${event.type}`);
    }
  }

  /**
   * Handle NodeRegistered event
   */
  private async handleNodeRegistered(data: {
    nodeAddress: string;
    publicKey: string;
    stake: bigint;
  }): Promise<void> {
    try {
      // Check if node already exists
      const existingNode = await prisma.oracleNode.findUnique({
        where: { address: data.nodeAddress },
      });

      if (existingNode) {
        // Update existing node
        await prisma.oracleNode.update({
          where: { address: data.nodeAddress },
          data: {
            stake: data.stake,
            isActive: true,
            unregisteredAt: null,
          },
        });
      } else {
        // Create new node
        await oracleService.registerNode({
          address: data.nodeAddress,
          publicKey: data.publicKey,
          stake: data.stake,
        });
      }

      console.log(`Node registered: ${data.nodeAddress}`);
    } catch (error) {
      console.error('Error handling NodeRegistered event:', error);
    }
  }

  /**
   * Handle CommitSubmitted event
   */
  private async handleCommitSubmitted(data: {
    requestId: string;
    nodeAddress: string;
    modelHash: string;
    commitHash: string;
  }): Promise<void> {
    try {
      // Find node by address
      const node = await prisma.oracleNode.findUnique({
        where: { address: data.nodeAddress },
      });

      if (!node) {
        console.error(`Node not found: ${data.nodeAddress}`);
        return;
      }

      // Record commit
      await oracleService.recordCommit({
        requestId: data.requestId,
        nodeId: node.id,
        modelHash: data.modelHash,
        commitHash: data.commitHash,
      });

      console.log(`Commit recorded for request ${data.requestId} by node ${data.nodeAddress}`);
    } catch (error) {
      console.error('Error handling CommitSubmitted event:', error);
    }
  }

  /**
   * Handle RevealSubmitted event
   */
  private async handleRevealSubmitted(data: {
    requestId: string;
    nodeAddress: string;
    score: number;
    salt: string;
  }): Promise<void> {
    try {
      // Find node by address
      const node = await prisma.oracleNode.findUnique({
        where: { address: data.nodeAddress },
      });

      if (!node) {
        console.error(`Node not found: ${data.nodeAddress}`);
        return;
      }

      // Record reveal
      await oracleService.recordReveal({
        requestId: data.requestId,
        nodeId: node.id,
        score: data.score,
        salt: data.salt,
      });

      console.log(`Reveal recorded for request ${data.requestId} by node ${data.nodeAddress}`);
    } catch (error) {
      console.error('Error handling RevealSubmitted event:', error);
    }
  }

  /**
   * Handle AggregationFinalized event
   */
  private async handleAggregationFinalized(data: {
    requestId: string;
    aggregatedScore: number;
  }): Promise<void> {
    try {
      // Finalize all submissions for this request
      await oracleService.finalizeSubmission(data.requestId);

      console.log(`Aggregation finalized for request ${data.requestId}`);
    } catch (error) {
      console.error('Error handling AggregationFinalized event:', error);
    }
  }

  /**
   * Handle DisputeFiled event
   */
  private async handleDisputeFiled(data: {
    requestId: string;
    disputerAddress: string;
    evidence: any;
  }): Promise<void> {
    try {
      await oracleService.fileDispute({
        requestId: data.requestId,
        disputerAddress: data.disputerAddress,
        evidence: data.evidence,
      });

      console.log(`Dispute filed for request ${data.requestId} by ${data.disputerAddress}`);
    } catch (error) {
      console.error('Error handling DisputeFiled event:', error);
    }
  }

  /**
   * Handle DisputeResolved event
   */
  private async handleDisputeResolved(data: {
    disputeId: string;
    status: 'accepted' | 'rejected';
    resolvedBy: string;
    resolutionNotes?: string;
  }): Promise<void> {
    try {
      await oracleService.resolveDispute(data.disputeId, {
        status: data.status,
        resolvedBy: data.resolvedBy,
        resolutionNotes: data.resolutionNotes,
      });

      console.log(`Dispute ${data.disputeId} resolved as ${data.status}`);
    } catch (error) {
      console.error('Error handling DisputeResolved event:', error);
    }
  }

  /**
   * Handle NodeSlashed event
   */
  private async handleNodeSlashed(data: {
    nodeAddress: string;
    requestId?: string;
    slashAmount: bigint;
    reason: string;
    treasuryShare: bigint;
    disputerShare?: string;
    disputerReward?: bigint;
  }): Promise<void> {
    try {
      // Find node by address
      const node = await prisma.oracleNode.findUnique({
        where: { address: data.nodeAddress },
      });

      if (!node) {
        console.error(`Node not found: ${data.nodeAddress}`);
        return;
      }

      // Record slash event
      await oracleService.recordSlashEvent({
        nodeId: node.id,
        requestId: data.requestId,
        slashAmount: data.slashAmount,
        reason: data.reason,
        treasuryShare: data.treasuryShare,
        disputerShare: data.disputerShare,
        disputerReward: data.disputerReward,
      });

      // Update node reputation
      const reputationDelta = this.calculateReputationDelta(data.reason);
      await oracleService.updateNodeReputation(node.id, reputationDelta, data.reason);

      console.log(`Node ${data.nodeAddress} slashed for ${data.reason}`);
    } catch (error) {
      console.error('Error handling NodeSlashed event:', error);
    }
  }

  /**
   * Handle ReputationUpdated event
   */
  private async handleReputationUpdated(data: {
    nodeAddress: string;
    delta: number;
    reason?: string;
  }): Promise<void> {
    try {
      // Find node by address
      const node = await prisma.oracleNode.findUnique({
        where: { address: data.nodeAddress },
      });

      if (!node) {
        console.error(`Node not found: ${data.nodeAddress}`);
        return;
      }

      // Update node reputation
      await oracleService.updateNodeReputation(node.id, data.delta, data.reason);

      console.log(`Reputation updated for node ${data.nodeAddress}: ${data.delta}`);
    } catch (error) {
      console.error('Error handling ReputationUpdated event:', error);
    }
  }

  /**
   * Handle ModelVersionApproved event
   */
  private async handleModelVersionApproved(data: {
    modelHash: string;
    metadata: string;
  }): Promise<void> {
    try {
      // Update ML model version status in database
      await prisma.mLModelVersion.updateMany({
        where: { contentHash: data.modelHash },
        data: {
          stage: 'production',
          approvedAt: new Date(),
        },
      });

      console.log(`Model version approved: ${data.modelHash}`);
    } catch (error) {
      console.error('Error handling ModelVersionApproved event:', error);
    }
  }

  /**
   * Calculate reputation delta based on slash reason
   */
  private calculateReputationDelta(reason: string): number {
    switch (reason) {
      case 'deviation':
        return -50;
      case 'no_reveal':
        return -100;
      case 'frivolous_dispute':
        return -25;
      default:
        return -10;
    }
  }

  /**
   * Load last processed ledger from database
   */
  private async loadLastProcessedLedger(): Promise<void> {
    const config = await prisma.config.findUnique({
      where: { key: 'oracle_last_processed_ledger' },
    });

    if (config) {
      this.lastProcessedLedger = parseInt(config.value);
      console.log(`Loaded last processed ledger: ${this.lastProcessedLedger}`);
    } else {
      this.lastProcessedLedger = 0;
      await prisma.config.create({
        data: {
          key: 'oracle_last_processed_ledger',
          value: '0',
        },
      });
    }
  }

  /**
   * Save last processed ledger to database
   */
  private async saveLastProcessedLedger(): Promise<void> {
    await prisma.config.upsert({
      where: { key: 'oracle_last_processed_ledger' },
      update: { value: this.lastProcessedLedger.toString() },
      create: {
        key: 'oracle_last_processed_ledger',
        value: this.lastProcessedLedger.toString(),
      },
    });
  }
}

export const oracleEventReconciliationJob = new OracleEventReconciliationJob();
