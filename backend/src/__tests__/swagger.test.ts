/**
 * Unit tests for the Swagger / OpenAPI configuration.
 *
 * Validates that:
 * - The generated OpenAPI spec is well-formed
 * - All expected endpoints are documented
 * - Component schemas are defined
 * - Security schemes are configured
 * - Swagger UI options are set correctly
 */

import { swaggerSpec, swaggerUiOptions } from "../config/swagger";

describe("Swagger Configuration", () => {
  describe("swaggerSpec", () => {
    it("should produce a valid OpenAPI 3.x specification", () => {
      expect(swaggerSpec).toBeDefined();
      expect(swaggerSpec).toHaveProperty("openapi");
      expect((swaggerSpec as any).openapi).toMatch(/^3\.\d+\.\d+$/);
    });

    it("should include API info metadata", () => {
      const info = (swaggerSpec as any).info;
      expect(info).toBeDefined();
      expect(info.title).toBe("ChenAIKit API");
      expect(info.version).toBe("0.1.0");
      expect(info.description).toBeTruthy();
      expect(info.contact).toBeDefined();
      expect(info.license).toBeDefined();
    });

    it("should define at least one server", () => {
      const servers = (swaggerSpec as any).servers;
      expect(servers).toBeDefined();
      expect(Array.isArray(servers)).toBe(true);
      expect(servers.length).toBeGreaterThanOrEqual(1);
      expect(servers[0]).toHaveProperty("url");
      expect(servers[0]).toHaveProperty("description");
    });

    it("should define all expected tags", () => {
      const tags = (swaggerSpec as any).tags;
      expect(tags).toBeDefined();
      const tagNames = tags.map((t: any) => t.name);
      expect(tagNames).toContain("Health");
      expect(tagNames).toContain("Auth");
      expect(tagNames).toContain("Accounts");
      expect(tagNames).toContain("Credit Scoring");
      expect(tagNames).toContain("Fraud Detection");
      expect(tagNames).toContain("Metrics");
    });
  });

  describe("Security Schemes", () => {
    it("should define bearerAuth (JWT) security scheme", () => {
      const schemes = (swaggerSpec as any).components?.securitySchemes;
      expect(schemes).toBeDefined();
      expect(schemes.bearerAuth).toBeDefined();
      expect(schemes.bearerAuth.type).toBe("http");
      expect(schemes.bearerAuth.scheme).toBe("bearer");
      expect(schemes.bearerAuth.bearerFormat).toBe("JWT");
    });

    it("should define apiKeyAuth security scheme", () => {
      const schemes = (swaggerSpec as any).components?.securitySchemes;
      expect(schemes.apiKeyAuth).toBeDefined();
      expect(schemes.apiKeyAuth.type).toBe("apiKey");
      expect(schemes.apiKeyAuth.in).toBe("header");
      expect(schemes.apiKeyAuth.name).toBe("X-API-Key");
    });
  });

  describe("Component Schemas", () => {
    const expectedSchemas = [
      "ApiError",
      "ValidationError",
      "RegisterRequest",
      "LoginRequest",
      "RefreshRequest",
      "AuthTokenResponse",
      "Account",
      "AccountCreationRequest",
      "Transaction",
      "PaginatedTransactions",
      "CreditScoreResponse",
      "FraudDetectionResponse",
      "HealthCheckResult",
    ];

    it.each(expectedSchemas)("should define the %s schema", (schemaName) => {
      const schemas = (swaggerSpec as any).components?.schemas;
      expect(schemas).toBeDefined();
      expect(schemas[schemaName]).toBeDefined();
      expect(schemas[schemaName].type).toBe("object");
    });
  });

  describe("API Paths", () => {
    const expectedPaths = [
      "/api/health",
      "/api/health/liveness",
      "/api/health/readiness",
      "/api/auth/register",
      "/api/auth/login",
      "/api/auth/refresh",
      "/api/accounts/{id}",
      "/api/accounts/{id}/balance",
      "/api/accounts/{id}/transactions",
      "/api/accounts",
      "/api/v1/credit-score",
      "/api/v1/fraud/detect",
      "/metrics",
    ];

    it("should document all expected API endpoints", () => {
      const paths = (swaggerSpec as any).paths;
      expect(paths).toBeDefined();

      for (const path of expectedPaths) {
        expect(paths).toHaveProperty(path);
      }
    });

    it("should specify HTTP methods for each path", () => {
      const paths = (swaggerSpec as any).paths;

      // Health endpoints should be GET
      expect(paths["/api/health"]).toHaveProperty("get");
      expect(paths["/api/health/liveness"]).toHaveProperty("get");
      expect(paths["/api/health/readiness"]).toHaveProperty("get");

      // Auth endpoints should be POST
      expect(paths["/api/auth/register"]).toHaveProperty("post");
      expect(paths["/api/auth/login"]).toHaveProperty("post");
      expect(paths["/api/auth/refresh"]).toHaveProperty("post");

      // Account GET endpoints
      expect(paths["/api/accounts/{id}"]).toHaveProperty("get");
      expect(paths["/api/accounts/{id}/balance"]).toHaveProperty("get");
      expect(paths["/api/accounts/{id}/transactions"]).toHaveProperty("get");

      // Account create should be POST
      expect(paths["/api/accounts"]).toHaveProperty("post");

      // AI endpoints should be GET
      expect(paths["/api/v1/credit-score"]).toHaveProperty("get");
      expect(paths["/api/v1/fraud/detect"]).toHaveProperty("get");
    });

    it("should include summaries and tags for each endpoint", () => {
      const paths = (swaggerSpec as any).paths;

      for (const path of expectedPaths) {
        const methods = paths[path];
        for (const method of Object.keys(methods)) {
          const operation = methods[method];
          expect(operation.summary).toBeTruthy();
          expect(operation.tags).toBeDefined();
          expect(operation.tags.length).toBeGreaterThan(0);
        }
      }
    });

    it("should include response definitions for each endpoint", () => {
      const paths = (swaggerSpec as any).paths;

      for (const path of expectedPaths) {
        const methods = paths[path];
        for (const method of Object.keys(methods)) {
          const operation = methods[method];
          expect(operation.responses).toBeDefined();
          // Every endpoint should have at least a 200-level response
          const responseCodes = Object.keys(operation.responses);
          const hasSuccessResponse = responseCodes.some(
            (code) => parseInt(code) >= 200 && parseInt(code) < 300,
          );
          expect(hasSuccessResponse).toBe(true);
        }
      }
    });

    it("should include security definitions on protected endpoints", () => {
      const paths = (swaggerSpec as any).paths;
      const protectedPaths = ["/api/v1/credit-score", "/api/v1/fraud/detect"];

      for (const path of protectedPaths) {
        const operation = paths[path]?.get;
        expect(operation?.security).toBeDefined();
        expect(operation.security.length).toBeGreaterThan(0);
      }
    });

    it("should include request body schemas for POST endpoints", () => {
      const paths = (swaggerSpec as any).paths;
      const postPaths = [
        "/api/auth/register",
        "/api/auth/login",
        "/api/auth/refresh",
        "/api/accounts",
      ];

      for (const path of postPaths) {
        const operation = paths[path]?.post;
        expect(operation?.requestBody).toBeDefined();
        expect(operation.requestBody.required).toBe(true);
        expect(operation.requestBody.content).toHaveProperty(
          "application/json",
        );
      }
    });
  });

  describe("swaggerUiOptions", () => {
    it("should set a custom site title", () => {
      expect(swaggerUiOptions.customSiteTitle).toBe(
        "ChenAIKit API Documentation",
      );
    });

    it("should include custom CSS to hide the top bar", () => {
      expect(swaggerUiOptions.customCss).toContain(".swagger-ui .topbar");
      expect(swaggerUiOptions.customCss).toContain("display: none");
    });

    it("should enable persistent authorization", () => {
      expect(swaggerUiOptions.swaggerOptions?.persistAuthorization).toBe(true);
    });

    it("should configure documentation expansion as list", () => {
      expect(swaggerUiOptions.swaggerOptions?.docExpansion).toBe("list");
    });

    it("should enable endpoint filtering", () => {
      expect(swaggerUiOptions.swaggerOptions?.filter).toBe(true);
    });
  });
});
