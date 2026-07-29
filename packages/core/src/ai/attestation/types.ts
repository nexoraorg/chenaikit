export interface ReceiptLedgerBounds {
  minLedger?: number;
  maxLedger?: number;
}

export interface InferenceReceiptV1 {
  schemaVersion: 1;
  receiptId: string;
  nonce: string;
  issuedAt: string;
  expiresAt?: string;
  requestId?: string;
  correlationId?: string;
  subjectCommitment: string;
  modelId: string;
  modelVersionId: string;
  modelSemanticVersion?: string;
  artifactHash: string;
  featureSchemaHash: string;
  featureCommitment: string;
  featureMerkleRoot?: string;
  outputCommitment: string;
  publicResultSummary?: Record<string, unknown>;
  keyId: string;
  network: string;
  ledgerBounds?: ReceiptLedgerBounds;
  batchId?: string;
}

export interface SignedInferenceReceipt extends InferenceReceiptV1 {
  signature: string;
  signatureScheme: 'ed25519';
}

export interface ReceiptProof {
  leafIndex: number;
  hashes: string[];
  leafHash: string;
}

export interface ReceiptBatch {
  batchId: string;
  root: string;
  count: number;
  receipts: SignedInferenceReceipt[];
  leafHashes: string[];
}

export interface VerificationResult {
  valid: boolean;
  reason?: string;
}

export interface RegistrySignerRecord {
  publicKey: string;
  validFrom: string;
  validUntil?: string;
  revokedAt?: string;
}

export interface RegistryModelRecord {
  artifactHash: string;
  schemaVersion: number;
  registeredAt: string;
  revokedAt?: string;
}

export interface RegistryBatchRecord {
  root: string;
  count: number;
  ledger: number;
  timestamp: string;
  schemaVersion: number;
}

export interface RegistryClient {
  getSigner(keyId: string): Promise<RegistrySignerRecord | null>;
  getModel(modelId: string, modelVersionId: string): Promise<RegistryModelRecord | null>;
  getBatch(batchId: string): Promise<RegistryBatchRecord | null>;
}

export interface SignerProvider {
  getKeyId(): string;
  getPublicKey(): Uint8Array;
  sign(message: Uint8Array): Promise<Uint8Array>;
}
