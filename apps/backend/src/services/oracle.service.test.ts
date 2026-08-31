import { describe, expect, it } from "vitest";
import { BackendOracleService } from "./oracle.service.js";

describe("BackendOracleService", () => {
  it("initializes OracleNodeClient with configured resilient parameters", () => {
    const service = new BackendOracleService({
      oracleUrl: "http://oracle-test.local:8545",
      timeoutMs: 2500,
      maxRetries: 2,
    });

    const client = service.getClient();
    expect(client.baseUrl).toBe("http://oracle-test.local:8545");
    expect(client.timeoutPolicy.attemptTimeoutMs).toBe(2500);
    expect(client.retryPolicy.maxRetries).toBe(2);
    expect(client.circuitBreaker.enabled).toBe(true);
  });
});
