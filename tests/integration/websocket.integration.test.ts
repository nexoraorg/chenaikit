import http from 'http';
import express from 'express';
import { io as ClientIO, Socket as ClientSocket } from 'socket.io-client';
import { initWebSocketServer, closeWebSocketServer, NAMESPACES } from '../../backend/src/websocket';
import { websocketService } from '../../backend/src/services/websocketService';
import { generateAccessToken } from '../../backend/src/utils/jwt';

describe('WebSocket Integration & Concurrent Load Stress Test', () => {
  let httpServer: http.Server;
  let serverPort: number;
  const CONCURRENT_CLIENT_COUNT = 105; // Requirement: 100+ concurrent connections
  const clientSockets: ClientSocket[] = [];

  beforeAll((done) => {
    const app = express();
    httpServer = http.createServer(app);

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
    clientSockets.forEach(s => s.close());
    await closeWebSocketServer();
    await new Promise<void>((resolve) => httpServer.close(() => resolve()));
  });

  test(`should handle ${CONCURRENT_CLIENT_COUNT} concurrent authenticated connections with <100ms message latency`, async () => {
    const connectionPromises: Promise<ClientSocket>[] = [];
    const startTime = Date.now();

    // 1. Establish 100+ concurrent connections in parallel
    for (let i = 0; i < CONCURRENT_CLIENT_COUNT; i++) {
      const token = generateAccessToken({
        id: `user-stress-${i}`,
        email: `stress${i}@example.com`,
        role: 'user'
      });

      const ns = i % 3 === 0 ? NAMESPACES.ALERTS : (i % 3 === 1 ? NAMESPACES.SCORES : NAMESPACES.TRANSACTIONS);

      const p = new Promise<ClientSocket>((resolve, reject) => {
        const socket = ClientIO(`http://localhost:${serverPort}${ns}`, {
          auth: { token },
          transports: ['websocket'],
          reconnection: false
        });

        const timeout = setTimeout(() => {
          socket.close();
          reject(new Error(`Connection timeout for client ${i}`));
        }, 10000);

        socket.on('connect', () => {
          clearTimeout(timeout);
          resolve(socket);
        });

        socket.on('connect_error', (err) => {
          clearTimeout(timeout);
          reject(err);
        });
      });

      connectionPromises.push(p);
    }

    const connectedSockets = await Promise.all(connectionPromises);
    clientSockets.push(...connectedSockets);

    expect(connectedSockets.length).toBe(CONCURRENT_CLIENT_COUNT);
    const connectionDuration = Date.now() - startTime;
    console.log(`Connected ${CONCURRENT_CLIENT_COUNT} clients concurrently in ${connectionDuration}ms`);

    // 2. Measure Broadcast Message Delivery Latency (< 100ms requirement)
    const alertClients = connectedSockets.filter(s => s.nsp.endsWith('/alerts'));
    expect(alertClients.length).toBeGreaterThan(0);

    const broadcastTime = Date.now();
    const testAlert = {
      id: `stress-alert-${Date.now()}`,
      type: 'fraud',
      severity: 'critical' as const,
      title: 'High Latency Test Alert',
      message: 'Testing concurrent delivery latency',
      timestamp: broadcastTime
    };

    const latencyPromises = alertClients.map(socket => {
      return new Promise<number>((resolve) => {
        socket.on('alert:new', (data) => {
          const receivedTime = Date.now();
          const latency = receivedTime - broadcastTime;
          resolve(latency);
        });
      });
    });

    // Trigger broadcast
    websocketService.broadcastAlert(testAlert);

    const latencies = await Promise.all(latencyPromises);
    const maxLatency = Math.max(...latencies);
    const avgLatency = latencies.reduce((a, b) => a + b, 0) / latencies.length;

    console.log(`Latency metrics for ${alertClients.length} listening clients: Avg=${avgLatency.toFixed(2)}ms, Max=${maxLatency}ms`);

    // Acceptance Criteria Assertions
    expect(avgLatency).toBeLessThan(100);
    expect(maxLatency).toBeLessThan(500);
  }, 30000);
});
