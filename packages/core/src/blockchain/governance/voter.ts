/**
 * Governance Voting Helpers
 * @module governance/voter
 * 
 * Utilities for casting votes and querying vote status
 */

import {
  VoteSupport,
  VoteRecord,
  GovernanceError,
  GovernanceErrorType,
  GovernanceContracts,
} from './types';

/**
 * Vote Manager - handles vote casting and queries
 */
export class VoteManager {
  private contracts: GovernanceContracts;
  private networkClient: any;

  constructor(contracts: GovernanceContracts, networkClient: any) {
    this.contracts = contracts;
    this.networkClient = networkClient;
  }

  /**
   * Cast a vote on a proposal
   * @param proposalId - Proposal ID to vote on
   * @param voter - Voter address
   * @param support - Vote choice (For/Against/Abstain)
   * @returns Transaction hash
   */
  async castVote(
    proposalId: bigint,
    voter: string,
    support: VoteSupport
  ): Promise<string> {
    try {
      // Get proposal to find snapshot block
      const proposal = await this.networkClient.readContract({
        contractId: this.contracts.proposalManager,
        method: 'get_proposal',
        args: [proposalId],
      });

      const snapshotBlock = proposal.start_block || proposal.startBlock;

      // Cast vote with snapshot block
      const tx = await this.networkClient.invokeContract({
        contractId: this.contracts.votingSystem,
        method: 'cast_vote',
        args: [
          this.contracts.token,
          proposalId,
          snapshotBlock,
          voter,
          support
        ],
        auth: voter,
      });

      // Record vote in proposal manager
      await this.networkClient.invokeContract({
        contractId: this.contracts.proposalManager,
        method: 'record_vote',
        args: [proposalId, support, tx.votes || 0],
      });

      return tx.hash;
    } catch (error) {
      throw new GovernanceError(
        GovernanceErrorType.ContractError,
        `Failed to cast vote: ${error}`,
        { proposalId, voter, support, error }
      );
    }
  }

  /**
   * Cast a vote with a reason
   * @param proposalId - Proposal ID to vote on
   * @param voter - Voter address
   * @param support - Vote choice
   * @param reason - Reason for vote
   * @returns Transaction hash
   */
  async castVoteWithReason(
    proposalId: bigint,
    voter: string,
    support: VoteSupport,
    reason: string
  ): Promise<string> {
    try {
      // Get proposal to find snapshot block
      const proposal = await this.networkClient.readContract({
        contractId: this.contracts.proposalManager,
        method: 'get_proposal',
        args: [proposalId],
      });

      const snapshotBlock = proposal.start_block || proposal.startBlock;

      // Cast vote with reason
      const tx = await this.networkClient.invokeContract({
        contractId: this.contracts.votingSystem,
        method: 'cast_vote_with_reason',
        args: [
          this.contracts.token,
          proposalId,
          snapshotBlock,
          voter,
          support,
          reason
        ],
        auth: voter,
      });

      // Record vote in proposal manager
      await this.networkClient.invokeContract({
        contractId: this.contracts.proposalManager,
        method: 'record_vote',
        args: [proposalId, support, tx.votes || 0],
      });

      return tx.hash;
    } catch (error) {
      throw new GovernanceError(
        GovernanceErrorType.ContractError,
        `Failed to cast vote with reason: ${error}`,
        { proposalId, voter, support, reason, error }
      );
    }
  }

  /**
   * Check if an address has voted
   * @param proposalId - Proposal ID
   * @param voter - Voter address
   * @returns True if voted
   */
  async hasVoted(proposalId: bigint, voter: string): Promise<boolean> {
    try {
      const result = await this.networkClient.readContract({
        contractId: this.contracts.votingSystem,
        method: 'has_voted',
        args: [proposalId, voter],
      });

      return Boolean(result);
    } catch (error) {
      throw new GovernanceError(
        GovernanceErrorType.ContractError,
        `Failed to check vote status: ${error}`,
        { proposalId, voter, error }
      );
    }
  }

  /**
   * Get vote receipt for a voter
   * @param proposalId - Proposal ID
   * @param voter - Voter address
   * @returns Vote record or null
   */
  async getVoteReceipt(
    proposalId: bigint,
    voter: string
  ): Promise<VoteRecord | null> {
    try {
      const result = await this.networkClient.readContract({
        contractId: this.contracts.votingSystem,
        method: 'get_receipt',
        args: [proposalId, voter],
      });

      if (!result) return null;

      return {
        hasVoted: Boolean(result.has_voted || result.hasVoted),
        support: result.support as VoteSupport,
        votes: BigInt(result.votes),
      };
    } catch (error) {
      throw new GovernanceError(
        GovernanceErrorType.ContractError,
        `Failed to get vote receipt: ${error}`,
        { proposalId, voter, error }
      );
    }
  }
}

