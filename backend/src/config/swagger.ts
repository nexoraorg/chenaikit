import swaggerJsdoc from "swagger-jsdoc";

const options: swaggerJsdoc.Options = {
  definition: {
    openapi: "3.0.0",
    info: {
      title: "ChenAIKit API",
      version: "1.0.0",
      description:
        "A TypeScript toolkit for building AI-powered blockchain applications on Stellar/Soroban. Provides credit scoring, fraud detection, and account management APIs.",
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
        url: "http://localhost:{port}",
        description: "Development server",
        variables: {
          port: {
            default: process.env.PORT || "3000",
            description: "Development server port",
          },
        },
      },
      {
        url: "https://api.chenaikit.io",
        description: "Production server",
      },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: "http",
          scheme: "bearer",
          bearerFormat: "JWT",
          description: "JWT token from /api/auth/login or /api/auth/register",
        },
        apiKey: {
          type: "apiKey",
          in: "header",
          name: "x-api-key",
          description: "API key for programmatic access",
        },
      },
      schemas: {
        // -- Error ----------------------------------------------
        Error: {
          type: "object",
          properties: {
            error: { type: "string", example: "Unauthorized" },
            message: { type: "string", example: "Invalid or expired token" },
            statusCode: { type: "integer", example: 401 },
          },
          required: ["error"],
        },
        ValidationError: {
          type: "object",
          properties: {
            error: { type: "string", example: "Validation failed" },
            details: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  field: { type: "string", example: "email" },
                  message: {
                    type: "string",
                    example: "Must be a valid email address",
                  },
                },
              },
            },
          },
        },

        // -- Auth -----------------------------------------------
        RegisterRequest: {
          type: "object",
          required: ["email", "password"],
          properties: {
            email: {
              type: "string",
              format: "email",
              example: "user@example.com",
            },
            password: {
              type: "string",
              minLength: 8,
              example: "SecurePass123!",
            },
            name: { type: "string", example: "Peacee Joseph" },
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
            password: { type: "string", example: "SecurePass123!" },
          },
        },
        AuthResponse: {
          type: "object",
          properties: {
            token: {
              type: "string",
              description: "JWT access token",
              example: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
            },
            refreshToken: {
              type: "string",
              description: "JWT refresh token",
              example: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
            },
            user: { $ref: "#/components/schemas/User" },
            expiresIn: { type: "integer", example: 3600 },
          },
        },

        // -- User -----------------------------------------------
        User: {
          type: "object",
          properties: {
            id: {
              type: "string",
              format: "uuid",
              example: "550e8400-e29b-41d4-a716-446655440000",
            },
            email: {
              type: "string",
              format: "email",
              example: "user@example.com",
            },
            name: { type: "string", example: "Peacee Joseph" },
            createdAt: {
              type: "string",
              format: "date-time",
              example: "2025-06-19T10:30:00Z",
            },
            updatedAt: {
              type: "string",
              format: "date-time",
              example: "2025-06-19T10:30:00Z",
            },
          },
        },

        // -- Account --------------------------------------------
        Account: {
          type: "object",
          properties: {
            id: { type: "string", format: "uuid" },
            userId: { type: "string", format: "uuid" },
            stellarPublicKey: {
              type: "string",
              example:
                "GAHJJJKMOKYE4RVPZEWZTKH5FVI4PA3VL7GK2LFNUBSGBV3TZKVMTHR",
            },
            balance: {
              type: "number",
              description: "Balance in XLM",
              example: 1000.5,
            },
            creditScore: { type: "integer", example: 720 },
            fraudRiskLevel: {
              type: "string",
              enum: ["low", "medium", "high"],
              example: "low",
            },
            createdAt: { type: "string", format: "date-time" },
          },
        },

        // -- Credit Score ---------------------------------------
        CreditScore: {
          type: "object",
          properties: {
            score: {
              type: "integer",
              minimum: 0,
              maximum: 850,
              example: 720,
            },
            rating: {
              type: "string",
              enum: ["poor", "fair", "good", "very_good", "exceptional"],
              example: "good",
            },
            factors: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  factor: { type: "string", example: "payment_history" },
                  impact: {
                    type: "string",
                    enum: ["positive", "negative", "neutral"],
                  },
                  weight: { type: "number", example: 0.35 },
                },
              },
            },
            calculatedAt: { type: "string", format: "date-time" },
          },
        },

        // -- Transaction ----------------------------------------
        Transaction: {
          type: "object",
          properties: {
            id: { type: "string", format: "uuid" },
            accountId: { type: "string", format: "uuid" },
            type: {
              type: "string",
              enum: ["payment", "swap", "liquidity", "stake"],
            },
            amount: { type: "number", example: 100.0 },
            asset: { type: "string", example: "XLM" },
            stellarHash: {
              type: "string",
              example: "abc123def456ghi789...",
            },
            status: {
              type: "string",
              enum: ["pending", "success", "failed"],
              example: "success",
            },
            createdAt: { type: "string", format: "date-time" },
          },
        },

        // -- Analytics ------------------------------------------
        AnalyticsSummary: {
          type: "object",
          properties: {
            totalTransactions: { type: "integer", example: 1250 },
            totalVolume: { type: "number", example: 500000.0 },
            averageCreditScore: { type: "number", example: 685 },
            fraudAlertsCount: { type: "integer", example: 12 },
            period: { type: "string", example: "2025-06" },
          },
        },

        // -- Feature Flag ---------------------------------------
        FeatureFlag: {
          type: "object",
          properties: {
            id: { type: "string", format: "uuid" },
            name: { type: "string", example: "enable_fraud_detection_v2" },
            enabled: { type: "boolean", example: true },
            description: {
              type: "string",
              example: "Enable improved fraud detection algorithm",
            },
            rolloutPercentage: {
              type: "integer",
              minimum: 0,
              maximum: 100,
              example: 50,
            },
          },
        },

        // -- Pagination -----------------------------------------
        PaginatedResponse: {
          type: "object",
          properties: {
            data: { type: "array", items: {} },
            total: { type: "integer", example: 100 },
            page: { type: "integer", example: 1 },
            limit: { type: "integer", example: 20 },
            totalPages: { type: "integer", example: 5 },
          },
        },
      },
    },
    security: [{ bearerAuth: [] }],
    tags: [
      { name: "Health", description: "API health and status checks" },
      { name: "Auth", description: "Authentication - register, login, refresh, logout" },
      { name: "Accounts", description: "Stellar account management and credit scoring" },
      { name: "Analytics", description: "Usage analytics and reporting" },
      { name: "Feature Flags", description: "Runtime feature flag management" },
    ],
  },
  apis: [
    "./src/routes/**/*.ts",
    "./src/swagger/**/*.ts",
  ],
};

export const swaggerSpec = swaggerJsdoc(options);
export default swaggerSpec;
