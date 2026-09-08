import { describe, expect, it } from "vitest";
import {
  BackendCreditScoreAdapter,
  BackendFraudAlertAdapter,
  StaticFeedAdapter,
} from "../src/adapters/index.js";

describe("DataSourceAdapters", () => {
  describe("BackendCreditScoreAdapter", () => {
    it("parses valid upstream response into FeedDataPoint", async () => {
      const mockFetch: typeof fetch = async () => {
        return new Response(JSON.stringify({ score: 810, timestamp: 1700000000000 }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      };

      const adapter = new BackendCreditScoreAdapter({
        backendUrl: "http://test-backend",
        fetchFn: mockFetch,
      });

      const point = await adapter.fetchData();
      expect(point.feedId).toBe("credit_sc");
      expect(point.value).toBe(810n);
      expect(point.timestamp).toBe(1700000000);
      expect(point.source).toBe("backend-credit-score");
    });

    it("falls back gracefully when upstream is offline", async () => {
      const failingFetch: typeof fetch = async () => {
        throw new Error("Connection refused");
      };

      const adapter = new BackendCreditScoreAdapter({
        backendUrl: "http://offline-backend",
        fetchFn: failingFetch,
      });

      const point = await adapter.fetchData();
      expect(point.feedId).toBe("credit_sc");
      expect(point.value).toBe(750n);
      expect(point.source).toBe("backend-credit-score:fallback");
    });
  });

  describe("BackendFraudAlertAdapter", () => {
    it("parses valid upstream fraud response", async () => {
      const mockFetch: typeof fetch = async () => {
        return new Response(JSON.stringify({ flagLevel: 2 }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      };

      const adapter = new BackendFraudAlertAdapter({
        backendUrl: "http://test-backend",
        fetchFn: mockFetch,
      });

      const point = await adapter.fetchData();
      expect(point.feedId).toBe("fraud_flg");
      expect(point.value).toBe(2n);
      expect(point.source).toBe("backend-fraud-alert");
    });

    it("falls back gracefully when upstream errors", async () => {
      const failingFetch: typeof fetch = async () => {
        return new Response("Internal Server Error", { status: 500 });
      };

      const adapter = new BackendFraudAlertAdapter({
        backendUrl: "http://test-backend",
        fetchFn: failingFetch,
      });

      const point = await adapter.fetchData();
      expect(point.feedId).toBe("fraud_flg");
      expect(point.value).toBe(0n);
      expect(point.source).toBe("backend-fraud-alert:fallback");
    });
  });

  describe("StaticFeedAdapter", () => {
    it("returns expected constant data point", async () => {
      const adapter = new StaticFeedAdapter({
        feedId: "test_feed",
        initialValue: 12345n,
      });

      const point = await adapter.fetchData();
      expect(point.feedId).toBe("test_feed");
      expect(point.value).toBe(12345n);
    });

    it("allows dynamic mutation and drift", async () => {
      const adapter = new StaticFeedAdapter({
        feedId: "drift_feed",
        initialValue: 1000n,
        driftBps: 100,
      });

      const point1 = await adapter.fetchData();
      expect(point1.value).toBe(1010n);

      adapter.setValue(2000n);
      const point2 = await adapter.fetchData();
      expect(point2.value).toBe(2020n);
    });
  });
});
