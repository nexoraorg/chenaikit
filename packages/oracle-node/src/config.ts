/**
 * Configuration loader for Oracle Node runtime.
 */

export interface OracleNodeConfig {
  /** RPC endpoint for Soroban/Stellar network */
  rpcUrl: string;
  /** Network passphrase */
  networkPassphrase: string;
  /** Deployed Oracle Network contract address */
  contractId: string;
  /** Node public key / address */
  nodeAddress: string;
  /** Node private signing key / secret */
  nodeSecretKey: string;
  /** Backend API URL for pulling off-chain feed data */
  backendUrl: string;
  /** Polling interval in milliseconds */
  pollIntervalMs: number;
  /** HTTP server listening port for /health and /metrics */
  port: number;
  /** HTTP server listening host */
  host: string;
  /** Maximum retry count for data submissions */
  maxRetries: number;
  /** Base backoff delay for submission retries in ms */
  initialBackoffMs: number;
  /** Maximum backoff delay for submission retries in ms */
  maxBackoffMs: number;
  /** Structured log level */
  logLevel: "debug" | "info" | "warn" | "error";
}

/**
 * Loads and validates configuration from environment variables with defaults.
 */
export function loadConfig(env: Record<string, string | undefined> = process.env): OracleNodeConfig {
  const rpcUrl = env.SOROBAN_RPC_URL ?? "https://soroban-testnet.stellar.org";
  const networkPassphrase = env.STELLAR_NETWORK_PASSPHRASE ?? "Test SDF Network ; September 2015";
  const contractId = env.ORACLE_CONTRACT_ID ?? "CCORACLE_NETWORK_CONTRACT_DEFAULT";
  const nodeAddress = env.ORACLE_NODE_ADDRESS ?? "GBORACLE_NODE_TEST_PUBLIC_KEY";
  const nodeSecretKey = env.ORACLE_NODE_SECRET_KEY ?? "SBORACLE_NODE_TEST_SECRET_KEY";
  const backendUrl = env.BACKEND_API_URL ?? "http://localhost:3000";

  const pollIntervalMs = parseInt(env.POLL_INTERVAL_MS ?? "15000", 10);
  const port = parseInt(env.PORT ?? "8080", 10);
  const host = env.HOST ?? "0.0.0.0";
  const maxRetries = parseInt(env.MAX_RETRIES ?? "3", 10);
  const initialBackoffMs = parseInt(env.INITIAL_BACKOFF_MS ?? "500", 10);
  const maxBackoffMs = parseInt(env.MAX_BACKOFF_MS ?? "5000", 10);
  const rawLogLevel = (env.LOG_LEVEL ?? "info").toLowerCase();
  const logLevel = rawLogLevel === "debug" || rawLogLevel === "warn" || rawLogLevel === "error"
    ? rawLogLevel
    : "info";

  return {
    rpcUrl,
    networkPassphrase,
    contractId,
    nodeAddress,
    nodeSecretKey,
    backendUrl,
    pollIntervalMs: Number.isNaN(pollIntervalMs) ? 15000 : Math.max(1000, pollIntervalMs),
    port: Number.isNaN(port) ? 8080 : port,
    host,
    maxRetries: Number.isNaN(maxRetries) ? 3 : Math.max(1, maxRetries),
    initialBackoffMs: Number.isNaN(initialBackoffMs) ? 500 : initialBackoffMs,
    maxBackoffMs: Number.isNaN(maxBackoffMs) ? 5000 : maxBackoffMs,
    logLevel,
  };
}
