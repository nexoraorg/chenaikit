import {
  Experiment as PrismaExperiment,
  ExperimentVariant as PrismaExperimentVariant,
  ExperimentAssignment as PrismaExperimentAssignment,
  ExperimentEvent as PrismaExperimentEvent,
} from '@prisma/client';

export type ExperimentStatus = 'draft' | 'running' | 'paused' | 'completed' | 'rolled_back';
export type ExperimentEventType = 'exposure' | 'conversion' | 'metric';

export interface ExperimentVariantInput {
  name: string;
  modelVersionId: string;
  trafficWeight: number;
  isControl?: boolean;
}

export interface ExperimentCreateInput {
  key: string;
  name: string;
  description?: string;
  modelId: string;
  hypothesis?: string;
  metric: string;
  minimumDetectableEffect?: number;
  significanceLevel?: number;
  power?: number;
  bonferroniCorrection?: boolean;
  canaryThresholdPct?: number;
  canaryWindowHours?: number;
  variants: ExperimentVariantInput[];
}

export class Experiment {
  constructor(
    public id: string,
    public key: string,
    public name: string,
    public description: string,
    public modelId: string,
    public status: ExperimentStatus,
    public hypothesis: string,
    public metric: string,
    public minimumDetectableEffect: number | null,
    public significanceLevel: number,
    public power: number,
    public bonferroniCorrection: boolean,
    public canaryThresholdPct: number,
    public canaryWindowHours: number,
    public startedAt: Date | null,
    public endedAt: Date | null,
    public createdAt: Date,
    public updatedAt: Date
  ) {}

  static fromPrisma(prismaExperiment: PrismaExperiment): Experiment {
    return new Experiment(
      prismaExperiment.id,
      prismaExperiment.key,
      prismaExperiment.name,
      prismaExperiment.description,
      prismaExperiment.modelId,
      prismaExperiment.status as ExperimentStatus,
      prismaExperiment.hypothesis,
      prismaExperiment.metric,
      prismaExperiment.minimumDetectableEffect,
      prismaExperiment.significanceLevel,
      prismaExperiment.power,
      prismaExperiment.bonferroniCorrection,
      prismaExperiment.canaryThresholdPct,
      prismaExperiment.canaryWindowHours,
      prismaExperiment.startedAt,
      prismaExperiment.endedAt,
      prismaExperiment.createdAt,
      prismaExperiment.updatedAt
    );
  }
}

export class ExperimentVariant {
  constructor(
    public id: string,
    public experimentId: string,
    public modelVersionId: string,
    public name: string,
    public isControl: boolean,
    public trafficWeight: number,
    public createdAt: Date,
    public updatedAt: Date
  ) {}

  static fromPrisma(prismaVariant: PrismaExperimentVariant): ExperimentVariant {
    return new ExperimentVariant(
      prismaVariant.id,
      prismaVariant.experimentId,
      prismaVariant.modelVersionId,
      prismaVariant.name,
      prismaVariant.isControl,
      prismaVariant.trafficWeight,
      prismaVariant.createdAt,
      prismaVariant.updatedAt
    );
  }
}

export class ExperimentAssignment {
  constructor(
    public id: string,
    public experimentId: string,
    public variantId: string,
    public subjectId: string,
    public assignedAt: Date
  ) {}

  static fromPrisma(prismaAssignment: PrismaExperimentAssignment): ExperimentAssignment {
    return new ExperimentAssignment(
      prismaAssignment.id,
      prismaAssignment.experimentId,
      prismaAssignment.variantId,
      prismaAssignment.subjectId,
      prismaAssignment.assignedAt
    );
  }
}

export class ExperimentEvent {
  constructor(
    public id: string,
    public experimentId: string,
    public variantId: string,
    public subjectId: string,
    public eventType: ExperimentEventType,
    public metricName: string | null,
    public metricValue: number | null,
    public createdAt: Date
  ) {}

  static fromPrisma(prismaEvent: PrismaExperimentEvent): ExperimentEvent {
    return new ExperimentEvent(
      prismaEvent.id,
      prismaEvent.experimentId,
      prismaEvent.variantId,
      prismaEvent.subjectId,
      prismaEvent.eventType as ExperimentEventType,
      prismaEvent.metricName,
      prismaEvent.metricValue,
      prismaEvent.createdAt
    );
  }
}
