import {
  MLModel as PrismaMLModel,
  MLModelVersion as PrismaMLModelVersion,
} from '@prisma/client';

export type ModelStage = 'staging' | 'production' | 'archived';

export interface MLModelCreateInput {
  name: string;
  description?: string;
  taskType: string;
}

export interface ModelVersionRegisterInput {
  modelId: string;
  version: string;
  artifactUri: string;
  contentHash?: string; // computed by ModelRegistryService if omitted
  frameworkVersion?: string;
  accuracy?: number;
  precision?: number;
  recall?: number;
  f1Score?: number;
  auc?: number;
  trainingDataUri?: string;
  trainingDataHash?: string;
  hyperparameters?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
  datasetVersion?: string;
  codeCommit?: string;
  trainingRunId?: string;
}

export class MLModel {
  constructor(
    public id: string,
    public name: string,
    public description: string,
    public taskType: string,
    public createdAt: Date,
    public updatedAt: Date
  ) {}

  static fromPrisma(prismaModel: PrismaMLModel): MLModel {
    return new MLModel(
      prismaModel.id,
      prismaModel.name,
      prismaModel.description,
      prismaModel.taskType,
      prismaModel.createdAt,
      prismaModel.updatedAt
    );
  }
}

export class MLModelVersion {
  constructor(
    public id: string,
    public modelId: string,
    public version: string,
    public stage: ModelStage,
    public artifactUri: string,
    public contentHash: string,
    public frameworkVersion: string | null,
    public accuracy: number | null,
    public precision: number | null,
    public recall: number | null,
    public f1Score: number | null,
    public auc: number | null,
    public trainingDataUri: string | null,
    public trainingDataHash: string | null,
    public hyperparameters: Record<string, unknown>,
    public metadata: Record<string, unknown>,
    public datasetVersion: string | null,
    public codeCommit: string | null,
    public trainingRunId: string | null,
    public approvedBy: string | null,
    public approvedAt: Date | null,
    public promotedAt: Date | null,
    public archivedAt: Date | null,
    public createdAt: Date,
    public updatedAt: Date
  ) {}

  static fromPrisma(prismaVersion: PrismaMLModelVersion): MLModelVersion {
    return new MLModelVersion(
      prismaVersion.id,
      prismaVersion.modelId,
      prismaVersion.version,
      prismaVersion.stage as ModelStage,
      prismaVersion.artifactUri,
      prismaVersion.contentHash,
      prismaVersion.frameworkVersion,
      prismaVersion.accuracy,
      prismaVersion.precision,
      prismaVersion.recall,
      prismaVersion.f1Score,
      prismaVersion.auc,
      prismaVersion.trainingDataUri,
      prismaVersion.trainingDataHash,
      JSON.parse(prismaVersion.hyperparameters || '{}'),
      JSON.parse(prismaVersion.metadata || '{}'),
      prismaVersion.datasetVersion,
      prismaVersion.codeCommit,
      prismaVersion.trainingRunId,
      prismaVersion.approvedBy,
      prismaVersion.approvedAt,
      prismaVersion.promotedAt,
      prismaVersion.archivedAt,
      prismaVersion.createdAt,
      prismaVersion.updatedAt
    );
  }
}
