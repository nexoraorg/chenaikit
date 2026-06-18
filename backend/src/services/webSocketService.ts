import { Server as SocketIOServer, Socket } from "socket.io";
import { Server as HttpServer } from "http";
import { log } from "../utils/logger";
import { TransactionMonitor } from "@chenaikit/core";
import { TransactionEvent, Alert, ConnectionStatus } from "@chenaikit/core";

export interface WebSocketUser {
  userId: string;
  socketId: string;
  connectedAt: Date;
  subscriptions: Set<string>;
}

export class WebSocketService {
  private io: SocketIOServer;
  private users: Map<string, WebSocketUser> = new Map();
  private monitor: TransactionMonitor | null = null;
  private healthCheckInterval: NodeJS.Timeout | null = null;

  constructor(httpServer: HttpServer) {
    this.io = new SocketIOServer(httpServer, {
      cors: {
        origin: process.env.FRONTEND_URL || "http://localhost:3000",
        methods: ["GET", "POST"],
      },
      transports: ["websocket", "polling"],
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      reconnectionAttempts: 99,
    });

    this.setupMiddleware();
    this.setupEventHandlers();
    this.startHealthCheck();
  }

  private setupMiddleware() {
    this.io.use((socket, next) => {
      // Add authentication middleware if needed
      const token = socket.handshake.auth.token;
      const userId = socket.handshake.auth.userId || socket.id;

      socket.data.userId = userId;
      socket.data.token = token;
      next();
    });
  }

  private setupEventHandlers() {
    this.io.on("connection", (socket: Socket) => {
      const userId = socket.data.userId as string;

      log(`WebSocket client connected: ${userId} (socket: ${socket.id})`);

      // Register user
      this.users.set(socket.id, {
        userId,
        socketId: socket.id,
        connectedAt: new Date(),
        subscriptions: new Set(),
      });

      // Send connection confirmation
      socket.emit("connected", {
        socketId: socket.id,
        connectedAt: new Date(),
        reconnectionDelay: 1000,
      });

      // Subscribe event
      socket.on("subscribe", (data: { channels: string[] }) => {
        const user = this.users.get(socket.id);
        if (user) {
          data.channels.forEach((channel) => {
            user.subscriptions.add(channel);
            socket.join(channel);
          });
          log(`User ${userId} subscribed to: ${data.channels.join(", ")}`);
        }
      });

      // Unsubscribe event
      socket.on("unsubscribe", (data: { channels: string[] }) => {
        const user = this.users.get(socket.id);
        if (user) {
          data.channels.forEach((channel) => {
            user.subscriptions.delete(channel);
            socket.leave(channel);
          });
        }
      });

      // Disconnect event
      socket.on("disconnect", () => {
        log(`WebSocket client disconnected: ${userId}`);
        this.users.delete(socket.id);
      });

      // Error handling
      socket.on("error", (error) => {
        log(`WebSocket error from ${userId}: ${error}`);
      });
    });
  }

  private startHealthCheck() {
    this.healthCheckInterval = setInterval(() => {
      this.io.emit("ping", { timestamp: Date.now() });
    }, 30000); // Every 30 seconds
  }

  /**
   * Broadcast transaction event to subscribed users
   */
  public broadcastTransaction(transaction: TransactionEvent, analysis: any) {
    this.io.to("transactions").emit("transaction:update", {
      transaction,
      analysis,
      timestamp: new Date(),
      type: "transaction_update",
    });
  }

  /**
   * Broadcast alert to subscribed users
   */
  public broadcastAlert(alert: Alert) {
    this.io.to("alerts").emit("alert:new", {
      alert,
      timestamp: new Date(),
      type: "alert_new",
    });
  }

  /**
   * Broadcast credit score update
   */
  public broadcastCreditScoreUpdate(
    userId: string,
    newScore: number,
    previousScore: number,
  ) {
    this.io.to(`credit-score:${userId}`).emit("credit-score:update", {
      userId,
      newScore,
      previousScore,
      change: newScore - previousScore,
      timestamp: new Date(),
      type: "credit_score_update",
    });
  }

  /**
   * Broadcast fraud detection event
   */
  public broadcastFraudDetection(fraudAlert: any) {
    this.io.to("fraud-alerts").emit("fraud:detected", {
      alert: fraudAlert,
      timestamp: new Date(),
      type: "fraud_detected",
    });
  }

  /**
   * Broadcast performance metrics update
   */
  public broadcastMetricsUpdate(metrics: any) {
    this.io.to("metrics").emit("metrics:update", {
      metrics,
      timestamp: new Date(),
      type: "metrics_update",
    });
  }

  /**
   * Broadcast connection status to a specific user
   */
  public broadcastConnectionStatus(socketId: string, status: ConnectionStatus) {
    this.io.to(socketId).emit("connection:status", {
      status,
      timestamp: new Date(),
      type: "connection_status",
    });
  }

  /**
   * Get connected users count
   */
  public getConnectedUsersCount(): number {
    return this.users.size;
  }

  /**
   * Get active subscriptions
   */
  public getActiveSubscriptions(): Record<string, number> {
    const subscriptions: Record<string, number> = {};

    this.users.forEach((user) => {
      user.subscriptions.forEach((channel) => {
        subscriptions[channel] = (subscriptions[channel] || 0) + 1;
      });
    });

    return subscriptions;
  }

  /**
   * Shutdown WebSocket service
   */
  public async shutdown(): Promise<void> {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
    }

    await this.io.close();
    log("WebSocket service shut down");
  }
}

// Singleton instance
let webSocketService: WebSocketService | null = null;

export function initializeWebSocket(httpServer: HttpServer): WebSocketService {
  if (!webSocketService) {
    webSocketService = new WebSocketService(httpServer);
  }
  return webSocketService;
}

export function getWebSocketService(): WebSocketService | null {
  return webSocketService;
}
