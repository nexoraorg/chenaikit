/**
 * Governance Analytics Module
 * @module governance/analytics
 * 
 * Comprehensive analytics for governance proposals, voting patterns, and participation
 */

import {
  Proposal,
  ProposalState,
  ProposalAnalytics,
  VoteCounts,
  VoterInfo,
  VoteSupport,
  GovernanceSnapshot,
  GovernanceError,
  GovernanceErrorType,
  GovernanceContracts,
  ProposalQuery,
} from './types';

/**
 * Governance Analytics Engine
 */
export class GovernanceAnalytics {
  private contracts: GovernanceContracts;
  private networkClient: any;

  constructor(contracts: GovernanceContracts, networkClient: any) {
    this.contracts = contracts;
    this.networkClient = networkClient;
  }

  /**
   * Fetch a single proposal by ID
   * @param proposalId - Proposal ID to fetch
   * @returns Proposal details with computed state
   */
  async fetchProposal(proposalId: string | bigint): Promise<Proposal> {
    try {
      const id = BigInt(proposalId);
      
      const result = await this.networkClient.readContract({
        contractId: this.contracts.proposalManager,
        method: 'get_proposal',
        args: [id],
      });

      const proposal = this._parseProposal(result);
      
      // Get current state
      const stateResult = await this.networkClient.readContract({
        contractId: this.contracts.proposalManager,
        method: 'state',
        args: [id],
      });
      
      proposal.state = stateResult as ProposalState;

      return proposal;
    } catch (error) {
      throw new GovernanceError(
        GovernanceErrorType.ContractError,
        `Failed to fetch proposal: ${error}`,
        { proposalId, error }
      );
    }
  }

  /**
   * Fetch all proposals matching query criteria
   * @param query - Query parameters for filtering proposals
   * @returns Array of proposals
   */
  async fetchProposals(query?: ProposalQuery): Promise<Proposal[]> {
    try {
      const totalCount = await this.networkClient.readContract({
        contractId: this.contracts.proposalManager,
        method: 'proposal_count',
        args: [],
      });

      const count = Number(totalCount);
      const proposals: Proposal[] = [];
      const limit = query?.limit || count;
      const offset = query?.offset || 0;

      // Fetch proposals in range
      for (let i = 1; i <= count && proposals.length < limit; i++) {
        if (i <= offset) continue;

        try {
          const proposal = await this.fetchProposal(BigInt(i));
          
          // Apply filters
          if (query?.state !== undefined && proposal.state !== query.state) {
            continue;
          }
          if (query?.proposer && proposal.proposer !== query.proposer) {
            continue;
          }
          if (query?.fromBlock && proposal.startBlock < query.fromBlock) {
            continue;
          }
          if (query?.toBlock && proposal.endBlock > query.toBlock) {
            continue;
          }

          proposals.push(proposal);
        } catch (error) {
          // Skip proposals that fail to fetch
          continue;
        }
      }

      return proposals;
    } catch (error) {
      throw new GovernanceError(
        GovernanceErrorType.ContractError,
        `Failed to fetch proposals: ${error}`,
        { query, error }
      );
    }
  }

  /**
   * Compute turnout percentage for a proposal
   * @param proposalId - Proposal ID
   * @returns Turnout percentage (0-100)
   */
  async computeTurnout(proposalId: string | bigint): Promise<number> {
    try {
      const id = BigInt(proposalId);
      
      // Get proposal to access vote counts
      const proposal = await this.fetchProposal(id);
      
      const turnout = await this.networkClient.readContract({
        contractId: this.contracts.votingSystem,
        method: 'get_turnout',
        args: [
          this.contracts.token,
          proposal.forVotes,
          proposal.againstVotes,
          proposal.abstainVotes
        ],
      });

      return Number(turnout);
    } catch (error) {
      throw new GovernanceError(
        GovernanceErrorType.ContractError,
        `Failed to compute turnout: ${error}`,
        { proposalId, error }
      );
    }
  }

  /**
   * Get vote distribution for a proposal
   * @param proposalId - Proposal ID
   * @returns Vote counts
   */
  async getVoteDistribution(proposalId: string | bigint): Promise<VoteCounts> {
    try {
      const id = BigInt(proposalId);
      
      const [forVotes, againstVotes, abstainVotes] = await this.networkClient.readContract({
        contractId: this.contracts.votingSystem,
        method: 'get_votes',
        args: [id],
      });

      const totalVotes = BigInt(forVotes) + BigInt(againstVotes) + BigInt(abstainVotes);

      return {
        forVotes: BigInt(forVotes),
        againstVotes: BigInt(againstVotes),
        abstainVotes: BigInt(abstainVotes),
        totalVotes,
      };
    } catch (error) {
      throw new GovernanceError(
        GovernanceErrorType.ContractError,
        `Failed to get vote distribution: ${error}`,
        { proposalId, error }
      );
    }
  }

