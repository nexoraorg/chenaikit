import { ApiKey } from '../models/ApiKey';
import { FlagEvaluation } from '../models/FeatureFlag';

declare global {
  namespace Express {
    interface Request {
      apiKey?: ApiKey;
      featureFlags?: Record<string, FlagEvaluation>;
    }
  }
}