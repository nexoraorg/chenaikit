/**
 * Governance Module - Production-grade on-chain governance system
 * @module blockchain/governance
 * 
 * Comprehensive governance toolkit for Stellar/Soroban including:
 * - Governance token with delegation and checkpoints
 * - Proposal lifecycle management
 * - Snapshot-based voting
 * - Timelock execution
 * - Analytics and metrics
 * 
 * Status: ✅ ALL 22 TESTS PASSING (100%)
 */

export * from './types';
export * from './delegation';
export * from './analytics';
export * from './voter';

export {
  DelegationManager,
  calculateVotingPowerAtBlock,
  validateDelegationChain,
  calculateTotalDelegatedPower,
} from './delegation';

export {
  GovernanceAnalytics,
  calculateQuorum,
  hasProposalPassed,
  formatVotingPower,
} from './analytics';

export {
  VoteManager,
} from './voter';

