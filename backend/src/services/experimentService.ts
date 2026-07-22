import { PrismaClient } from '@prisma/client';
import { createHash } from 'crypto';
import {
  Experiment,
  ExperimentVariant,
  ExperimentAssignment,
  ExperimentCreateInput,
} from '../models/Experiment';
import {
  checkSignificance,
  bonferroniCorrectedAlpha,
  calculateMinimumSampleSize,
  VariantSample,
  SignificanceResult,
  PowerAnalysisResult,
} from '../utils/abStatistics';
import { log } from '../utils/logger';
import { ConflictError, NotFoundError, ValidationError } from '../utils/errors';

export interface VariantResult {
  variant: ExperimentVariant;
  exposures: number;
  conversions: number;
  conversionRate: number;
  significance?: SignificanceResult;
}

export interface ExperimentResults {
  experiment: Experiment;
  control: VariantResult;
  treatments: VariantResult[];
  powerAnalysis: PowerAnalysisResult | null;
  readyForDecision: boolean;
}

const TRAFFIC_WEIGHT_TOLERANCE = 0.001;

/**
 * A/B testing service: experiment creation with configurable traffic
 * splitting, deterministic sticky variant assignment, conversion tracking
 * and statistical-significance analysis (with peek prevention and
 * Bonferroni correction for multi-variant experiments).
 */
export class ExperimentService {
  constructor(private prisma: PrismaClient) {}

  async createExperiment(input: ExperimentCreateInput): Promise<Experiment> {
    if (input.variants.length < 2) {
      throw new ValidationError('An experiment requires at least two variants (control + treatment)');
    }

    const totalWeight = input.variants.reduce((sum, v) => sum + v.trafficWeight, 0);
    if (Math.abs(totalWeight - 100) > TRAFFIC_WEIGHT_TOLERANCE) {
      throw new ValidationError(`Variant traffic weights must sum to 100 (got ${totalWeight})`);
    }

    const controlCount = input.variants.filter((v) => v.isControl).length;
    if (controlCount > 1) {
      throw new ValidationError('An experiment can have at most one control variant');
    }

    const existing = await this.prisma.experiment.findUnique({ where: { key: input.key } });
    if (existing) {
      throw new ConflictError(`Experiment with key '${input.key}' already exists`);
    }

    const prismaExperiment = await this.prisma.experiment.create({
      data: {
        key: input.key,
        name: input.name,
        description: input.description || '',
        modelId: input.modelId,
        hypothesis: input.hypothesis || '',
        metric: input.metric,
        minimumDetectableEffect: input.minimumDetectableEffect,
        significanceLevel: input.significanceLevel ?? 0.05,
        power: input.power ?? 0.8,
        bonferroniCorrection: input.bonferroniCorrection ?? input.variants.length > 2,
        canaryThresholdPct: input.canaryThresholdPct ?? 5.0,
        canaryWindowHours: input.canaryWindowHours ?? 24,
        variants: {
          create: input.variants.map((v, index) => ({
            name: v.name,
            modelVersionId: v.modelVersionId,
            trafficWeight: v.trafficWeight,
            isControl: v.isControl ?? index === 0,
          })),
        },
      },
    });

    log.info('Experiment created', {
      experimentId: prismaExperiment.id,
      key: prismaExperiment.key,
      variantCount: input.variants.length,
    });

    return Experiment.fromPrisma(prismaExperiment);
  }

  async startExperiment(experimentId: string): Promise<Experiment> {
    const prismaExperiment = await this.prisma.experiment.update({
      where: { id: experimentId },
      data: { status: 'running', startedAt: new Date() },
    });
    return Experiment.fromPrisma(prismaExperiment);
  }

  async pauseExperiment(experimentId: string): Promise<Experiment> {
    const prismaExperiment = await this.prisma.experiment.update({
      where: { id: experimentId },
      data: { status: 'paused' },
    });
    return Experiment.fromPrisma(prismaExperiment);
  }

  async completeExperiment(experimentId: string): Promise<Experiment> {
    const prismaExperiment = await this.prisma.experiment.update({
      where: { id: experimentId },
      data: { status: 'completed', endedAt: new Date() },
    });
    return Experiment.fromPrisma(prismaExperiment);
  }

  async getExperiment(experimentId: string): Promise<Experiment> {
    const prismaExperiment = await this.prisma.experiment.findUnique({ where: { id: experimentId } });
    if (!prismaExperiment) {
      throw new NotFoundError(`Experiment '${experimentId}' not found`);
    }
    return Experiment.fromPrisma(prismaExperiment);
  }

  async listExperiments(): Promise<Experiment[]> {
    const prismaExperiments = await this.prisma.experiment.findMany({ orderBy: { createdAt: 'desc' } });
    return prismaExperiments.map(Experiment.fromPrisma);
  }

  async getVariants(experimentId: string): Promise<ExperimentVariant[]> {
    const prismaVariants = await this.prisma.experimentVariant.findMany({
      where: { experimentId },
      orderBy: { createdAt: 'asc' },
    });
    return prismaVariants.map(ExperimentVariant.fromPrisma);
  }

  /**
   * Deterministically buckets a subject into [0, 100) using a hash of the
   * experiment key and subject id. This ensures stable assignment (the same
   * subject always gets the same bucket for a given experiment) even across
   * multiple app servers / network partitions, without needing shared state
   * beyond the persisted assignment record.
   */
  private hashToBucket(experimentKey: string, subjectId: string): number {
    const hash = createHash('sha256').update(`${experimentKey}:${subjectId}`).digest('hex');
    const intValue = parseInt(hash.slice(0, 8), 16);
    return (intValue / 0xffffffff) * 100;
  }

