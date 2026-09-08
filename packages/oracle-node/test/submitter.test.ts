import { describe, expect, it } from "vitest";
import { FeedDataPoint } from "../src/adapters/types.js";
import { Logger } from "../src/logger.js";
import { OracleSubmitter, OracleTransactionPayload } from "../src/submitter.js";

describe("OracleSubmitter", () => {
  const silentLogger = new Logger({
    level: "error",
    sink: () => {},
  });

  it("submits data point and updates metrics on success", async () => {
    const executedPayloads: OracleTransactionPayload[] = [];
    const submitter = new OracleSubmitter({
      contractId: "C123",
      nodeAddress: "G123",
      nodeSecretKey: "S123",
      rpcUrl: "http://mock-rpc",
      logger: silentLogger,
      txExecutor: async (payload) => {
        executedPayloads.push(payload);
        return {
          status: "success",
          transactionHash: "tx_mock_hash",
          round: 42,
        };
      },
    });

    const point: FeedDataPoint = {
      feedId: "credit_sc",
      value: 780n,
      timestamp: 1700000000,
      source: "test",
    };

    const receipt = await submitter.submitDataPoint(point);
    expect(receipt.status).toBe("success");
    expect(receipt.transactionHash).toBe("tx_mock_hash");
    expect(executedPayloads.length).toBe(1);
    expect(executedPayloads[0].feedId).toBe("credit_sc");
    expect(executedPayloads[0].value).toBe("780");

    expect(submitter.metrics.submissionsSucceeded).toBe(1);
    expect(submitter.metrics.submissionsFailed).toBe(0);
    expect(submitter.metrics.lastSubmissionRound).toBe(42);
  });

  it("deduplicates identical submissions in-memory", async () => {
    let callCount = 0;
    const submitter = new OracleSubmitter({
      contractId: "C123",
      nodeAddress: "G123",
      nodeSecretKey: "S123",
      rpcUrl: "http://mock-rpc",
      logger: silentLogger,
      txExecutor: async () => {
        callCount++;
        return { status: "success", transactionHash: "hash-1" };
      },
    });

    const point: FeedDataPoint = {
      feedId: "fraud_flg",
      value: 1n,
      timestamp: 1700000500,
      source: "test",
    };

    const res1 = await submitter.submitDataPoint(point);
    const res2 = await submitter.submitDataPoint(point);

    expect(res1.status).toBe("success");
    expect(res2.status).toBe("success");
    expect(res2.transactionHash).toBe("deduplicated-local-cache");
    expect(callCount).toBe(1);
  });

  it("retries on transient failure and recovers", async () => {
    let attempts = 0;
    const submitter = new OracleSubmitter({
      contractId: "C123",
      nodeAddress: "G123",
      nodeSecretKey: "S123",
      rpcUrl: "http://mock-rpc",
      maxRetries: 2,
      initialBackoffMs: 10,
      maxBackoffMs: 50,
      logger: silentLogger,
      txExecutor: async () => {
        attempts++;
        if (attempts === 1) {
          throw new Error("HTTP 503 Service Unavailable");
        }
        return { status: "success", transactionHash: "recovered-tx" };
      },
    });

    const point: FeedDataPoint = {
      feedId: "retry_feed",
      value: 100n,
      timestamp: 1700000600,
      source: "test",
    };

    const receipt = await submitter.submitDataPoint(point);
    expect(receipt.status).toBe("success");
    expect(attempts).toBe(2);
    expect(submitter.metrics.submissionsSucceeded).toBe(1);
    expect(submitter.metrics.submissionsFailed).toBe(0);
  });

  it("records rejection when contract rejects business logic", async () => {
    const submitter = new OracleSubmitter({
      contractId: "C123",
      nodeAddress: "G123",
      nodeSecretKey: "S123",
      rpcUrl: "http://mock-rpc",
      logger: silentLogger,
      txExecutor: async () => {
        return {
          status: "rejected",
          errorMessage: "NodeInactive",
        };
      },
    });

    const point: FeedDataPoint = {
      feedId: "rejected_feed",
      value: 50n,
      timestamp: 1700000700,
      source: "test",
    };

    const receipt = await submitter.submitDataPoint(point);
    expect(receipt.status).toBe("rejected");
    expect(submitter.metrics.submissionsRejected).toBe(1);
    expect(submitter.metrics.submissionsSucceeded).toBe(0);
  });
});
