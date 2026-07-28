import { createHash } from 'crypto';
import { Prisma, PrismaClient } from '@prisma/client';
import { promotionPolicySchema } from '../schemas/modelEvaluation.schema';
import { ConflictError, NotFoundError, ValidationError } from '../utils/errors';

type Db = PrismaClient | Prisma.TransactionClient;
type Report = {
  schemaVersion: 1; modelArtifactHash: string; datasetHash: string; codeCommit: string;
  datasetRows: number; metrics: Record<string, number>;
  fairness: Record<string, number | string[]>; explainability: {
    additivityPassRate: number; p95ExplanationMs: number;
  }; policy: unknown; modelCard?: Record<string, unknown>;
};

export class ModelPromotionPolicyService {
  constructor(private prisma: PrismaClient) {}

  static canonicalHash(value: unknown): string {
    const normalize = (item: unknown): unknown =>
      Array.isArray(item) ? item.map(normalize) :
      item && typeof item === 'object'
        ? Object.fromEntries(Object.entries(item).sort(([a], [b]) => a.localeCompare(b)).map(([k, v]) => [k, normalize(v)]))
        : item;
    const canonical = JSON.stringify(normalize(value));
    return createHash('sha256').update(canonical).digest('hex');
  }

  private static check(name: string, actual: number | undefined, threshold: string) {
    const match = threshold.match(/^(>=|<=|>|<|==)\s*(-?\d+(?:\.\d+)?)$/);
    if (!match) throw new ValidationError(`Invalid policy threshold: ${threshold}`);
    const target = Number(match[2]);
    const passed = actual !== undefined && ({ '>=': actual >= target, '<=': actual <= target,
      '>': actual > target, '<': actual < target, '==': actual === target } as Record<string, boolean>)[match[1]];
    return { name, actual: actual ?? null, threshold, passed, reason: passed ? null : actual === undefined ? 'metric_missing' : 'threshold_not_met' };
  }

  evaluate(report: Report) {
    const policy = promotionPolicySchema.parse(report.policy);
    const checks = [ModelPromotionPolicyService.check('datasetRows', report.datasetRows, `>=${policy.minimumDatasetRows}`)];
    for (const [key, value] of Object.entries(policy.requiredMetrics))
      checks.push(ModelPromotionPolicyService.check(`metrics.${key}`, report.metrics[key], value));
    for (const [key, value] of Object.entries(policy.fairness))
      checks.push(ModelPromotionPolicyService.check(`fairness.${key}`, report.fairness[key] as number | undefined, value));
    checks.push(ModelPromotionPolicyService.check('explainability.additivityPassRate', report.explainability.additivityPassRate, policy.explainability.additivityPassRate));
    checks.push(ModelPromotionPolicyService.check('explainability.p95ExplanationMs', report.explainability.p95ExplanationMs, `<=${policy.explainability.maxP95ExplanationMs}`));
    const suppressed = report.fairness.suppressedCohorts as string[] | undefined;
    if (suppressed?.length) checks.push({ name: 'fairness.minimumCohortSize', actual: null, threshold: 'none suppressed', passed: false, reason: 'suppressed_cohorts_cannot_pass' });
    const passed = checks.every(check => check.passed);
    return { passed, decision: passed ? 'pass' : policy.onFailure, checks, policy };
  }

  async register(versionId: string, report: Report) {
    const version = await this.prisma.mLModelVersion.findUnique({ where: { id: versionId } });
    if (!version) throw new NotFoundError(`Model version '${versionId}' not found`);
    if (version.contentHash !== report.modelArtifactHash)
      throw new ConflictError('Evaluation artifact hash does not match the registered model version');
    const result = this.evaluate(report);
    const reportHash = ModelPromotionPolicyService.canonicalHash(report);
    return this.prisma.modelEvaluationReport.create({ data: {
      modelVersionId: versionId, schemaVersion: report.schemaVersion, reportJson: JSON.stringify(report),
      reportHash, policyJson: JSON.stringify(result.policy), policyHash: ModelPromotionPolicyService.canonicalHash(result.policy),
      artifactHash: report.modelArtifactHash, datasetHash: report.datasetHash, codeCommit: report.codeCommit,
      passed: result.passed, decision: result.decision,
      failureReasons: JSON.stringify(result.checks.filter(check => !check.passed)),
    }});
  }

  latest(versionId: string, db: Db = this.prisma) {
    return db.modelEvaluationReport.findFirst({ where: { modelVersionId: versionId }, orderBy: { createdAt: 'desc' } });
  }
}
