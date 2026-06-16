/**
 * @module config/swagger
 * @description OpenAPI 3.0.3 specification and Swagger UI configuration for the ChenAIKit backend.
 * Uses swagger-jsdoc to merge this base definition with @openapi JSDoc annotations in route files.
 */
import swaggerJsdoc from "swagger-jsdoc";
import { SwaggerUiOptions } from "swagger-ui-express";

const swaggerDefinition: swaggerJsdoc.OAS3Definition = {
  openapi: "3.0.3",
  info: {
    title: "ChenAIKit API",
    version: "0.1.0",
    description:
      "ChenAIKit Backend API — AI-powered financial toolkit providing credit scoring, fraud detection, account management, and analytics services.",
    contact: {
      name: "ChenAIKit Team",
      url: "https://github.com/nexoraorg/chenaikit",
    },
    license: {
      name: "MIT",
      url: "https://opensource.org/licenses/MIT",
    },
  },
  servers: [
    {
      url: `http://localhost:${process.env.PORT || 5000}`,
      description: "Local development server",
    },
    ...(process.env.API_BASE_URL
      ? [{ url: process.env.API_BASE_URL, description: "Production server" }]
      : []),
  ],
  tags: [
    { name: "Health", description: "Health check and readiness endpoints" },
    { name: "Auth", description: "Authentication and authorisation" },
    { name: "Accounts", description: "Account management and transactions" },
    { name: "Credit Scoring", description: "AI credit scoring services" },
    { name: "Fraud Detection", description: "AI fraud detection services" },
    { name: "Analytics", description: "Dashboard analytics and reporting" },
    { name: "Metrics", description: "Prometheus metrics" },
  ],
  components: {
    securitySchemes: {
      bearerAuth: {
        type: "http",
        scheme: "bearer",
        bearerFormat: "JWT",
        description: "JWT access token obtained from POST /api/auth/login",
      },
      apiKeyAuth: {
        type: "apiKey",
        in: "header",
        name: "X-API-Key",
        description: "API key for gateway-protected endpoints",
      },
    },
    schemas: {
      // ── Error schemas ──────────────────────────────────────────────
      ApiError: {
        type: "object",
        properties: {
          success: { type: "boolean", example: false },
          error: {
            type: "object",
            properties: {
              code: { type: "string", example: "INTERNAL_SERVER_ERROR" },
              message: {
                type: "string",
                example: "An unexpected error occurred",
              },
              details: {
                type: "array",
                items: { $ref: "#/components/schemas/ValidationError" },
              },
              timestamp: { type: "string", format: "date-time" },
            },
          },
        },
      },
      ValidationError: {
        type: "object",
        properties: {
          field: { type: "string", example: "email" },
          message: { type: "string", example: "Invalid email format" },
        },
      },

      // ── Auth schemas ───────────────────────────────────────────────
      RegisterRequest: {
        type: "object",
        required: ["email", "password"],
        properties: {
          email: {
            type: "string",
            format: "email",
            example: "user@example.com",
          },
          password: { type: "string", minLength: 8, example: "securePass123" },
          role: { type: "string", enum: ["user", "admin"], default: "user" },
        },
      },
      LoginRequest: {
        type: "object",
        required: ["email", "password"],
        properties: {
          email: {
            type: "string",
            format: "email",
            example: "user@example.com",
          },
          password: { type: "string", minLength: 8, example: "securePass123" },
        },
      },
      RefreshRequest: {
        type: "object",
        required: ["token"],
        properties: {
          token: { type: "string", example: "1.abc123refreshtoken..." },
        },
      },
      AuthTokenResponse: {
        type: "object",
        properties: {
          accessToken: { type: "string", example: "eyJhbGciOiJIUzI1NiIs..." },
          refreshToken: { type: "string", example: "a1b2c3d4e5f6..." },
        },
      },

      // ── Account schemas ────────────────────────────────────────────
      Account: {
        type: "object",
        properties: {
          id: {
            type: "string",
            example: "GCKFBEIYTKP6RJKJJGZ7LX3WZ7XMZS2NKTPGJ2DQVHZ4DFJ6WNRPJCPK",
          },
          name: { type: "string", example: "John Doe" },
          email: {
            type: "string",
            format: "email",
            example: "john.doe@example.com",
          },
          publicKey: {
            type: "string",
            example: "GCKFBEIYTKP6RJKJJGZ7LX3WZ7XMZS2NKTPGJ2DQVHZ4DFJ6WNRPJCPK",
          },
          balance: { type: "number", format: "double", example: 1000.5 },
          createdAt: { type: "string", format: "date-time" },
          updatedAt: { type: "string", format: "date-time" },
          isActive: { type: "boolean", example: true },
        },
      },
      AccountCreationRequest: {
        type: "object",
        required: ["name", "email", "publicKey"],
        properties: {
          name: { type: "string", example: "Jane Doe" },
          email: {
            type: "string",
            format: "email",
            example: "jane.doe@example.com",
          },
          publicKey: {
            type: "string",
            example: "GABCDEFGHIJKLMNOPQRSTUVWXYZ234567ABCDEFGHIJKLMNOPQRST",
          },
        },
      },
      Transaction: {
        type: "object",
        properties: {
          id: { type: "string", example: "tx_001" },
          accountId: { type: "string" },
          amount: { type: "number", format: "double", example: 500.0 },
          type: { type: "string", enum: ["credit", "debit"] },
          description: { type: "string", example: "Initial deposit" },
          timestamp: { type: "string", format: "date-time" },
          fromAccount: { type: "string", nullable: true },
          toAccount: { type: "string", nullable: true },
          status: { type: "string", enum: ["pending", "completed", "failed"] },
        },
      },
      PaginatedTransactions: {
        type: "object",
        properties: {
          success: { type: "boolean", example: true },
          data: {
            type: "object",
            properties: {
              data: {
                type: "array",
                items: { $ref: "#/components/schemas/Transaction" },
              },
              pagination: {
                type: "object",
                properties: {
                  page: { type: "integer", example: 1 },
                  limit: { type: "integer", example: 10 },
                  total: { type: "integer", example: 3 },
                  pages: { type: "integer", example: 1 },
                  hasNext: { type: "boolean", example: false },
                  hasPrev: { type: "boolean", example: false },
                },
              },
            },
          },
          timestamp: { type: "string", format: "date-time" },
        },
      },

      // ── AI / Gateway schemas ───────────────────────────────────────
      CreditScoreResponse: {
        type: "object",
        properties: {
          success: { type: "boolean", example: true },
          data: {
            type: "object",
            properties: {
              score: {
                type: "integer",
                example: 750,
                minimum: 150,
                maximum: 850,
              },
              factors: {
                type: "array",
                items: { type: "string" },
                example: [
                  "payment_history",
                  "credit_utilization",
                  "account_age",
                ],
              },
              timestamp: { type: "string", format: "date-time" },
            },
          },
        },
      },
      FraudDetectionResponse: {
        type: "object",
        properties: {
          success: { type: "boolean", example: true },
          data: {
            type: "object",
            properties: {
              riskScore: {
                type: "integer",
                example: 15,
                minimum: 0,
                maximum: 100,
              },
              riskLevel: {
                type: "string",
                enum: ["low", "medium", "high"],
                example: "low",
              },
              factors: {
                type: "array",
                items: { type: "string" },
                example: ["transaction_amount", "location", "device"],
              },
              timestamp: { type: "string", format: "date-time" },
            },
          },
        },
      },

      // ── Health schemas ─────────────────────────────────────────────
      HealthCheckResult: {
        type: "object",
        properties: {
          status: {
            type: "string",
            enum: ["healthy", "degraded", "unhealthy"],
          },
          timestamp: { type: "string", format: "date-time" },
          uptime: { type: "number", description: "Server uptime in seconds" },
          checks: {
            type: "object",
            additionalProperties: {
              type: "object",
              properties: {
                status: { type: "string", enum: ["up", "down", "degraded"] },
                responseTime: { type: "number" },
                error: { type: "string" },
                details: { type: "object" },
              },
            },
          },
        },
      },
    },
  },
};

