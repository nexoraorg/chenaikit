import { ApiKey } from '../models/ApiKey';
import { FlagEvaluation } from '../models/FeatureFlag';

declare global {
  namespace Express {
    interface Request {
      apiKey?: ApiKey;
      featureFlags?: Record<string, FlagEvaluation>;
      /** Canonical API version resolved by the versioning middleware (e.g. "v1"). */
      apiVersion?: string;
      /** How the version was determined: path | header | query | default. */
      apiVersionSource?: 'path' | 'header' | 'query' | 'default';
    }
  }
}