/**
 * Governance Delegation Helpers
 * @module governance/delegation
 * 
 * Utilities for managing vote delegation and computing effective voting power
 */

import {
  Checkpoint,
  DelegationInfo,
  DelegationNode,
  DelegationHistory,
  GovernanceError,
  GovernanceErrorType,
  GovernanceContracts,
} from './types';

/**
 * Delegation Manager - handles delegation operations and queries
 */
export class DelegationManager {
  private contracts: GovernanceContracts;
  private networkClient: any; // Stellar/Soroban network client

  constructor(contracts: GovernanceContracts, networkClient: any) {
    this.contracts = contracts;
    this.networkClient = networkClient;
  }

  /**
   * Delegate voting power to another account
   * @param delegator - Address delegating voting power
   * @param delegatee - Address receiving voting power
   * @returns Transaction hash
   */
  async delegate(delegator: string, delegatee: string): Promise<string> {
    try {
      // Call governance token contract's delegate function
      const tx = await this.networkClient.invokeContract({
        contractId: this.contracts.token,
        method: 'delegate',
        args: [delegator, delegatee],
        auth: delegator,
      });

      return tx.hash;
    } catch (error) {
      throw new GovernanceError(
        GovernanceErrorType.ContractError,
        `Failed to delegate: ${error}`,
        { delegator, delegatee, error }
      );
    }
  }

  /**
   * Undelegate voting power (delegate back to self)
   * @param account - Address to undelegate
   * @returns Transaction hash
   */
  async undelegate(account: string): Promise<string> {
    return this.delegate(account, account);
  }

  /**
   * Get current delegate for an account
   * @param account - Account to query
   * @returns Delegate address
   */
  async getDelegate(account: string): Promise<string> {
    try {
      const result = await this.networkClient.readContract({
        contractId: this.contracts.token,
        method: 'delegates',
        args: [account],
      });

      return result as string;
    } catch (error) {
      throw new GovernanceError(
        GovernanceErrorType.ContractError,
        `Failed to get delegate: ${error}`,
        { account, error }
      );
    }
  }

  /**
   * Get current voting power for an account
   * @param account - Account to query
   * @returns Current voting power
   */
  async getCurrentVotingPower(account: string): Promise<bigint> {
    try {
      const result = await this.networkClient.readContract({
        contractId: this.contracts.token,
        method: 'get_current_votes',
        args: [account],
      });

      return BigInt(result);
    } catch (error) {
      throw new GovernanceError(
        GovernanceErrorType.ContractError,
        `Failed to get current voting power: ${error}`,
        { account, error }
      );
    }
  }

  /**
   * Get historical voting power at a specific block
   * @param account - Account to query
   * @param blockNumber - Block number to query at
   * @returns Historical voting power
   */
  async getPriorVotingPower(account: string, blockNumber: bigint): Promise<bigint> {
    try {
      const result = await this.networkClient.readContract({
        contractId: this.contracts.token,
        method: 'get_prior_votes',
        args: [account, blockNumber],
      });

      return BigInt(result);
    } catch (error) {
      throw new GovernanceError(
        GovernanceErrorType.ContractError,
        `Failed to get prior voting power: ${error}`,
        { account, blockNumber, error }
      );
    }
  }

  /**
   * Get effective voting power including delegations
   * @param account - Account to query
   * @param blockNumber - Block number to query at (optional, defaults to current)
   * @returns Effective voting power
   */
  async getEffectiveVotingPower(
    account: string,
    blockNumber?: bigint
  ): Promise<bigint> {
    if (blockNumber !== undefined) {
      return this.getPriorVotingPower(account, blockNumber);
    }
    return this.getCurrentVotingPower(account);
  }

  /**
   * Get all delegation information for an account
   * @param account - Account to query
   * @returns Delegation information
   */
  async getDelegationInfo(account: string): Promise<DelegationInfo> {
    const delegate = await this.getDelegate(account);
    const votingPower = await this.getCurrentVotingPower(account);
    const tokenBalance = await this.getTokenBalance(account);
    const currentBlock = await this.networkClient.getCurrentBlock();

    return {
      delegator: account,
      delegate,
      votingPower,
      timestamp: BigInt(Date.now()),
    };
  }

