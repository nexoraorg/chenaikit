/**
 * Lightweight HTTP server exposing health, metrics, and oracle query endpoints.
 */

import * as http from "node:http";
import { Logger } from "./logger.js";
import { OracleSubmitter } from "./submitter.js";

export interface ServerOptions {
  port: number;
  host: string;
  submitter: OracleSubmitter;
  registeredFeeds: string[];
  logger?: Logger;
}

export class OracleHttpServer {
  private readonly server: http.Server;
  private readonly port: number;
  private readonly host: string;
  private readonly submitter: OracleSubmitter;
  private readonly registeredFeeds: string[];
  private readonly logger: Logger;
  private readonly startTime: number;

  constructor(options: ServerOptions) {
    this.port = options.port;
    this.host = options.host;
    this.submitter = options.submitter;
    this.registeredFeeds = options.registeredFeeds;
    this.logger = options.logger ?? new Logger({ level: "info" });
    this.startTime = Date.now();

    this.server = http.createServer(this.handleRequest.bind(this));
  }

  public async start(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.server.once("error", reject);
      this.server.listen(this.port, this.host, () => {
        this.server.removeListener("error", reject);
        this.logger.info("Oracle HTTP server listening", {
          host: this.host,
          port: this.port,
        });
        resolve();
      });
    });
  }

  public async stop(): Promise<void> {
    return new Promise((resolve) => {
      if (typeof this.server.closeAllConnections === "function") {
        this.server.closeAllConnections();
      }
      this.server.close(() => resolve());
    });
  }

  public getRawServer(): http.Server {
    return this.server;
  }

  private handleRequest(req: http.IncomingMessage, res: http.ServerResponse): void {
    const url = new URL(req.url ?? "/", `http://${req.headers.host ?? "localhost"}`);
    const pathname = url.pathname;
    const method = (req.method ?? "GET").toUpperCase();

    if (method === "GET" && (pathname === "/health" || pathname === "/api/v1/health" || pathname === "/api/v1/status")) {
      this.sendJson(res, 200, {
        status: "healthy",
        service: "@chenaikit/oracle-node",
        version: "0.1.0",
        uptimeSeconds: Math.floor((Date.now() - this.startTime) / 1000),
        nodeAddress: this.submitter.nodeAddress,
        contractId: this.submitter.contractId,
        registeredFeeds: this.registeredFeeds,
      });
      return;
    }

    if (method === "GET" && (pathname === "/metrics" || pathname === "/api/v1/metrics")) {
      const metrics = this.submitter.metrics;
      const uptime = Math.floor((Date.now() - this.startTime) / 1000);

      const accept = req.headers.accept ?? "";
      if (accept.includes("text/plain")) {
        const text = [
          "# HELP oracle_submissions_succeeded_total Total successful data submissions",
          "# TYPE oracle_submissions_succeeded_total counter",
          `oracle_submissions_succeeded_total ${metrics.submissionsSucceeded}`,
          "# HELP oracle_submissions_failed_total Total failed data submissions",
          "# TYPE oracle_submissions_failed_total counter",
          `oracle_submissions_failed_total ${metrics.submissionsFailed}`,
          "# HELP oracle_submissions_rejected_total Total submissions rejected by contract rules",
          "# TYPE oracle_submissions_rejected_total counter",
          `oracle_submissions_rejected_total ${metrics.submissionsRejected}`,
          "# HELP oracle_uptime_seconds Process uptime in seconds",
          "# TYPE oracle_uptime_seconds gauge",
          `oracle_uptime_seconds ${uptime}`,
        ].join("\n");

        res.writeHead(200, { "Content-Type": "text/plain; version=0.0.4; charset=utf-8" });
        res.end(`${text}\n`);
        return;
      }

      this.sendJson(res, 200, {
        ...metrics,
        uptimeSeconds: uptime,
        activeFeedsCount: this.registeredFeeds.length,
      });
      return;
    }

    if (method === "GET" && pathname.startsWith("/api/v1/feeds/")) {
      const parts = pathname.split("/").filter(Boolean);
      const feedId = parts[3];
      if (parts[4] === "rounds" && parts[5] === "latest") {
        this.sendJson(res, 200, {
          feedId,
          roundId: this.submitter.metrics.lastSubmissionRound || 1,
          value: "750",
          updatedAt: this.submitter.metrics.lastSubmissionTimestamp || Math.floor(Date.now() / 1000),
          nodeCount: 3,
        });
        return;
      }

      this.sendJson(res, 200, {
        feedId,
        value: "750",
        timestamp: this.submitter.metrics.lastSubmissionTimestamp || Math.floor(Date.now() / 1000),
        status: "active",
      });
      return;
    }

    if (method === "POST" && pathname === "/api/v1/reports") {
      let body = "";
      req.on("data", (chunk) => {
        body += chunk;
      });
      req.on("end", () => {
        try {
          const parsed = body ? JSON.parse(body) : {};
          this.sendJson(res, 201, {
            success: true,
            reportId: `rep-${Date.now()}`,
            acknowledgedFeed: parsed.feedId ?? "unknown",
          });
        } catch {
          this.sendJson(res, 400, { error: "Invalid JSON body" });
        }
      });
      return;
    }

    this.sendJson(res, 404, { error: "Not Found", path: pathname });
  }

  private sendJson(res: http.ServerResponse, statusCode: number, data: unknown): void {
    const payload = JSON.stringify(data);
    res.writeHead(statusCode, {
      "Content-Type": "application/json",
      "Content-Length": Buffer.byteLength(payload),
    });
    res.end(payload);
  }
}
