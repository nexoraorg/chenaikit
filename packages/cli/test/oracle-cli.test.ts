import { describe, expect, it } from "vitest";
import { createOracleClient } from "../src/commands/oracle.js";

describe("Oracle CLI", () => {
  it("initializes client with CLI parameters", () => {
    const client = createOracleClient({
      baseUrl: "https://oracle.test:8545",
      timeoutMs: 4000,
      maxRetries: 2,
    });

    expect(client.baseUrl).toBe("https://oracle.test:8545");
    expect(client.timeoutPolicy.attemptTimeoutMs).toBe(4000);
    expect(client.retryPolicy.maxRetries).toBe(2);
  });
});
