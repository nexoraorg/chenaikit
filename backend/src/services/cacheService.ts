import type { Redis as RedisClient } from 'ioredis';
import { ensureRedisConnection } from '../config/redis';
import type { CacheService, CacheValue } from '../types/cache';

function toStringValue(value: CacheValue): string {
  if (value === null || value === undefined) return 'null';
  if (typeof value === 'string') return value;
  return JSON.stringify(value);
}

function parseValue<T>(raw: string | null): T | null {
  if (raw === null) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return raw as unknown as T;
  }
}

export class RedisCacheService implements CacheService {
  private clientPromise: Promise<RedisClient>;

  constructor(client?: RedisClient) {
    this.clientPromise = client ? Promise.resolve(client) : ensureRedisConnection();
  }

  async get<T = CacheValue>(key: string): Promise<T | null> {
    const client = await this.clientPromise;
    const raw = await client.get(key);
    return parseValue<T>(raw);
  }

  async set<T = CacheValue>(key: string, value: T, options?: { ttlSeconds?: number }): Promise<void> {
    const client = await this.clientPromise;
    const payload = toStringValue(value as unknown as CacheValue);
    if (options?.ttlSeconds && options.ttlSeconds > 0) {
      await client.set(key, payload, 'EX', options.ttlSeconds);
    } else {
      await client.set(key, payload);
    }
  }

  async del(key: string): Promise<void> {
    const client = await this.clientPromise;
    await client.del(key);
  }

  async exists(key: string): Promise<boolean> {
    const client = await this.clientPromise;
    const n = await client.exists(key);
    return n === 1;
  }

  async incrBy(key: string, increment = 1): Promise<number> {
    const client = await this.clientPromise;
    return client.incrby(key, increment);
  }

  async expire(key: string, ttlSeconds: number): Promise<boolean> {
    const client = await this.clientPromise;
    const res = await client.expire(key, ttlSeconds);
    return res === 1;
  }
}

export const cache = new RedisCacheService();


