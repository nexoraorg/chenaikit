/**
 * Governance System TypeScript Types
 * @module governance/types
 * 
 * Shared types and interfaces for the on-chain governance system
 * Compatible with Soroban governance contracts
 */

/**
 * Proposal states following Compound governance model
 */
export enum ProposalState {
  Pending = 0,
  Active = 1,
  Canceled = 2,
  Defeated = 3,
  Succeeded = 4,
  Queued = 5,
  Expired = 6,
  Executed = 7,
}

/**
 * Vote support types
 */
export enum VoteSupport {
  Against = 0,
  For = 1,
  Abstain = 2,
}

/**
 * Checkpoint for historical voting power
 */
export interface Checkpoint {
  fromBlock: bigint;
  votes: bigint;
}

/**
 * Proposal structure
 */
export interface Proposal {
  id: bigint;
  proposer: string;
  targets: string[];
  values: bigint[];
  calldatas: string[];
  description: string;
  startBlock: bigint;
  endBlock: bigint;
  forVotes: bigint;
  againstVotes: bigint;
  abstainVotes: bigint;
  canceled: boolean;
  executed: boolean;
  eta: bigint; // Execution time after timelock (unix timestamp)
  state?: ProposalState; // Computed state
}

/**
 * Vote record for a specific voter on a proposal
 */
export interface VoteRecord {
  hasVoted: boolean;
  support: VoteSupport;
  votes: bigint;
}

/**
 * Governance configuration parameters
 */
export interface GovernanceConfig {
  votingDelay: bigint;       // Blocks to wait before voting starts
  votingPeriod: bigint;      // Blocks for voting duration
  proposalThreshold: bigint; // Minimum tokens to create proposal
  quorumNumerator: bigint;   // Numerator for quorum calculation (out of 100)
  timelockDelay: bigint;     // Seconds to wait before execution
}

/**
 * Vote counts for a proposal
 */
export interface VoteCounts {
  forVotes: bigint;
  againstVotes: bigint;
  abstainVotes: bigint;
  totalVotes: bigint;
}

/**
 * Delegation information
 */
export interface DelegationInfo {
  delegator: string;
  delegate: string;
  votingPower: bigint;
  timestamp: bigint;
}

/**
 * Voter information with voting power
 */
export interface VoterInfo {
  address: string;
  votingPower: bigint;
  tokenBalance: bigint;
  delegatedVotes: bigint; // Votes delegated to this address
  hasVoted: boolean;
  voteSupport?: VoteSupport;
}

/**
 * Governance analytics snapshot
 */
export interface GovernanceSnapshot {
  timestamp: bigint;
  blockNumber: bigint;
  totalSupply: bigint;
  totalDelegated: bigint;
  totalVotingPower: bigint;
  activeProposals: number;
  totalProposals: number;
}

/**
 * Proposal analytics
 */
export interface ProposalAnalytics {
  proposalId: bigint;
  state: ProposalState;
  turnoutPercentage: number;
  quorumReached: boolean;
  votingPowerDistribution: {
    forPercentage: number;
    againstPercentage: number;
    abstainPercentage: number;
  };
  uniqueVoters: number;
  topVoters: VoterInfo[];
}

/**
 * Delegation graph node
 */
export interface DelegationNode {
  address: string;
  tokenBalance: bigint;
  votingPower: bigint;
  delegatedTo: string;
  delegatedFrom: string[];
  depth: number; // Delegation chain depth
}

/**
 * Timelock transaction
 */
export interface TimelockTransaction {
  target: string;
  value: bigint;
  data: string;
  eta: bigint;
  txHash: string;
  queued: boolean;
  executed: boolean;
}

/**
 * Governance event types
 */
export enum GovernanceEventType {
  ProposalCreated = 'ProposalCreated',
  VoteCast = 'VoteCast',
  ProposalQueued = 'ProposalQueued',
  ProposalExecuted = 'ProposalExecuted',
  ProposalCanceled = 'ProposalCanceled',
  DelegateChanged = 'DelegateChanged',
  DelegateVotesChanged = 'DelegateVotesChanged',
}

/**
 * Governance event
 */
export interface GovernanceEvent {
  type: GovernanceEventType;
  blockNumber: bigint;
  timestamp: bigint;
  transactionHash: string;
  data: Record<string, any>;
}

/**
 * Error types for governance operations
 */
export enum GovernanceErrorType {
  Unauthorized = 'Unauthorized',
  InsufficientBalance = 'InsufficientBalance',
  InvalidProposal = 'InvalidProposal',
  ProposalNotActive = 'ProposalNotActive',
  AlreadyVoted = 'AlreadyVoted',
  BelowProposalThreshold = 'BelowProposalThreshold',
  ProposalNotSucceeded = 'ProposalNotSucceeded',
  TimelockNotExpired = 'TimelockNotExpired',
  ProposalAlreadyExecuted = 'ProposalAlreadyExecuted',
  ExecutionFailed = 'ExecutionFailed',
  InvalidState = 'InvalidState',
  QuorumNotReached = 'QuorumNotReached',
  InvalidCheckpoint = 'InvalidCheckpoint',
  ArrayLengthMismatch = 'ArrayLengthMismatch',
  NetworkError = 'NetworkError',
  ContractError = 'ContractError',
}

/**
 * Governance error
 */
export class GovernanceError extends Error {
  constructor(
    public type: GovernanceErrorType,
    message: string,
    public details?: any
  ) {
    super(message);
    this.name = 'GovernanceError';
  }
}

/**
 * Contract addresses for governance system
 */
export interface GovernanceContracts {
  token: string;
  proposalManager: string;
  votingSystem: string;
  timelock: string;
}

/**
 * Query parameters for fetching proposals
 */
export interface ProposalQuery {
  state?: ProposalState;
  proposer?: string;
  fromBlock?: bigint;
  toBlock?: bigint;
  limit?: number;
  offset?: number;
}

/**
 * Historical voting power query
 */
export interface VotingPowerQuery {
  account: string;
  blockNumber: bigint;
}

/**
 * Delegation history entry
 */
export interface DelegationHistory {
  blockNumber: bigint;
  timestamp: bigint;
  from: string;
  to: string;
  votingPower: bigint;
}

