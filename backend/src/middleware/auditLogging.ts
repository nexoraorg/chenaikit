import { Request, Response, NextFunction } from "express";
import {
  auditLogService,
  CreateAuditLogInput,
} from "../services/auditLogService";
import { UserPayload } from "../types/auth";

/**
 * Audit logging middleware
 * Automatically logs all HTTP requests to the audit log table
 * Called after response completes
 */
export const auditLoggingMiddleware = (
  req: Request,
  res: Response,
  next: NextFunction,
): void => {
  // Store start time
  const startTime = Date.now();

  // Capture original send method
  const originalSend = res.send.bind(res);

  // Override send to log after response
  res.send = function (data: any): Response {
    res.send = originalSend;

    // Calculate duration
    const duration = Date.now() - startTime;

    // Extract user context
    const user = (req as any).user as UserPayload | undefined;
    const userId = user?.id?.toString();

    // Get IP address (handle proxy scenarios)
    const ipAddress =
      (req.headers["x-forwarded-for"] as string)?.split(",")[0].trim() ||
      req.socket?.remoteAddress ||
      req.ip ||
      "";

    // Get user agent
    const userAgent = req.headers["user-agent"] || "";

    // Extract request body (skip passwords and sensitive data)
    const requestData = req.method !== "GET" ? req.body : undefined;

    // Parse response data if JSON
    let responseData: any;
    try {
      responseData = typeof data === "string" ? JSON.parse(data) : data;
    } catch {
      responseData = { raw: data };
    }

    // Extract error message if status is error
    let errorMessage: string | undefined;
    if (res.statusCode >= 400) {
      errorMessage =
        responseData?.error?.message ||
        responseData?.message ||
        `HTTP ${res.statusCode}`;
    }

    // Determine action based on method and endpoint
    const action = mapEndpointToAction(req.method, req.path);

    // Extract resource from path (heuristic)
    const resource = extractResourceFromPath(req.path);

    // Create audit log entry
    const auditInput: CreateAuditLogInput = {
      userId,
      action,
      resource,
      method: req.method,
      endpoint: req.path,
      statusCode: res.statusCode,
      ipAddress,
      userAgent,
      requestData,
      responseData,
      errorMessage,
      duration,
      metadata: {
        query: req.query,
        params: req.params,
      },
    };

    // Log asynchronously (fire-and-forget)
    auditLogService.createAuditLog(auditInput).catch((err) => {
      console.error("Audit log failed:", err);
    });

    return originalSend(data);
  };

  next();
};

/**
 * Map HTTP method + path to a human-readable action
 */
function mapEndpointToAction(method: string, path: string): string {
  // Auth endpoints
  if (path.includes("/auth/login")) return "LOGIN";
  if (path.includes("/auth/register")) return "REGISTER";
  if (path.includes("/auth/logout")) return "LOGOUT";
  if (path.includes("/auth/refresh")) return "TOKEN_REFRESH";
  if (path.includes("/auth/mfa")) return "MFA_UPDATE";

  // User management
  if (path.includes("/users") && method === "GET") return "USER_READ";
  if (path.includes("/users") && method === "POST") return "USER_CREATE";
  if (path.includes("/users") && method === "PUT") return "USER_UPDATE";
  if (path.includes("/users") && method === "DELETE") return "USER_DELETE";

  // Profile
  if (path.includes("/profile") && method === "GET") return "PROFILE_READ";
  if (path.includes("/profile") && method === "PUT") return "PROFILE_UPDATE";

  // Settings
  if (path.includes("/settings") && method === "GET") return "SETTINGS_READ";
  if (path.includes("/settings") && method === "PUT") return "SETTINGS_UPDATE";

  // API keys
  if (path.includes("/api-keys") && method === "POST") return "APIKEY_CREATE";
  if (path.includes("/api-keys") && method === "DELETE") return "APIKEY_DELETE";

  // Reports/data export
  if (path.includes("/export") || path.includes("/report"))
    return "DATA_EXPORT";

  // Generic fallback
  const verb =
    method === "GET"
      ? "READ"
      : method === "POST"
        ? "CREATE"
        : method === "PUT"
          ? "UPDATE"
          : "DELETE";
  return `${verb}`;
}

/**
 * Extract resource type from API path
 */
function extractResourceFromPath(path: string): string | undefined {
  // Remove version prefix
  const cleanPath = path.replace(/^\/api\/v\d+/, "");

  // Get first segment
  const segments = cleanPath.split("/").filter(Boolean);
  if (segments.length === 0) return undefined;

  const resource = segments[0];

  // Map to common resource types
  const resourceMap: Record<string, string> = {
    users: "user",
    auth: "auth",
    profile: "profile",
    settings: "settings",
    dashboard: "dashboard",
    analytics: "analytics",
    transactions: "transaction",
    reports: "report",
    export: "export",
    "api-keys": "api_key",
  };

  return resourceMap[resource] || resource;
}
