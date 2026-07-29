import { Router, Request, Response } from 'express';
import type { Router as ExpressRouter } from 'express';
import { PrismaClient } from '@prisma/client';
import { validate } from '../../middleware/validation';
import { asyncHandler } from '../../middleware/errorHandler';
import { InferenceAttestationService } from '../../services/inferenceAttestationService';
import { createReceiptBodySchema, receiptIdParamsSchema, verifyReceiptBodySchema } from '../../schemas/attestation.schema';

export function createAttestationRouter(prisma: PrismaClient): Router {
  const router: ExpressRouter = Router();
  const attestationService = new InferenceAttestationService(prisma);

  router.post(
    '/',
    validate({ body: createReceiptBodySchema }),
    asyncHandler(async (req: Request, res: Response) => {
      await attestationService.createReceipt(req.body.receipt);
      res.status(201).json({ success: true });
    }),
  );

  router.get(
    '/:receiptId',
    validate({ params: receiptIdParamsSchema }),
    asyncHandler(async (req: Request, res: Response) => {
      const receipt = await attestationService.getReceipt(req.params.receiptId);
      if (!receipt) {
        res.status(404).json({ success: false, message: 'Receipt not found' });
        return;
      }
      res.json({ success: true, data: receipt });
    }),
  );

  router.post(
    '/verify',
    validate({ body: verifyReceiptBodySchema }),
    asyncHandler(async (req: Request, res: Response) => {
      const publicKeyHex = process.env.ATTESTATION_SIGNER_PUBLIC_KEY;
      if (!publicKeyHex) {
        res.status(503).json({ success: false, message: 'Signer public key not configured' });
        return;
      }
      const publicKey = Buffer.from(publicKeyHex, 'hex');
      const result = await attestationService.verifyReceipt(req.body.receipt, async () => publicKey);
      res.json({ success: true, data: result });
    }),
  );

  return router;
}
