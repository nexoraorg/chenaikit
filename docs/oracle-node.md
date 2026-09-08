# Oracle Node Operational Runbook

## Overview

The Chenaikit Oracle Node (`@chenaikit/oracle-node`) is a persistent daemon service that ingests verified off-chain signals (credit scores, fraud alerts, asset prices) and periodically submits signed observations to the on-chain Soroban `oracle-network` smart contract.

The on-chain contract enforces stake-backed node registration, median aggregation across active quorums within configured freshness windows, and governance-driven slashing with reputation tracking.

---

## Architecture

```
+--------------------------+          +---------------------------+
|      Data Sources        |          |    Oracle Node Runtime    |
|                          |          |                           |
| - Backend API (/scores)  |  Poll    | - Config Loader           |
| - Fraud Alerts Service   | -------> | - Data Source Adapters    |
| - External Price Feeds   |          | - Transaction Submitter   |
+--------------------------+          | - Health & Metrics Server |
                                      +-------------+-------------+
                                                    |
                                         Submit TX  | (Signed with Node Key)
                                                    v
                                      +-------------+-------------+
                                      |   Soroban Smart Contract  |
                                      |   (contracts/oracle-network)
                                      |                           |
                                      | - Staked Node Registry    |
                                      | - Feed Quorum Config      |
                                      | - Median Aggregation      |
                                      | - Slashing / Reputation   |
                                      +---------------------------+
```

---

## Configuration Reference

The oracle node runtime is configured via environment variables.

| Variable | Description | Default |
|---|---|---|
| `SOROBAN_RPC_URL` | Soroban RPC endpoint URL | `https://soroban-testnet.stellar.org` |
| `STELLAR_NETWORK_PASSPHRASE` | Stellar network passphrase | `Test SDF Network ; September 2015` |
| `ORACLE_CONTRACT_ID` | Address of deployed `oracle-network` contract | Required |
| `ORACLE_NODE_ADDRESS` | Public key (`G...`) of the registered oracle node | Required |
| `ORACLE_NODE_SECRET_KEY` | Secret seed (`S...`) used to sign transaction payloads | Required |
| `BACKEND_API_URL` | Base URL of upstream backend service | `http://localhost:3000` |
| `POLL_INTERVAL_MS` | Interval between data collection & submission passes | `15000` (15 seconds) |
| `PORT` | Listening port for HTTP health and metrics server | `8080` |
| `HOST` | Listening host interface | `0.0.0.0` |
| `MAX_RETRIES` | Max retries on transient RPC failures | `3` |
| `INITIAL_BACKOFF_MS` | Initial exponential backoff delay in ms | `500` |
| `MAX_BACKOFF_MS` | Max exponential backoff delay ceiling in ms | `5000` |
| `LOG_LEVEL` | Structured logging level (`debug`, `info`, `warn`, `error`) | `info` |

---

## Setup and Key Provisioning

### 1. Generate Stellar Keypair

Generate an Ed25519 keypair for the oracle node using the Stellar CLI:

```bash
stellar keys generate oracle-node-01 --network testnet
stellar keys address oracle-node-01
```

Fund the account with testnet lumens via Friendbot:

```bash
curl "https://friendbot.stellar.org?addr=$(stellar keys address oracle-node-01)"
```

### 2. Stake and Register On-Chain

Oracle nodes must deposit the minimum stake (default 10 XLM / `100_000_000` stroops) before submitting data.

Call `register_node` on the contract:

```bash
stellar contract invoke \
  --id <ORACLE_CONTRACT_ID> \
  --source-account oracle-node-01 \
  --network testnet \
  -- \
  register_node \
  --caller $(stellar keys address oracle-node-01) \
  --stake 100000000
```

Verify registration status:

```bash
stellar contract invoke \
  --id <ORACLE_CONTRACT_ID> \
  --source-account oracle-node-01 \
  --network testnet \
  -- \
  get_node \
  --node $(stellar keys address oracle-node-01)
```

---

## Starting the Node

### Build from Source

```bash
cd packages/oracle-node
pnpm build
```

### Run the Daemon

Using npm / pnpm scripts:

