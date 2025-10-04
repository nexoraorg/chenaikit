import Redis, { Redis as RedisClient } from 'ioredis';

export interface RedisConfigOptions {
  host: string;
  port: number;
  username?: string;
  password?: string;
  db?: number;
  tls?: boolean;
}

let cachedClient: RedisClient | null = null;

export function getRedisConfig(): RedisConfigOptions {
  return {
    host: process.env.REDIS_HOST || '127.0.0.1',
    port: Number(process.env.REDIS_PORT || 6379),
    username: process.env.REDIS_USERNAME,
    password: process.env.REDIS_PASSWORD,
    db: process.env.REDIS_DB ? Number(process.env.REDIS_DB) : undefined,
    tls: process.env.REDIS_TLS === 'true',
  };
}

export function createRedisClient(): RedisClient {
  if (cachedClient) {
    return cachedClient;
  }

  const cfg = getRedisConfig();
  const connectionOptions: Record<string, unknown> = {
    host: cfg.host,
    port: cfg.port,
    db: cfg.db,
    enableAutoPipelining: true,
    maxRetriesPerRequest: 3,
    lazyConnect: true,
  };

  if (cfg.username) {
    (connectionOptions as any).username = cfg.username;
  }
  if (cfg.password) {
    (connectionOptions as any).password = cfg.password;
  }
  if (cfg.tls) {
    (connectionOptions as any).tls = {};
  }

  const client = new Redis(connectionOptions);

  client.on('error', (err: unknown) => {
    console.error('[redis] connection error', err);
  });
  client.on('connect', () => {
    console.log('[redis] connected');
  });
  client.on('reconnecting', () => {
    console.log('[redis] reconnecting');
  });

  cachedClient = client;
  return client;
}

export async function ensureRedisConnection(): Promise<RedisClient> {
  const client = createRedisClient();
  if (!(client as any).status || (client as any).status === 'end') {
    await client.connect();
  }
  return client;
}


