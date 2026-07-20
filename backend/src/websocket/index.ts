import { Server as HttpServer } from 'http';
import { Server, Socket } from 'socket.io';
import { createAdapter } from '@socket.io/redis-adapter';
import Redis from 'ioredis';
import { verifyAccessToken } from '../utils/jwt';
import { UserPayload } from '../types/auth';
import { log } from '../utils/logger';

export interface CustomSocket extends Socket {
  data: {
    user?: UserPayload;
  };
}

let ioInstance: Server | null = null;
let pubClientInstance: Redis | null = null;
let subClientInstance: Redis | null = null;

export const NAMESPACES = {
  ALERTS: '/alerts',
  SCORES: '/scores',
  TRANSACTIONS: '/transactions'
} as const;

export interface InitWebSocketOptions {
  redisUrl?: string;
  corsOrigin?: string | string[];
  skipRedisInTest?: boolean;
}

export const socketAuthMiddleware = (socket: Socket, next: (err?: Error) => void) => {
  try {
    const authHeader = socket.handshake.headers.authorization;
    const authToken = socket.handshake.auth?.token;
    
    let token: string | undefined;

    if (authToken && typeof authToken === 'string') {
      token = authToken.startsWith('Bearer ') ? authToken.slice(7) : authToken;
    } else if (authHeader && typeof authHeader === 'string') {
      token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : authHeader;
    }

    if (!token) {
      return next(new Error('Authentication error: Missing token'));
    }

    const decodedUser = verifyAccessToken(token);
    (socket as CustomSocket).data = {
      ...socket.data,
      user: decodedUser
    };

    next();
  } catch (error) {
    return next(new Error('Authentication error: Invalid or expired token'));
  }
};

export const initWebSocketServer = async (
  httpServer: HttpServer,
  options: InitWebSocketOptions = {}
): Promise<Server> => {
  const corsOrigin = options.corsOrigin || process.env.CORS_ORIGIN || '*';
  
  const io = new Server(httpServer, {
    cors: {
      origin: corsOrigin,
      methods: ['GET', 'POST'],
      credentials: true
    },
    pingInterval: 25000,
    pingTimeout: 20000,
    transports: ['websocket', 'polling']
  });

  // Redis Adapter Setup
  const redisUrl = options.redisUrl || process.env.REDIS_URL || 'redis://localhost:6379';
  const isTest = process.env.NODE_ENV === 'test' || options.skipRedisInTest;

  if (!isTest) {
    try {
      const pubClient = new Redis(redisUrl, { maxRetriesPerRequest: null, lazyConnect: true });
      const subClient = pubClient.duplicate();

      await Promise.all([pubClient.connect(), subClient.connect()]);
      io.adapter(createAdapter(pubClient, subClient));
      pubClientInstance = pubClient;
      subClientInstance = subClient;
      log.info('🧠 Socket.IO Redis adapter connected successfully');
    } catch (err) {
      log.warn('⚠️ Socket.IO Redis adapter failed to connect, falling back to in-memory adapter', { error: err });
    }
  }

  // Setup Namespaces with JWT Authentication & Handshake Validation
  const namespaces = [NAMESPACES.ALERTS, NAMESPACES.SCORES, NAMESPACES.TRANSACTIONS];

  // Also attach auth to default namespace
  io.use(socketAuthMiddleware);

  namespaces.forEach(ns => {
    const namespace = io.of(ns);

    namespace.use(socketAuthMiddleware);

    namespace.on('connection', (socket: Socket) => {
      const customSocket = socket as CustomSocket;
      const user = customSocket.data.user;
      
      log.info(`WebSocket client connected to namespace ${ns}`, { socketId: socket.id, userId: user?.id });

      // Automatically join room for user-specific broadcasts
      if (user?.id) {
        socket.join(`user:${user.id}`);
      }
      if (user?.role) {
        socket.join(`role:${user.role}`);
      }

      // Application heartbeat / ping-pong resilience handler
      socket.on('ping', () => {
        socket.emit('pong', { timestamp: Date.now() });
      });

      // Handle explicit room join requests
      socket.on('subscribe', (room: string) => {
        if (typeof room === 'string' && room.trim()) {
          socket.join(room);
          socket.emit('subscribed', { room });
        }
      });

      socket.on('unsubscribe', (room: string) => {
        if (typeof room === 'string' && room.trim()) {
          socket.leave(room);
          socket.emit('unsubscribed', { room });
        }
      });

      socket.on('disconnect', (reason) => {
        log.info(`WebSocket client disconnected from ${ns}`, { socketId: socket.id, reason });
      });
    });
  });

  ioInstance = io;
  return io;
};

export const getIO = (): Server => {
  if (!ioInstance) {
    throw new Error('WebSocket server has not been initialized. Call initWebSocketServer first.');
  }
  return ioInstance;
};

export const closeWebSocketServer = async (): Promise<void> => {
  if (ioInstance) {
    await new Promise<void>((resolve) => {
      ioInstance!.close(() => {
        resolve();
      });
    });
    ioInstance = null;
  }

  if (pubClientInstance) {
    await pubClientInstance.quit().catch(() => {});
    pubClientInstance = null;
  }
  if (subClientInstance) {
    await subClientInstance.quit().catch(() => {});
    subClientInstance = null;
  }
};