const options: swaggerJsdoc.OAS3Options = {
  definition: swaggerDefinition,
  // Scan route files and index.ts for @openapi annotations
  apis: ["./src/routes/*.ts", "./src/index.ts"],
};

/**
 * Resolved OpenAPI specification object.
 * Merges the base definition above with @openapi JSDoc annotations found in route files.
 * Consumed by swagger-ui-express to render the interactive API explorer.
 */
export const swaggerSpec = swaggerJsdoc(options);

/**
 * Swagger UI display options.
 * Customises the look-and-feel of the /api-docs page (hidden top bar, persistent auth, etc.).
 */
export const swaggerUiOptions: SwaggerUiOptions = {
  customSiteTitle: "ChenAIKit API Documentation",
  customCss: `
    .swagger-ui .topbar { display: none; }
    .swagger-ui .wrapper { padding-top: 0; }
    .swagger-ui .info .title { font-size: 2rem; }
  `,
  swaggerOptions: {
    persistAuthorization: true,
    docExpansion: "list",
    filter: true,
    tagsSorter: "alpha",
    operationsSorter: "method",
  },
};

/**
 * Converts a JSON object to a simplified YAML string representation.
 * Used to serve the OpenAPI spec at /api-docs.yaml without requiring a YAML library.
 *
 * @param obj - The JSON object to convert
 * @param indent - Current indentation level (used internally for recursion)
 * @returns A YAML-formatted string
 */
export function jsonToYaml(obj: unknown, indent: number = 0): string {
  const pad = "  ".repeat(indent);

  if (obj === null || obj === undefined) {
    return "null";
  }

  if (typeof obj === "string") {
    // Quote strings that contain special YAML characters
    if (
      /[:{}[\],&*?|>!%@`#'"\n]/.test(obj) ||
      obj === "" ||
      obj === "true" ||
      obj === "false" ||
      obj === "null" ||
      !isNaN(Number(obj))
    ) {
      return JSON.stringify(obj);
    }
    return obj;
  }

  if (typeof obj === "number" || typeof obj === "boolean") {
    return String(obj);
  }

  if (Array.isArray(obj)) {
    if (obj.length === 0) return "[]";
    return obj
      .map((item) => {
        const value = jsonToYaml(item, indent + 1);
        if (typeof item === "object" && item !== null) {
          return `${pad}- ${value.trimStart()}`;
        }
        return `${pad}- ${value}`;
      })
      .join("\n");
  }

  if (typeof obj === "object") {
    const entries = Object.entries(obj as Record<string, unknown>);
    if (entries.length === 0) return "{}";
    return entries
      .map(([key, value]) => {
        if (typeof value === "object" && value !== null) {
          const nested = jsonToYaml(value, indent + 1);
          return `${pad}${key}:\n${nested}`;
        }
        return `${pad}${key}: ${jsonToYaml(value, indent + 1)}`;
      })
      .join("\n");
  }

  return String(obj);
}
