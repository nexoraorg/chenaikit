import { ApiKey } from '../models/ApiKey';
import { FlagEvaluation } from '../models/FeatureFlag';
import { Logger } from '../utils/logger';

declare global {
  namespace Express {
    interface Request {
      apiKey?: ApiKey;
      featureFlags?: Record<string, FlagEvaluation>;
      /** Canonical API version resolved by the versioning middleware (e.g. "v1"). */
      apiVersion?: string;
      /** How the version was determined: path | header | query | default. */
      apiVersionSource?: 'path' | 'header' | 'query' | 'default';
      /** Unique request ID attached by requestIdMiddleware. */
      id: string;
      /** Epoch ms when the request was received, set by requestLoggingMiddleware. */
      startTime: number;
      /** Request-scoped child logger, set by requestLoggingMiddleware. */
      logger: Logger;
    }
  }
}