  /**
   * Check if quorum has been reached for a proposal
   * @param proposalId - Proposal ID
   * @returns True if quorum reached
   */
  async checkQuorumReached(proposalId: string | bigint): Promise<boolean> {
    try {
      const id = BigInt(proposalId);
      
      // Get proposal to access vote counts
      const proposal = await this.fetchProposal(id);
      
      const config = await this.networkClient.readContract({
        contractId: this.contracts.proposalManager,
        method: 'get_config',
        args: [],
      });

      const quorumReached = await this.networkClient.readContract({
        contractId: this.contracts.votingSystem,
        method: 'quorum_reached',
        args: [
          this.contracts.token,
          proposal.forVotes,
          proposal.againstVotes,
          proposal.abstainVotes,
          config.quorum_numerator
        ],
      });

      return Boolean(quorumReached);
    } catch (error) {
      throw new GovernanceError(
        GovernanceErrorType.ContractError,
        `Failed to check quorum: ${error}`,
        { proposalId, error }
      );
    }
  }

  /**
   * Get comprehensive analytics for a proposal
   * @param proposalId - Proposal ID
   * @returns Detailed proposal analytics
   */
  async getProposalAnalytics(proposalId: string | bigint): Promise<ProposalAnalytics> {
    const proposal = await this.fetchProposal(proposalId);
    const voteCounts = await this.getVoteDistribution(proposalId);
    const turnout = await this.computeTurnout(proposalId);
    const quorumReached = await this.checkQuorumReached(proposalId);

    // Calculate percentages
    const totalVotes = voteCounts.totalVotes;
    const forPercentage = totalVotes > 0 
      ? Number((voteCounts.forVotes * 10000n) / totalVotes) / 100
      : 0;
    const againstPercentage = totalVotes > 0
      ? Number((voteCounts.againstVotes * 10000n) / totalVotes) / 100
      : 0;
    const abstainPercentage = totalVotes > 0
      ? Number((voteCounts.abstainVotes * 10000n) / totalVotes) / 100
      : 0;

    return {
      proposalId: proposal.id,
      state: proposal.state!,
      turnoutPercentage: turnout,
      quorumReached,
      votingPowerDistribution: {
        forPercentage,
        againstPercentage,
        abstainPercentage,
      },
      uniqueVoters: 0, // Requires event indexing
      topVoters: [], // Requires event indexing
    };
  }

  /**
   * Get active delegated voting power
   * @returns Total delegated voting power across all accounts
   */
  async getActiveDelegatedPower(): Promise<bigint> {
    // This requires scanning all accounts or using an indexer
    // For now, return a placeholder
    throw new Error('Not implemented - requires indexer integration');
  }

  /**
   * Get historical governance snapshot at a specific block
   * @param blockNumber - Block number for snapshot
   * @returns Governance snapshot
   */
  async getHistoricalSnapshot(blockNumber: bigint): Promise<GovernanceSnapshot> {
    try {
      const totalSupply = await this.networkClient.readContract({
        contractId: this.contracts.token,
        method: 'total_supply',
        args: [],
      });

      const proposalCount = await this.networkClient.readContract({
        contractId: this.contracts.proposalManager,
        method: 'proposal_count',
        args: [],
      });

      const proposals = await this.fetchProposals();
      const activeProposals = proposals.filter(
        p => p.state === ProposalState.Active || p.state === ProposalState.Pending
      ).length;

      return {
        timestamp: BigInt(Date.now()),
        blockNumber,
        totalSupply: BigInt(totalSupply),
        totalDelegated: 0n, // Requires indexer
        totalVotingPower: BigInt(totalSupply),
        activeProposals,
        totalProposals: Number(proposalCount),
      };
    } catch (error) {
      throw new GovernanceError(
        GovernanceErrorType.ContractError,
        `Failed to get historical snapshot: ${error}`,
        { blockNumber, error }
      );
    }
  }

  /**
   * Get voter information for a specific proposal
   * @param proposalId - Proposal ID
   * @param voterAddress - Voter address
   * @returns Voter information
   */
  async getVoterInfo(proposalId: string | bigint, voterAddress: string): Promise<VoterInfo> {
    try {
      const id = BigInt(proposalId);
      const proposal = await this.fetchProposal(id);

      // Get voting power at snapshot
      const votingPower = await this.networkClient.readContract({
        contractId: this.contracts.token,
        method: 'get_prior_votes',
        args: [voterAddress, proposal.startBlock],
      });

      // Get current token balance
      const tokenBalance = await this.networkClient.readContract({
        contractId: this.contracts.token,
        method: 'balance_of',
        args: [voterAddress],
      });

      // Get delegated votes (voting power)
      const delegatedVotes = await this.networkClient.readContract({
        contractId: this.contracts.token,
        method: 'get_current_votes',
        args: [voterAddress],
      });

      // Check if voted
      const hasVoted = await this.networkClient.readContract({
        contractId: this.contracts.votingSystem,
        method: 'has_voted',
        args: [id, voterAddress],
      });

      let voteSupport: VoteSupport | undefined;
      if (hasVoted) {
        const receipt = await this.networkClient.readContract({
          contractId: this.contracts.votingSystem,
          method: 'get_receipt',
          args: [id, voterAddress],
        });
        voteSupport = receipt?.support;
      }

      return {
        address: voterAddress,
        votingPower: BigInt(votingPower),
        tokenBalance: BigInt(tokenBalance),
        delegatedVotes: BigInt(delegatedVotes),
        hasVoted: Boolean(hasVoted),
        voteSupport,
      };
    } catch (error) {
      throw new GovernanceError(
        GovernanceErrorType.ContractError,
        `Failed to get voter info: ${error}`,
        { proposalId, voterAddress, error }
      );
    }
  }

