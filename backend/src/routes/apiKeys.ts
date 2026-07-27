import { Router } from 'express';
import { ApiKeyController } from '../controllers/apiKeyController';
import { validate } from '../middleware/validation';
import { authenticate } from '../middleware/auth';
import {
   createApiKeyBodySchema,
   updateApiKeyBodySchema,
   apiKeyIdParamsSchema,
   listApiKeysQuerySchema,
   apiKeyUsageQuerySchema,
   rotateApiKeyBodySchema,
} from '../schemas/apiKey.schema';

const router = Router();

// All API key routes require authentication
router.use(authenticate);

// POST /api-keys — Create a new API key
router.post(
   '/',
   validate({ body: createApiKeyBodySchema }),
   ApiKeyController.createApiKey
);

// GET /api-keys — List all API keys
router.get(
   '/',
   validate({ query: listApiKeysQuerySchema }),
   ApiKeyController.listApiKeys
);

// GET /api-keys/:id — Get API key details
router.get(
   '/:id',
   validate({ params: apiKeyIdParamsSchema }),
   ApiKeyController.getApiKey
);

// PATCH /api-keys/:id — Update API key
router.patch(
   '/:id',
   validate({ params: apiKeyIdParamsSchema, body: updateApiKeyBodySchema }),
   ApiKeyController.updateApiKey
);

// POST /api-keys/:id/deactivate — Deactivate API key
router.post(
   '/:id/deactivate',
   validate({ params: apiKeyIdParamsSchema }),
   ApiKeyController.deactivateApiKey
);

// DELETE /api-keys/:id — Delete API key
router.delete(
   '/:id',
   validate({ params: apiKeyIdParamsSchema }),
   ApiKeyController.deleteApiKey
);

// GET /api-keys/:id/usage — Get API key usage analytics
router.get(
   '/:id/usage',
   validate({ params: apiKeyIdParamsSchema, query: apiKeyUsageQuerySchema }),
   ApiKeyController.getApiKeyUsage
);

// POST /api-keys/:id/reset-usage — Reset monthly usage counter
router.post(
   '/:id/reset-usage',
   validate({ params: apiKeyIdParamsSchema }),
   ApiKeyController.resetApiKeyUsage
);

// POST /api-keys/:id/rotate — Rotate API key (deactivate old, create new)
router.post(
   '/:id/rotate',
   validate({ params: apiKeyIdParamsSchema, body: rotateApiKeyBodySchema }),
   ApiKeyController.rotateApiKey
);

// POST /api-keys/validate — Validate an API key (admin)
router.post(
   '/validate',
   ApiKeyController.validateApiKey
);

export default router;