```bash
export ORACLE_CONTRACT_ID="CA..."
export ORACLE_NODE_ADDRESS="GB..."
export ORACLE_NODE_SECRET_KEY="SB..."
pnpm start
```

Or run via the CLI binary directly:

```bash
npx oracle-node
```

The daemon outputs structured JSON logs:

```json
{"timestamp":"2026-09-08T15:20:00.000Z","level":"info","message":"Starting Oracle Node daemon","service":"@chenaikit/oracle-node","nodeAddress":"GB...","contractId":"CA...","pollIntervalMs":15000,"adapters":["backend-credit-score","backend-fraud-alert"]}
{"timestamp":"2026-09-08T15:20:00.050Z","level":"info","message":"Oracle HTTP server listening","service":"@chenaikit/oracle-node","host":"0.0.0.0","port":8080}
```

---

## Health and Monitoring

### Health Endpoint

Query `GET /health` to verify service availability:

```bash
curl -s http://localhost:8080/health | jq .
```

Response:

```json
{
  "status": "healthy",
  "service": "@chenaikit/oracle-node",
  "version": "0.1.0",
  "uptimeSeconds": 124,
  "nodeAddress": "GB...",
  "contractId": "CA...",
  "registeredFeeds": ["credit_sc", "fraud_flg"]
}
```

### Metrics Endpoint

Query `GET /metrics` for JSON metrics:

```bash
curl -s http://localhost:8080/metrics | jq .
```

Response:

```json
{
  "submissionsSucceeded": 28,
  "submissionsFailed": 0,
  "submissionsRejected": 0,
  "lastSubmissionTimestamp": 1757344800,
  "lastSubmissionRound": 9,
  "uptimeSeconds": 124,
  "activeFeedsCount": 2
}
```

For Prometheus metric format, request with `Accept: text/plain`:

```bash
curl -s -H "Accept: text/plain" http://localhost:8080/metrics
```

Output:

```text
# HELP oracle_submissions_succeeded_total Total successful data submissions
# TYPE oracle_submissions_succeeded_total counter
oracle_submissions_succeeded_total 28
# HELP oracle_submissions_failed_total Total failed data submissions
# TYPE oracle_submissions_failed_total counter
oracle_submissions_failed_total 0
# HELP oracle_submissions_rejected_total Total submissions rejected by contract rules
# TYPE oracle_submissions_rejected_total counter
oracle_submissions_rejected_total 0
# HELP oracle_uptime_seconds Process uptime in seconds
# TYPE oracle_uptime_seconds gauge
oracle_uptime_seconds 124
```

---

## Verification on-Chain

Verify aggregated values on-chain using Soroban CLI:

```bash
stellar contract invoke \
  --id <ORACLE_CONTRACT_ID> \
  --source-account oracle-node-01 \
  --network testnet \
  -- \
  get_aggregated_value \
  --feed_id credit_sc
```

---

## Slashing and Governance Operations

The contract permits the contract admin or designated governance contract (`set_governance`) to execute disciplinary slashing when an oracle node misbehaves or submits corrupted data:

```bash
stellar contract invoke \
  --id <ORACLE_CONTRACT_ID> \
  --source-account governance-account \
  --network testnet \
  -- \
  slash_node \
  --admin $(stellar keys address governance-account) \
  --node <OFFENDING_NODE_ADDRESS> \
  --amount 20000000
```

When stake drops below the minimum stake threshold, the node is deactivated (`is_active: false`) and cannot submit data until re-staked.

---

## Troubleshooting

### 1. `NodeInactive` or `NodeNotRegistered` Rejections
- Ensure `register_node` was called and confirmed on-chain.
- Verify node has not been slashed below minimum stake (`get_node`).

### 2. `StaleData` or `FutureTimestamp` Rejections
- Ensure host machine NTP clock is synchronized within 5 seconds of real time.
- Verify `freshness_window` configured for the feed is sufficient.

### 3. Transient RPC Rate Limits (HTTP 429)
- The submitter automatically applies full-jitter exponential backoff.
- Tune `POLL_INTERVAL_MS` or use a dedicated Soroban RPC node endpoint.