  /**
   * Get governance participation rate
   * @param fromBlock - Starting block (optional)
   * @param toBlock - Ending block (optional)
   * @returns Average participation rate percentage
   */
  async getParticipationRate(fromBlock?: bigint, toBlock?: bigint): Promise<number> {
    const proposals = await this.fetchProposals({
      fromBlock,
      toBlock,
      state: ProposalState.Executed,
    });

    if (proposals.length === 0) {
      return 0;
    }

    let totalTurnout = 0;
    for (const proposal of proposals) {
      const turnout = await this.computeTurnout(proposal.id);
      totalTurnout += turnout;
    }

    return totalTurnout / proposals.length;
  }

  /**
   * Get top proposals by participation
   * @param limit - Maximum number of proposals to return
   * @returns Top proposals sorted by turnout
   */
  async getTopProposalsByParticipation(
    limit: number = 10
  ): Promise<Array<{ proposal: Proposal; turnout: number }>> {
    const proposals = await this.fetchProposals();
    const proposalsWithTurnout: Array<{ proposal: Proposal; turnout: number }> = [];

    for (const proposal of proposals) {
      if (proposal.state === ProposalState.Active || 
          proposal.state === ProposalState.Executed ||
          proposal.state === ProposalState.Succeeded ||
          proposal.state === ProposalState.Defeated) {
        const turnout = await this.computeTurnout(proposal.id);
        proposalsWithTurnout.push({ proposal, turnout });
      }
    }

    return proposalsWithTurnout
      .sort((a, b) => b.turnout - a.turnout)
      .slice(0, limit);
  }

  /**
   * Parse raw proposal data from contract
   * @param raw - Raw proposal data
   * @returns Parsed proposal
   */
  private _parseProposal(raw: any): Proposal {
    return {
      id: BigInt(raw.id),
      proposer: raw.proposer,
      targets: raw.targets || [],
      values: (raw.values || []).map((v: any) => BigInt(v)),
      calldatas: raw.calldatas || [],
      description: raw.description || '',
      startBlock: BigInt(raw.start_block || raw.startBlock || 0),
      endBlock: BigInt(raw.end_block || raw.endBlock || 0),
      forVotes: BigInt(raw.for_votes || raw.forVotes || 0),
      againstVotes: BigInt(raw.against_votes || raw.againstVotes || 0),
      abstainVotes: BigInt(raw.abstain_votes || raw.abstainVotes || 0),
      canceled: Boolean(raw.canceled),
      executed: Boolean(raw.executed),
      eta: BigInt(raw.eta || 0),
    };
  }
}

/**
 * Calculate quorum requirement
 * @param totalSupply - Total token supply
 * @param quorumNumerator - Quorum numerator (out of 100)
 * @returns Required quorum amount
 */
export function calculateQuorum(totalSupply: bigint, quorumNumerator: number): bigint {
  return (totalSupply * BigInt(quorumNumerator)) / 100n;
}

/**
 * Check if proposal has passed
 * @param forVotes - For votes
 * @param againstVotes - Against votes
 * @param totalSupply - Total token supply
 * @param quorumNumerator - Quorum numerator
 * @returns True if proposal passed
 */
export function hasProposalPassed(
  forVotes: bigint,
  againstVotes: bigint,
  abstainVotes: bigint,
  totalSupply: bigint,
  quorumNumerator: number
): boolean {
  const quorum = calculateQuorum(totalSupply, quorumNumerator);
  const totalVotes = forVotes + againstVotes + abstainVotes;

  return totalVotes >= quorum && forVotes > againstVotes;
}

/**
 * Format voting power for display
 * @param votes - Vote amount
 * @param decimals - Token decimals
 * @returns Formatted string
 */
export function formatVotingPower(votes: bigint, decimals: number = 18): string {
  const divisor = 10n ** BigInt(decimals);
  const whole = votes / divisor;
  const fraction = votes % divisor;
  
  if (fraction === 0n) {
    return whole.toString();
  }

  const fractionStr = fraction.toString().padStart(decimals, '0').replace(/0+$/, '');
  return `${whole}.${fractionStr}`;
}

