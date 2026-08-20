import { describe, it, expect, beforeEach } from "vitest";
import express from "express";
import request from "supertest";
import rateLimit from "express-rate-limit";

describe("Rate Limiter Middleware", () => {
  describe("apiLimiter", () => {
    let app: express.Application;

    beforeEach(() => {
      app = express();

      // Create fresh limiter for each test to isolate state
      const apiLimiter = rateLimit({
        windowMs: 15 * 60 * 1000,
        max: 100,
        standardHeaders: true,
        legacyHeaders: false,
        skip: (req) => {
          return req.path === "/health" || req.path.startsWith("/_internal/");
        },
        handler: (req, res) => {
          res.status(429).json({
            error: "Rate limit exceeded",
            message: "Too many requests. Please retry after some time.",
            retryAfter: req.rateLimit?.resetTime?.getTime(),
          });
        },
      });

      app.use(apiLimiter);

      app.get("/health", (_req, res) => {
        res.json({ status: "ok" });
      });

      app.get("/api/test", (_req, res) => {
        res.json({ message: "success" });
      });

      app.get("/_internal/test", (_req, res) => {
        res.json({ message: "internal" });
      });

      app.get("/_internal-status", (_req, res) => {
        res.json({ message: "should be rate limited" });
      });
    });

    it("should allow requests 1-100 and block request 101", async () => {
      // Make 100 successful requests
      for (let i = 1; i <= 100; i++) {
        const res = await request(app).get("/api/test");
        expect(res.status).toBe(200);
      }

      // 101st request should be rate limited
      const res = await request(app).get("/api/test");
      expect(res.status).toBe(429);
      expect(res.body).toHaveProperty("error", "Rate limit exceeded");
    });

    it("should return standard rate limit headers", async () => {
      const res = await request(app).get("/api/test");
      expect(res.headers).toHaveProperty("ratelimit-limit");
      expect(res.headers).toHaveProperty("ratelimit-remaining");
      expect(res.headers).toHaveProperty("ratelimit-reset");
    });

    it("should exempt health check endpoint", async () => {
      // Make 150 requests to /health
      for (let i = 0; i < 150; i++) {
        const res = await request(app).get("/health");
        expect(res.status).toBe(200);
      }
    });

    it("should exempt internal routes matching /_internal/ prefix", async () => {
      // Make 150 requests to /_internal/test
      for (let i = 0; i < 150; i++) {
        const res = await request(app).get("/_internal/test");
        expect(res.status).toBe(200);
      }
    });

    it("should NOT exempt paths with _internal prefix but not /_internal/", async () => {
      // /_internal-status should NOT be exempted, should be rate limited
      for (let i = 0; i < 100; i++) {
        const res = await request(app).get("/_internal-status");
        expect(res.status).toBe(200);
      }

      // 101st request should be rate limited
      const res = await request(app).get("/_internal-status");
      expect(res.status).toBe(429);
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

      // Create fresh limiter for each test to isolate state
      const authLimiter = rateLimit({
        windowMs: 15 * 60 * 1000,
        max: 5,
        standardHeaders: true,
        legacyHeaders: false,
        handler: (req, res) => {
          res.status(429).json({
            error: "Rate limit exceeded",
            message:
              "Too many authentication attempts. Please try again later.",
            retryAfter: req.rateLimit?.resetTime?.getTime(),
          });
        },
      });

      app.post("/auth/login", authLimiter, (_req, res) => {
        res.json({ token: "test" });
      });
    });

    it("should allow auth requests 1-5 and block request 6", async () => {
      // Make 5 successful requests
      for (let i = 1; i <= 5; i++) {
        const res = await request(app).post("/auth/login");
        expect(res.status).toBe(200);
      }

      // 6th request should be rate limited
      const res = await request(app).post("/auth/login");
      expect(res.status).toBe(429);
      expect(res.body).toHaveProperty("error", "Rate limit exceeded");
    });
  });
});
