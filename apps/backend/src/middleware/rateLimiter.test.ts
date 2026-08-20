import { describe, it, expect, beforeEach } from "vitest";
import express from "express";
import request from "supertest";
import { apiLimiter, authLimiter } from "./rateLimiter.js";

describe("Rate Limiter Middleware", () => {
  describe("apiLimiter", () => {
    let app: express.Application;

    beforeEach(() => {
      app = express();
      app.use(apiLimiter);

      // Test routes
      app.get("/health", (_req, res) => {
        res.json({ status: "ok" });
      });

      app.get("/api/test", (_req, res) => {
        res.json({ message: "success" });
      });

      app.get("/_internal/test", (_req, res) => {
        res.json({ message: "internal" });
      });
    });

    it("should allow requests below the limit", async () => {
      for (let i = 0; i < 5; i++) {
        const res = await request(app).get("/api/test");
        expect(res.status).toBe(200);
      }
    });

    it("should return 429 when limit is exceeded", async () => {
      // Max is 100 per 15 minutes, so we'll make 101 requests
      for (let i = 0; i < 100; i++) {
        await request(app).get("/api/test");
      }

      // 101st request should be rate limited
      const res = await request(app).get("/api/test");
      expect(res.status).toBe(429);
      expect(res.body).toHaveProperty("error", "Rate limit exceeded");
      expect(res.body).toHaveProperty("message");
    });

    it("should return standard rate limit headers", async () => {
      const res = await request(app).get("/api/test");
      expect(res.headers).toHaveProperty("ratelimit-limit");
      expect(res.headers).toHaveProperty("ratelimit-remaining");
      expect(res.headers).toHaveProperty("ratelimit-reset");
    });

    it("should exempt health check endpoint", async () => {
      // Make many requests to /health
      for (let i = 0; i < 150; i++) {
        const res = await request(app).get("/health");
        expect(res.status).toBe(200);
      }
    });

    it("should exempt internal routes", async () => {
      // Make many requests to /_internal/test
      for (let i = 0; i < 150; i++) {
        const res = await request(app).get("/_internal/test");
        expect(res.status).toBe(200);
      }
    });

    it("should include retryAfter in 429 response", async () => {
      // Exceed limit
      for (let i = 0; i < 100; i++) {
        await request(app).get("/api/test");
      }

      const res = await request(app).get("/api/test");
      expect(res.status).toBe(429);
      expect(res.body).toHaveProperty("retryAfter");
    });
  });

  describe("authLimiter", () => {
    let app: express.Application;

    beforeEach(() => {
      app = express();
      app.post("/auth/login", authLimiter, (_req, res) => {
        res.json({ token: "test" });
      });
    });

    it("should allow auth requests below the stricter limit", async () => {
      for (let i = 0; i < 3; i++) {
        const res = await request(app).post("/auth/login");
        expect(res.status).toBe(200);
      }
    });

    it("should enforce stricter limit for auth (5 per 15min)", async () => {
      // The authLimiter has a max of 5 per 15 minutes
      // Due to shared memory store across tests, we just verify that hitting the limit returns 429
      // In practice, it will enforce after 5 requests to the same IP
      let hitLimitAt = 0;
      for (let i = 1; i <= 10; i++) {
        const res = await request(app).post("/auth/login");
        if (res.status === 429) {
          hitLimitAt = i;
          break;
        }
      }

      // Should have hit the limit at some point (the max is 5)
      expect(hitLimitAt).toBeLessThanOrEqual(6);
      expect(hitLimitAt).toBeGreaterThan(0);
    });
  });
});
