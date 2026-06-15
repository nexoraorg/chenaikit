import { ApiKey } from '../models/ApiKey';

declare global {
  namespace Express {
    interface Request {
      apiKey?: ApiKey;
    }
  }
}