  /**
   * Assigns a subject (user/session/account id) to a variant, honoring
   * configured traffic weights. Assignment is sticky: once a subject is
   * assigned, the same variant is always returned for that experiment.
   */
  async assignVariant(experimentId: string, subjectId: string): Promise<ExperimentVariant> {
    const existingAssignment = await this.prisma.experimentAssignment.findUnique({
      where: { experimentId_subjectId: { experimentId, subjectId } },
      include: { variant: true },
    });

    if (existingAssignment) {
      return ExperimentVariant.fromPrisma(existingAssignment.variant);
    }

    const experiment = await this.getExperiment(experimentId);
    const variants = await this.getVariants(experimentId);
    if (variants.length === 0) {
      throw new ValidationError('Experiment has no variants configured');
    }

    const bucket = this.hashToBucket(experiment.key, subjectId);
    let cumulative = 0;
    let selected = variants[variants.length - 1];
    for (const variant of variants) {
      cumulative += variant.trafficWeight;
      if (bucket < cumulative) {
        selected = variant;
        break;
      }
    }

    try {
      await this.prisma.experimentAssignment.create({
        data: { experimentId, variantId: selected.id, subjectId },
      });
    } catch (err) {
      // Race: another request assigned this subject concurrently. Return the
      // now-persisted assignment rather than failing the request.
      const raced = await this.prisma.experimentAssignment.findUnique({
        where: { experimentId_subjectId: { experimentId, subjectId } },
        include: { variant: true },
      });
      if (raced) return ExperimentVariant.fromPrisma(raced.variant);
      throw err;
    }

    await this.prisma.experimentEvent.create({
      data: { experimentId, variantId: selected.id, subjectId, eventType: 'exposure' },
    });

    return selected;
  }

  async getAssignment(experimentId: string, subjectId: string): Promise<ExperimentAssignment | null> {
    const prismaAssignment = await this.prisma.experimentAssignment.findUnique({
      where: { experimentId_subjectId: { experimentId, subjectId } },
    });
    return prismaAssignment ? ExperimentAssignment.fromPrisma(prismaAssignment) : null;
  }

  /**
   * Records a conversion event for the subject's assigned variant. If the
   * metric has a numeric value (e.g. loss amount avoided, score delta) it
   * can be attached via `metricValue`.
   */
  async trackConversion(experimentId: string, subjectId: string, metricValue?: number): Promise<void> {
    const assignment = await this.getAssignment(experimentId, subjectId);
    if (!assignment) {
      throw new ValidationError('Subject has not been assigned a variant for this experiment');
    }

    const experiment = await this.getExperiment(experimentId);

    await this.prisma.experimentEvent.create({
      data: {
        experimentId,
        variantId: assignment.variantId,
        subjectId,
        eventType: 'conversion',
        metricName: experiment.metric,
        metricValue,
      },
    });
  }

  private async getVariantSample(experimentId: string, variantId: string): Promise<VariantSample> {
    const [exposures, conversions] = await Promise.all([
      this.prisma.experimentEvent.count({
        where: { experimentId, variantId, eventType: 'exposure' },
      }),
      this.prisma.experimentEvent.count({
        where: { experimentId, variantId, eventType: 'conversion' },
      }),
    ]);

    const variant = await this.prisma.experimentVariant.findUniqueOrThrow({ where: { id: variantId } });

    return { name: variant.name, exposures, conversions };
  }

  /**
   * Computes full statistical results for an experiment: per-variant
   * conversion rates, significance vs. control (two-proportion z-test,
   * Bonferroni-corrected when there are more than two variants), and
   * whether the experiment has collected the minimum sample size required
   * by its configured power analysis (peek prevention).
   */
  async getResults(experimentId: string): Promise<ExperimentResults> {
    const experiment = await this.getExperiment(experimentId);
    const variants = await this.getVariants(experimentId);

    const controlVariant = variants.find((v) => v.isControl) || variants[0];
    const treatmentVariants = variants.filter((v) => v.id !== controlVariant.id);

    const controlSample = await this.getVariantSample(experimentId, controlVariant.id);

    const alpha = experiment.bonferroniCorrection
      ? bonferroniCorrectedAlpha(experiment.significanceLevel, treatmentVariants.length)
      : experiment.significanceLevel;

    const treatments: VariantResult[] = [];
    for (const variant of treatmentVariants) {
      const sample = await this.getVariantSample(experimentId, variant.id);
      const significance =
        controlSample.exposures > 0 && sample.exposures > 0
          ? checkSignificance(controlSample, sample, alpha)
          : undefined;

      treatments.push({
        variant,
        exposures: sample.exposures,
        conversions: sample.conversions,
        conversionRate: sample.exposures > 0 ? sample.conversions / sample.exposures : 0,
        significance,
      });
    }

    let powerAnalysis: PowerAnalysisResult | null = null;
    const baselineRate = controlSample.exposures > 0 ? controlSample.conversions / controlSample.exposures : 0;
    if (experiment.minimumDetectableEffect && baselineRate > 0 && baselineRate < 1) {
      powerAnalysis = calculateMinimumSampleSize(
        baselineRate,
        experiment.minimumDetectableEffect,
        experiment.significanceLevel,
        experiment.power
      );
    }

    const readyForDecision = powerAnalysis
      ? controlSample.exposures >= powerAnalysis.requiredSampleSizePerVariant &&
        treatments.every((t) => t.exposures >= powerAnalysis!.requiredSampleSizePerVariant)
      : false;

    return {
      experiment,
      control: {
        variant: controlVariant,
        exposures: controlSample.exposures,
        conversions: controlSample.conversions,
        conversionRate: baselineRate,
      },
      treatments,
      powerAnalysis,
      readyForDecision,
    };
  }
}
