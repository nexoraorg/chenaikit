import { Router, Request, Response } from 'express';
import type { Router as ExpressRouter } from 'express';
import { PrismaClient } from '@prisma/client';
import { ModelRegistryService } from '../services/modelRegistryService';
import { ExperimentService } from '../services/experimentService';
import { ModelDriftDetector } from '../services/modelDriftDetector';
import { validate } from '../middleware/validation';
import { asyncHandler } from '../middleware/errorHandler';
import {
  registerModelBodySchema,
  modelIdParamsSchema,
  registerVersionBodySchema,
  versionIdParamsSchema,
  promoteVersionBodySchema,
  rollbackBodySchema,
  createExperimentBodySchema,
  experimentIdParamsSchema,
  assignVariantBodySchema,
  trackConversionBodySchema,
  recordDriftCheckBodySchema,
} from '../schemas';

/**
 * ML model registry, A/B experiment and drift-detection routes.
 *
 * Mounted at /api/ml-models. A dedicated PrismaClient is accepted so routes
 * can share the app-wide client instance in production while tests can
 * inject an isolated one.
 */
export function createMLModelRouter(prisma: PrismaClient): Router {
  const router = Router();
  const registryService = new ModelRegistryService(prisma);
  const experimentService = new ExperimentService(prisma);
  const driftDetector = new ModelDriftDetector(prisma, registryService);

  // -- Model registry ---------------------------------------------------

  router.post(
    '/',
    validate({ body: registerModelBodySchema }),
    asyncHandler(async (req: Request, res: Response) => {
      const model = await registryService.registerModel(req.body);
      res.status(201).json({ success: true, data: model });
    })
  );

  router.get(
    '/',
    asyncHandler(async (_req: Request, res: Response) => {
      const models = await registryService.listModels();
      res.json({ success: true, data: models });
    })
  );

  router.post(
    '/:modelId/versions',
    validate({ params: modelIdParamsSchema, body: registerVersionBodySchema }),
    asyncHandler(async (req: Request, res: Response) => {
      const version = await registryService.register({
        modelId: req.params.modelId,
        ...req.body,
      });
      res.status(201).json({ success: true, data: version });
    })
  );

  router.get(
    '/:modelId/versions',
    validate({ params: modelIdParamsSchema }),
    asyncHandler(async (req: Request, res: Response) => {
      const stage = req.query.stage as 'staging' | 'production' | 'archived' | undefined;
      const versions = await registryService.listVersions(req.params.modelId, stage);
      res.json({ success: true, data: versions });
    })
  );

  router.get(
    '/:modelId/versions/production',
    validate({ params: modelIdParamsSchema }),
    asyncHandler(async (req: Request, res: Response) => {
      const version = await registryService.getProductionVersion(req.params.modelId);
      res.json({ success: true, data: version });
    })
  );

  router.post(
    '/versions/:versionId/promote',
    validate({ params: versionIdParamsSchema, body: promoteVersionBodySchema }),
    asyncHandler(async (req: Request, res: Response) => {
      const version = await registryService.promote(req.params.versionId, req.body.approvedBy);
      res.json({ success: true, data: version });
    })
  );

  router.post(
    '/:modelId/rollback',
    validate({ params: modelIdParamsSchema, body: rollbackBodySchema }),
    asyncHandler(async (req: Request, res: Response) => {
      const version = await registryService.rollback(
        req.params.modelId,
        req.body.targetVersionId,
        req.body.actor
      );
      res.json({ success: true, data: version });
    })
  );

  // -- Drift detection ----------------------------------------------------

  router.post(
    '/versions/:versionId/drift-checks',
    validate({ params: versionIdParamsSchema, body: recordDriftCheckBodySchema }),
    asyncHandler(async (req: Request, res: Response) => {
      const { windowStart, windowEnd, baselineAuc, observedAuc, alertThresholdPct, canaryThresholdPct, autoRollbackActor } =
        req.body;
      const result = await driftDetector.recordCheck(
        {
          modelVersionId: req.params.versionId,
          windowStart: new Date(windowStart),
          windowEnd: new Date(windowEnd),
          baselineAuc,
          observedAuc,
        },
        { alertThresholdPct, canaryThresholdPct, autoRollbackActor }
      );
      res.status(201).json({ success: true, data: result });
    })
  );

  router.get(
    '/versions/:versionId/drift-checks',
    validate({ params: versionIdParamsSchema }),
    asyncHandler(async (req: Request, res: Response) => {
      const history = await driftDetector.getDriftHistory(req.params.versionId);
      res.json({ success: true, data: history });
    })
  );

  // -- Experiments ----------------------------------------------------------

  router.post(
    '/experiments',
    validate({ body: createExperimentBodySchema }),
    asyncHandler(async (req: Request, res: Response) => {
      const experiment = await experimentService.createExperiment(req.body);
      res.status(201).json({ success: true, data: experiment });
    })
  );

  router.get(
    '/experiments',
    asyncHandler(async (_req: Request, res: Response) => {
      const experiments = await experimentService.listExperiments();
      res.json({ success: true, data: experiments });
    })
  );

  router.get(
    '/experiments/:experimentId',
    validate({ params: experimentIdParamsSchema }),
    asyncHandler(async (req: Request, res: Response) => {
      const experiment = await experimentService.getExperiment(req.params.experimentId);
      const variants = await experimentService.getVariants(req.params.experimentId);
      res.json({ success: true, data: { ...experiment, variants } });
    })
  );

  router.post(
    '/experiments/:experimentId/start',
    validate({ params: experimentIdParamsSchema }),
    asyncHandler(async (req: Request, res: Response) => {
      const experiment = await experimentService.startExperiment(req.params.experimentId);
      res.json({ success: true, data: experiment });
    })
  );

  router.post(
    '/experiments/:experimentId/pause',
    validate({ params: experimentIdParamsSchema }),
    asyncHandler(async (req: Request, res: Response) => {
      const experiment = await experimentService.pauseExperiment(req.params.experimentId);
      res.json({ success: true, data: experiment });
    })
  );

  router.post(
    '/experiments/:experimentId/complete',
    validate({ params: experimentIdParamsSchema }),
    asyncHandler(async (req: Request, res: Response) => {
      const experiment = await experimentService.completeExperiment(req.params.experimentId);
      res.json({ success: true, data: experiment });
    })
  );

  router.post(
    '/experiments/:experimentId/assign',
    validate({ params: experimentIdParamsSchema, body: assignVariantBodySchema }),
    asyncHandler(async (req: Request, res: Response) => {
      const variant = await experimentService.assignVariant(req.params.experimentId, req.body.subjectId);
      res.json({ success: true, data: variant });
    })
  );

  router.post(
    '/experiments/:experimentId/convert',
    validate({ params: experimentIdParamsSchema, body: trackConversionBodySchema }),
    asyncHandler(async (req: Request, res: Response) => {
      await experimentService.trackConversion(
        req.params.experimentId,
        req.body.subjectId,
        req.body.metricValue
      );
      res.status(204).send();
    })
  );

  router.get(
    '/experiments/:experimentId/results',
    validate({ params: experimentIdParamsSchema }),
    asyncHandler(async (req: Request, res: Response) => {
      const results = await experimentService.getResults(req.params.experimentId);
      res.json({ success: true, data: results });
    })
  );

  return router;
}
