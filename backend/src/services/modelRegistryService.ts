import { PrismaClient } from '@prisma/client';
import { createHash } from 'crypto';
import {
  MLModel,
  MLModelVersion,
  MLModelCreateInput,
  ModelVersionRegisterInput,
  ModelStage,
} from '../models/MLModel';
import { log } from '../utils/logger';
import { ConflictError, NotFoundError, ValidationError } from '../utils/errors';

/**
 * Model registry: version control for ML model artifacts with
 * content-addressable storage, staging -> production promotion gates,
 * and lineage tracking (training run, dataset, code commit).
 */
export class ModelRegistryService {
  constructor(private prisma: PrismaClient) {}

  /**
   * Computes the SHA256 content hash of a model artifact buffer. Used for
   * content-addressable storage so identical artifacts are never duplicated
   * and tampering/drift in the artifact is detectable.
   */
  static hashArtifact(artifact: Buffer | string): string {
    return createHash('sha256').update(artifact).digest('hex');
  }

  async registerModel(input: MLModelCreateInput): Promise<MLModel> {
    const existing = await this.prisma.mLModel.findUnique({ where: { name: input.name } });
    if (existing) {
      throw new ConflictError(`Model '${input.name}' is already registered`);
    }

    const prismaModel = await this.prisma.mLModel.create({
      data: {
        name: input.name,
        description: input.description || '',
        taskType: input.taskType,
      },
    });

    log.info('ML model registered', { modelId: prismaModel.id, name: prismaModel.name });
    return MLModel.fromPrisma(prismaModel);
  }

  async getModelByName(name: string): Promise<MLModel | null> {
    const prismaModel = await this.prisma.mLModel.findUnique({ where: { name } });
    return prismaModel ? MLModel.fromPrisma(prismaModel) : null;
  }

  async listModels(): Promise<MLModel[]> {
    const prismaModels = await this.prisma.mLModel.findMany({ orderBy: { createdAt: 'desc' } });
    return prismaModels.map(MLModel.fromPrisma);
  }

  /**
   * Registers a new model version (artifact) under content-addressable
   * storage. New versions always start in the `staging` stage and require
   * an explicit `promote()` call (with an approval gate) to reach production.
   */
  async register(input: ModelVersionRegisterInput): Promise<MLModelVersion> {
    const model = await this.prisma.mLModel.findUnique({ where: { id: input.modelId } });
    if (!model) {
      throw new NotFoundError(`Model '${input.modelId}' not found`);
    }

    const existingVersion = await this.prisma.mLModelVersion.findUnique({
      where: { modelId_version: { modelId: input.modelId, version: input.version } },
    });
    if (existingVersion) {
      throw new ConflictError(`Version '${input.version}' already exists for this model`);
    }

    const contentHash = input.contentHash || ModelRegistryService.hashArtifact(input.artifactUri);

    const prismaVersion = await this.prisma.mLModelVersion.create({
      data: {
        modelId: input.modelId,
        version: input.version,
        stage: 'staging',
        artifactUri: input.artifactUri,
        contentHash,
        frameworkVersion: input.frameworkVersion,
        accuracy: input.accuracy,
        precision: input.precision,
        recall: input.recall,
        f1Score: input.f1Score,
        auc: input.auc,
        trainingDataUri: input.trainingDataUri,
        trainingDataHash: input.trainingDataHash,
        hyperparameters: JSON.stringify(input.hyperparameters || {}),
        metadata: JSON.stringify(input.metadata || {}),
        datasetVersion: input.datasetVersion,
        codeCommit: input.codeCommit,
        trainingRunId: input.trainingRunId,
      },
    });

    log.info('Model version registered', {
      modelId: input.modelId,
      version: input.version,
      contentHash,
    });

    return MLModelVersion.fromPrisma(prismaVersion);
  }

  async getVersion(modelId: string, version: string): Promise<MLModelVersion> {
    const prismaVersion = await this.prisma.mLModelVersion.findUnique({
      where: { modelId_version: { modelId, version } },
    });
    if (!prismaVersion) {
      throw new NotFoundError(`Version '${version}' not found for model '${modelId}'`);
    }
    return MLModelVersion.fromPrisma(prismaVersion);
  }

  async getVersionById(versionId: string): Promise<MLModelVersion> {
    const prismaVersion = await this.prisma.mLModelVersion.findUnique({ where: { id: versionId } });
    if (!prismaVersion) {
      throw new NotFoundError(`Model version '${versionId}' not found`);
    }
    return MLModelVersion.fromPrisma(prismaVersion);
  }

  async listVersions(modelId: string, stage?: ModelStage): Promise<MLModelVersion[]> {
    const prismaVersions = await this.prisma.mLModelVersion.findMany({
      where: { modelId, ...(stage ? { stage } : {}) },
      orderBy: { createdAt: 'desc' },
    });
    return prismaVersions.map(MLModelVersion.fromPrisma);
  }

  /**
   * Promotes a staging model version to production, requiring an approval
   * gate (an `approvedBy` actor identifier). Any currently-production
   * version for the same model is archived.
   */
  async promote(versionId: string, approvedBy: string): Promise<MLModelVersion> {
    if (!approvedBy) {
      throw new ValidationError('promote() requires an approvedBy actor for the approval gate');
    }

    const version = await this.getVersionById(versionId);
    if (version.stage === 'production') {
      return version;
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.mLModelVersion.updateMany({
        where: { modelId: version.modelId, stage: 'production' },
        data: { stage: 'archived', archivedAt: new Date() },
      });

      await tx.mLModelVersion.update({
        where: { id: versionId },
        data: {
          stage: 'production',
          approvedBy,
          approvedAt: new Date(),
          promotedAt: new Date(),
        },
      });
    });

    log.info('Model version promoted to production', {
      versionId,
      modelId: version.modelId,
      approvedBy,
    });

    return this.getVersionById(versionId);
  }

  /**
   * Rolls back production to a previously known-good version. The current
   * production version is archived and the target version is restored to
   * production without requiring a new approval (rollback is itself the
   * safety mechanism).
   */
  async rollback(modelId: string, targetVersionId: string, actor: string): Promise<MLModelVersion> {
    const target = await this.getVersionById(targetVersionId);
    if (target.modelId !== modelId) {
      throw new ValidationError('Target version does not belong to the specified model');
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.mLModelVersion.updateMany({
        where: { modelId, stage: 'production' },
        data: { stage: 'archived', archivedAt: new Date() },
      });

      await tx.mLModelVersion.update({
        where: { id: targetVersionId },
        data: {
          stage: 'production',
          promotedAt: new Date(),
          approvedBy: actor,
          approvedAt: new Date(),
        },
      });
    });

    log.warn('Model rolled back', { modelId, targetVersionId, actor });

    return this.getVersionById(targetVersionId);
  }

  async getProductionVersion(modelId: string): Promise<MLModelVersion | null> {
    const prismaVersion = await this.prisma.mLModelVersion.findFirst({
      where: { modelId, stage: 'production' },
    });
    return prismaVersion ? MLModelVersion.fromPrisma(prismaVersion) : null;
  }
}
