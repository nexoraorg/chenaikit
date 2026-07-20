import http from 'http';
import express from 'express';
import { io as ClientIO, Socket as ClientSocket } from 'socket.io-client';
import { initWebSocketServer, closeWebSocketServer, NAMESPACES } from '../websocket';
import { websocketService } from '../services/websocketService';
import { generateAccessToken } from '../utils/jwt';

describe('WebSocket Server & JWT Authentication', () => {
  let httpServer: http.Server;
  let serverPort: number;
  let validToken: string;

  beforeAll((done) => {
    const app = express();
    httpServer = http.createServer(app);
    
    validToken = generateAccessToken({
      id: 'test-user-123',
      email: 'test@example.com',
      role: 'admin'
    });

    initWebSocketServer(httpServer, { skipRedisInTest: true }).then(() => {
      httpServer.listen(0, () => {
        const address = httpServer.address();
        if (address && typeof address !== 'string') {
          serverPort = address.port;
        }
        done();
      });
    });
  });

  afterAll(async () => {
    await closeWebSocketServer();
    await new Promise<void>((resolve) => httpServer.close(() => resolve()));
  });

  test('should reject connection without authentication token', (done) => {
    const clientSocket = ClientIO(`http://localhost:${serverPort}${NAMESPACES.ALERTS}`, {
      transports: ['websocket'],
      autoConnect: true
    });

    clientSocket.on('connect_error', (err) => {
      expect(err.message).toContain('Authentication error');
      clientSocket.close();
      done();
    });
  });

  test('should reject connection with invalid token', (done) => {
    const clientSocket = ClientIO(`http://localhost:${serverPort}${NAMESPACES.SCORES}`, {
      auth: { token: 'invalid.jwt.token' },
      transports: ['websocket'],
      autoConnect: true
    });

    clientSocket.on('connect_error', (err) => {
      expect(err.message).toContain('Authentication error');
      clientSocket.close();
      done();
    });
  });

  test('should connect successfully with valid JWT token to /alerts', (done) => {
    const clientSocket = ClientIO(`http://localhost:${serverPort}${NAMESPACES.ALERTS}`, {
      auth: { token: validToken },
      transports: ['websocket']
    });

    clientSocket.on('connect', () => {
      expect(clientSocket.connected).toBe(true);
      clientSocket.close();
      done();
    });
  });

  test('should receive ping-pong heartbeat response', (done) => {
    const clientSocket = ClientIO(`http://localhost:${serverPort}${NAMESPACES.SCORES}`, {
      auth: { token: validToken },
      transports: ['websocket']
    });

    clientSocket.on('connect', () => {
      clientSocket.emit('ping');
    });

    clientSocket.on('pong', (data) => {
      expect(data).toHaveProperty('timestamp');
      clientSocket.close();
      done();
    });
  });

  test('should receive broadcasted alerts via WebSocketService', (done) => {
    const clientSocket = ClientIO(`http://localhost:${serverPort}${NAMESPACES.ALERTS}`, {
      auth: { token: validToken },
      transports: ['websocket']
    });

    const testAlert = {
      id: 'alert-1',
      type: 'fraud',
      severity: 'high' as const,
      title: 'Suspicious activity detected',
      message: 'Multiple high value transactions',
      timestamp: Date.now()
    };

    clientSocket.on('connect', () => {
      websocketService.broadcastAlert(testAlert);
    });

    clientSocket.on('alert:new', (data) => {
      expect(data.id).toBe(testAlert.id);
      expect(data.title).toBe(testAlert.title);
      clientSocket.close();
      done();
    });
  });

  test('should receive user-specific credit score update', (done) => {
    const clientSocket = ClientIO(`http://localhost:${serverPort}${NAMESPACES.SCORES}`, {
      auth: { token: validToken },
      transports: ['websocket']
    });

    const scoreData = {
      userId: 'test-user-123',
      score: 750,
      change: 15,
      tier: 'excellent',
      timestamp: Date.now()
    };

    clientSocket.on('connect', () => {
      websocketService.broadcastCreditScoreUpdate(scoreData);
    });

    clientSocket.on('score:updated', (data) => {
      expect(data.userId).toBe('test-user-123');
      expect(data.score).toBe(750);
      clientSocket.close();
      done();
    });
  });
});
