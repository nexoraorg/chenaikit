export type CacheValue = string | number | boolean | object | null;

export interface CacheEntry<T = CacheValue> {
  key: string;
  value: T;
  ttlSeconds?: number;
}

export interface CacheGetOptions {
  skipCache?: boolean;
}

export interface CacheSetOptions {
  ttlSeconds?: number;
}

export interface CacheService {
  get<T = CacheValue>(key: string): Promise<T | null>;
  set<T = CacheValue>(key: string, value: T, options?: CacheSetOptions): Promise<void>;
  del(key: string): Promise<void>;
  exists(key: string): Promise<boolean>;
  incrBy(key: string, increment?: number): Promise<number>;
  expire(key: string, ttlSeconds: number): Promise<boolean>;
}


