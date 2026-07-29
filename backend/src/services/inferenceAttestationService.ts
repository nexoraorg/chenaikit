import { PrismaClient } from '@prisma/client';
import { ModelRegistryService } from './modelRegistryService';
import { ConflictError, NotFoundError, ValidationError } from '../utils/errors';
import { verifySignedReceipt } from '@chenaikit/core';
import type { SignedInferenceReceipt } from '@chenaikit/core';

export class InferenceAttestationService {
  private registryService: ModelRegistryService;

  constructor(private prisma: PrismaClient) {
    this.registryService = new ModelRegistryService(prisma);
  }

  async createReceipt(receipt: SignedInferenceReceipt): Promise<void> {
    const existing = await this.prisma.inferenceReceipt.findUnique({
      where: { receiptId: receipt.receiptId },
    });
    if (existing) {
      throw new ConflictError(`Receipt '${receipt.receiptId}' already exists`);
    }

    const modelVersion = await this.registryService.getVersionById(receipt.modelVersionId);
    if (modelVersion.contentHash !== receipt.artifactHash) {
      throw new ValidationError('Receipt artifact hash does not match the registered model version');
    }

    await this.prisma.inferenceReceipt.create({
      data: {
        receiptId: receipt.receiptId,
        nonce: receipt.nonce,
        issuedAt: new Date(receipt.issuedAt),
        expiresAt: receipt.expiresAt ? new Date(receipt.expiresAt) : null,
        requestId: receipt.requestId,
        correlationId: receipt.correlationId,
        subjectCommitment: receipt.subjectCommitment,
        modelId: receipt.modelId,
        modelVersionId: receipt.modelVersionId,
        modelSemanticVersion: receipt.modelSemanticVersion,
        artifactHash: receipt.artifactHash,
        featureSchemaHash: receipt.featureSchemaHash,
        featureCommitment: receipt.featureCommitment,
        featureMerkleRoot: receipt.featureMerkleRoot,
        outputCommitment: receipt.outputCommitment,
        publicResultSummary: receipt.publicResultSummary ? JSON.stringify(receipt.publicResultSummary) : null,
        keyId: receipt.keyId,
        network: receipt.network,
        ledgerMin: receipt.ledgerBounds?.minLedger,
        ledgerMax: receipt.ledgerBounds?.maxLedger,
        batchId: receipt.batchId,
        signature: receipt.signature,
        signatureScheme: receipt.signatureScheme,
      },
    });
  }

  async getReceipt(receiptId: string): Promise<SignedInferenceReceipt | null> {
    const record = await this.prisma.inferenceReceipt.findUnique({ where: { receiptId } });
    if (!record) {
      return null;
    }
    return {
      schemaVersion: 1,
      receiptId: record.receiptId,
      nonce: record.nonce,
      issuedAt: record.issuedAt.toISOString(),
      expiresAt: record.expiresAt?.toISOString(),
      requestId: record.requestId ?? undefined,
      correlationId: record.correlationId ?? undefined,
      subjectCommitment: record.subjectCommitment,
      modelId: record.modelId,
      modelVersionId: record.modelVersionId,
      modelSemanticVersion: record.modelSemanticVersion ?? undefined,
      artifactHash: record.artifactHash,
      featureSchemaHash: record.featureSchemaHash,
      featureCommitment: record.featureCommitment,
      featureMerkleRoot: record.featureMerkleRoot ?? undefined,
      outputCommitment: record.outputCommitment,
      publicResultSummary: record.publicResultSummary ? JSON.parse(record.publicResultSummary) : undefined,
      keyId: record.keyId,
      network: record.network,
      ledgerBounds: record.ledgerMin || record.ledgerMax ? {
        minLedger: record.ledgerMin ?? undefined,
        maxLedger: record.ledgerMax ?? undefined,
      } : undefined,
      batchId: record.batchId ?? undefined,
      signature: record.signature,
      signatureScheme: record.signatureScheme,
    };
  }

  async verifyReceipt(
    receipt: SignedInferenceReceipt,
    getPublicKey: (keyId: string) => Promise<Uint8Array | null>,
  ): Promise<{ valid: boolean; reason?: string }> {
    const modelVersion = await this.registryService.getVersionById(receipt.modelVersionId);
    if (modelVersion.contentHash !== receipt.artifactHash) {
      return { valid: false, reason: 'artifact_hash_mismatch' };
    }

    if (receipt.expiresAt && new Date(receipt.expiresAt) < new Date()) {
      return { valid: false, reason: 'receipt_expired' };
    }

    const validSignature = await verifySignedReceipt(receipt, getPublicKey);
    if (!validSignature) {
      return { valid: false, reason: 'invalid_signature' };
    }

    return { valid: true };
  }
}
