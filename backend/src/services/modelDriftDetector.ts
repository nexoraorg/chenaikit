import { PrismaClient } from '@prisma/client';
import { ModelRegistryService } from './modelRegistryService';
import { log } from '../utils/logger';
import { NotFoundError, ValidationError } from '../utils/errors';

export interface DriftCheckInput {
  modelVersionId: string;
  windowStart: Date;
  windowEnd: Date;
  baselineAuc: number;
  observedAuc: number;
}

export interface DriftCheckResult {
  id: string;
  modelVersionId: string;
  baselineAuc: number;
  observedAuc: number;
  aucDropPct: number;
  driftDetected: boolean;
  rolledBack: boolean;
}

const DEFAULT_DRIFT_THRESHOLD_PCT = 3.0; // alert when AUC drops more than 3%
const DEFAULT_CANARY_THRESHOLD_PCT = 5.0; // auto-rollback when degradation exceeds 5%

/**
 * Monitors production model performance for drift and runs automated canary
 * analysis: if a production version's observed AUC degrades beyond the
 * configured threshold relative to its baseline, it is flagged (and,
 * for canary-severity degradation, automatically rolled back).
 */
export class ModelDriftDetector {
  constructor(
    private prisma: PrismaClient,
    private registryService: ModelRegistryService
  ) {}

  /**
   * Records a drift check for a monitoring window and returns whether drift
   * was detected. Alerting threshold defaults to 3% AUC drop per the
   * acceptance criteria; canary auto-rollback uses a separate (usually
   * higher) threshold since rollback is a more disruptive action than an
   * alert.
   */
  async recordCheck(
    input: DriftCheckInput,
    options: { alertThresholdPct?: number; canaryThresholdPct?: number; autoRollbackActor?: string } = {}
  ): Promise<DriftCheckResult> {
    if (input.baselineAuc <= 0) {
      throw new ValidationError('baselineAuc must be > 0');
    }

    const alertThresholdPct = options.alertThresholdPct ?? DEFAULT_DRIFT_THRESHOLD_PCT;
    const canaryThresholdPct = options.canaryThresholdPct ?? DEFAULT_CANARY_THRESHOLD_PCT;

    const aucDropPct = ((input.baselineAuc - input.observedAuc) / input.baselineAuc) * 100;
    const driftDetected = aucDropPct > alertThresholdPct;

    const check = await this.prisma.modelDriftCheck.create({
      data: {
        modelVersionId: input.modelVersionId,
        windowStart: input.windowStart,
        windowEnd: input.windowEnd,
        baselineAuc: input.baselineAuc,
        observedAuc: input.observedAuc,
        aucDrop: aucDropPct,
        driftDetected,
      },
    });

    if (driftDetected) {
      log.warn('Model drift detected', {
        modelVersionId: input.modelVersionId,
        aucDropPct,
        baselineAuc: input.baselineAuc,
        observedAuc: input.observedAuc,
      });
    }

    let rolledBack = false;
    if (aucDropPct > canaryThresholdPct) {
      rolledBack = await this.autoRollbackIfNeeded(input.modelVersionId, options.autoRollbackActor);
    }

    if (driftDetected || rolledBack) {
      await this.prisma.modelDriftCheck.update({
        where: { id: check.id },
        data: { alertSent: true },
      });
    }

    return {
      id: check.id,
      modelVersionId: input.modelVersionId,
      baselineAuc: input.baselineAuc,
      observedAuc: input.observedAuc,
      aucDropPct,
      driftDetected,
      rolledBack,
    };
  }

  /**
   * Automated canary rollback: when a production version's degradation
   * exceeds the canary threshold, roll back to the most recently archived
   * (previously production) version for the same model.
   */
  private async autoRollbackIfNeeded(modelVersionId: string, actor?: string): Promise<boolean> {
    const version = await this.prisma.mLModelVersion.findUnique({ where: { id: modelVersionId } });
    if (!version || version.stage !== 'production') {
      return false;
    }

    const previousVersion = await this.prisma.mLModelVersion.findFirst({
      where: { modelId: version.modelId, stage: 'archived', id: { not: modelVersionId } },
      orderBy: { archivedAt: 'desc' },
    });

    if (!previousVersion) {
      log.error('Canary rollback triggered but no previous production version is available', undefined, {
        modelVersionId,
      });
      return false;
    }

    await this.registryService.rollback(
      version.modelId,
      previousVersion.id,
      actor || 'model-drift-detector'
    );

    log.warn('Automated canary rollback executed', {
      modelId: version.modelId,
      fromVersion: version.version,
      toVersion: previousVersion.version,
    });

    return true;
  }

  async getDriftHistory(modelVersionId: string): Promise<DriftCheckResult[]> {
    const checks = await this.prisma.modelDriftCheck.findMany({
      where: { modelVersionId },
      orderBy: { createdAt: 'desc' },
    });

    return checks.map((c) => ({
      id: c.id,
      modelVersionId: c.modelVersionId,
      baselineAuc: c.baselineAuc,
      observedAuc: c.observedAuc,
      aucDropPct: c.aucDrop,
      driftDetected: c.driftDetected,
      rolledBack: false,
    }));
  }

  async getVersionOrThrow(modelVersionId: string) {
    const version = await this.prisma.mLModelVersion.findUnique({ where: { id: modelVersionId } });
    if (!version) {
      throw new NotFoundError(`Model version '${modelVersionId}' not found`);
    }
    return version;
  }
}
