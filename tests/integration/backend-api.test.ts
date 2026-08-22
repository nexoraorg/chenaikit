import { describe, it, expect, beforeAll, afterAll } from "vitest";
import request from "supertest";
import { setupTestEnvironment, cleanupTestDatabase } from "./harness.js";

let app: any;
let prisma: any;
let testDbPath: string;

describe("Backend API Integration Test Suite", () => {
  beforeAll(async () => {
    // Setup isolated test database before loading backend modules
    const envInfo = setupTestEnvironment();
    testDbPath = envInfo.dbPath;

    // Dynamically import backend app & db after DATABASE_URL is set
    const backendAppModule = await import("../../apps/backend/src/app.js");
    const backendDbModule = await import("../../apps/backend/src/db.js");

    app = backendAppModule.app;
    prisma = backendDbModule.prisma;
  });

  afterAll(async () => {
    if (prisma) {
      await prisma.$disconnect();
    }
    cleanupTestDatabase(testDbPath);
  });

  describe("GET /health", () => {
    it("should return 200 OK with service status", async () => {
      const response = await request(app).get("/health");

      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        status: "ok",
        service: "chenaikit-backend",
      });
    });
  });

  describe("API Persistence & Validation Flows (/api/records)", () => {
    it("should start with an empty list of records", async () => {
      const response = await request(app).get("/api/records");

      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        success: true,
        data: [],
      });
    });

    it("should create a record on valid POST request (201 Created)", async () => {
      const payload = { name: "Test Record 1", value: 42.5 };
      const response = await request(app).post("/api/records").send(payload);

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toMatchObject({
        name: "Test Record 1",
        value: 42.5,
        status: "active",
      });
      expect(response.body.data.id).toBeDefined();

      // Verify persistence by querying DB via GET
      const listResponse = await request(app).get("/api/records");
      expect(listResponse.status).toBe(200);
      expect(listResponse.body.data).toHaveLength(1);
      expect(listResponse.body.data[0].id).toBe(response.body.data.id);
    });

    it("should return 400 Bad Request on missing name (4xx path)", async () => {
      const payload = { value: 100 };
      const response = await request(app).post("/api/records").send(payload);

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty("error", "Validation Error");
      expect(response.body.message).toContain("Field 'name' is required");
    });

    it("should return 400 Bad Request on invalid value type (4xx path)", async () => {
      const payload = { name: "Invalid Record", value: "not-a-number" };
      const response = await request(app).post("/api/records").send(payload);

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty("error", "Validation Error");
      expect(response.body.message).toContain("Field 'value' is required and must be a number");
    });
  });

  describe("Error Diagnostic Flow (/api/trigger-error)", () => {
    it("should return 500 Internal Server Error with request/response diagnostic context (5xx path)", async () => {
      const response = await request(app).get("/api/trigger-error");

      expect(response.status).toBe(500);
      expect(response.body).toHaveProperty("error", "Internal Server Error");
      expect(response.body).toHaveProperty("message", "Database persistence error simulated");
      expect(response.body).toHaveProperty("context");
      expect(response.body.context).toMatchObject({
        path: "/api/trigger-error",
        method: "GET",
      });
    });
  });
});
