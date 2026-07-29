export interface OracleNode {
  id: string;
  address: string;
  publicKey: string;
  stake: bigint;
  reputation: number;
  isActive: boolean;
  registeredAt: Date;
  unregisteredAt: Date | null;
  metadata: string;
}

export interface OracleSubmission {
  id: string;
  requestId: string;
  nodeId: string;
  node?: OracleNode;
  modelHash: string;
  commitHash: string;
  score: number | null;
  salt: string | null;
  phase: 'commit' | 'reveal' | 'finalized';
  committedAt: Date;
  revealedAt: Date | null;
  finalizedAt: Date | null;
  status: 'pending' | 'committed' | 'revealed' | 'finalized' | 'slashed';
}

export interface Dispute {
  id: string;
  requestId: string;
  disputerAddress: string;
  evidence: string;
  status: 'pending' | 'accepted' | 'rejected';
  filedAt: Date;
  resolvedAt: Date | null;
  resolvedBy: string | null;
  resolutionNotes: string | null;
  metadata: string;
}

export interface SlashEvent {
  id: string;
  nodeId: string;
  node?: OracleNode;
  requestId: string | null;
  slashAmount: bigint;
  reason: string;
  slashedAt: Date;
  treasuryShare: bigint;
  disputerShare: string | null;
  disputerReward: bigint | null;
}

export interface ReputationSnapshot {
  id: string;
  nodeId: string;
  node?: OracleNode;
  reputation: number;
  delta: number;
  reason: string | null;
  snapshotAt: Date;
}

export interface NetworkStats {
  totalNodes: number;
  activeNodes: number;
  totalStake: bigint;
  averageReputation: number;
  totalSubmissions: number;
  totalDisputes: number;
  totalSlashes: number;
}

export interface RecentActivity {
  submissions: OracleSubmission[];
  disputes: Dispute[];
  slashEvents: SlashEvent[];
}