  /**
   * Build delegation graph for visualization
   * @param accounts - List of accounts to include in graph
   * @returns Array of delegation nodes
   */
  async buildDelegationGraph(accounts: string[]): Promise<DelegationNode[]> {
    const nodes: Map<string, DelegationNode> = new Map();

    // First pass: collect basic information
    for (const account of accounts) {
      const delegate = await this.getDelegate(account);
      const tokenBalance = await this.getTokenBalance(account);
      const votingPower = await this.getCurrentVotingPower(account);

      nodes.set(account, {
        address: account,
        tokenBalance,
        votingPower,
        delegatedTo: delegate,
        delegatedFrom: [],
        depth: 0,
      });
    }

    // Second pass: build delegation relationships
    for (const [address, node] of nodes.entries()) {
      if (node.delegatedTo !== address) {
        const delegateNode = nodes.get(node.delegatedTo);
        if (delegateNode) {
          delegateNode.delegatedFrom.push(address);
        }
      }
    }

    // Third pass: calculate delegation depth
    const calculateDepth = (address: string, visited: Set<string> = new Set()): number => {
      if (visited.has(address)) return 0; // Circular delegation
      visited.add(address);

      const node = nodes.get(address);
      if (!node || node.delegatedTo === address) return 0;

      return 1 + calculateDepth(node.delegatedTo, visited);
    };

    for (const [address, node] of nodes.entries()) {
      node.depth = calculateDepth(address);
    }

    return Array.from(nodes.values());
  }

  /**
   * Get top delegates by voting power
   * @param limit - Maximum number of delegates to return
   * @returns Top delegates sorted by voting power
   */
  async getTopDelegates(limit: number = 10): Promise<Array<{address: string, votingPower: bigint}>> {
    // In a real implementation, this would query an indexer or scan events
    // For now, we provide the interface
    throw new Error('Not implemented - requires indexer integration');
  }

  /**
   * Get delegation history for an account
   * @param account - Account to query
   * @param fromBlock - Starting block (optional)
   * @param toBlock - Ending block (optional)
   * @returns Delegation history
   */
  async getDelegationHistory(
    account: string,
    fromBlock?: bigint,
    toBlock?: bigint
  ): Promise<DelegationHistory[]> {
    // Query DelegateChanged events for the account
    // This requires event indexing infrastructure
    throw new Error('Not implemented - requires event indexer');
  }

  /**
   * Get token balance for an account
   * @param account - Account to query
   * @returns Token balance
   */
  private async getTokenBalance(account: string): Promise<bigint> {
    try {
      const result = await this.networkClient.readContract({
        contractId: this.contracts.token,
        method: 'balance_of',
        args: [account],
      });

      return BigInt(result);
    } catch (error) {
      throw new GovernanceError(
        GovernanceErrorType.ContractError,
        `Failed to get token balance: ${error}`,
        { account, error }
      );
    }
  }
}

/**
 * Calculate voting power from checkpoints at a specific block
 * @param checkpoints - Array of checkpoints
 * @param blockNumber - Block number to query at
 * @returns Voting power at the specified block
 */
export function calculateVotingPowerAtBlock(
  checkpoints: Checkpoint[],
  blockNumber: bigint
): bigint {
  if (checkpoints.length === 0) {
    return 0n;
  }

  // Sort checkpoints by block number
  const sorted = [...checkpoints].sort((a, b) => 
    Number(a.fromBlock - b.fromBlock)
  );

  // Binary search for the checkpoint at or before blockNumber
  let left = 0;
  let right = sorted.length - 1;
  let result = 0n;

  while (left <= right) {
    const mid = Math.floor((left + right) / 2);
    const checkpoint = sorted[mid];

    if (checkpoint.fromBlock <= blockNumber) {
      result = checkpoint.votes;
      left = mid + 1;
    } else {
      right = mid - 1;
    }
  }

  return result;
}

/**
 * Validate delegation chain to prevent circular delegations
 * @param delegationGraph - Delegation graph
 * @param from - Source account
 * @param to - Target account
 * @returns True if delegation is valid, false if it would create a cycle
 */
export function validateDelegationChain(
  delegationGraph: Map<string, string>,
  from: string,
  to: string
): boolean {
  const visited = new Set<string>();
  let current = to;

  // Follow delegation chain from 'to' account
  while (current && current !== from) {
    if (visited.has(current)) {
      // Found a cycle not involving 'from'
      return true;
    }
    visited.add(current);
    current = delegationGraph.get(current) || '';
  }

  // If we reached 'from', this would create a cycle
  return current !== from;
}

/**
 * Calculate total delegated power for a delegate
 * @param delegate - Delegate address
 * @param delegationGraph - Delegation nodes
 * @returns Total delegated voting power
 */
export function calculateTotalDelegatedPower(
  delegate: string,
  delegationGraph: DelegationNode[]
): bigint {
  let total = 0n;

  for (const node of delegationGraph) {
    if (node.delegatedTo === delegate && node.address !== delegate) {
      total += node.tokenBalance;
    }
  }

  return total;
}

