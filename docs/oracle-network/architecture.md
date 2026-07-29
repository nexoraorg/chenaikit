# Oracle Network Architecture

## Overview

The Decentralized Model Oracle Network (DMON) provides a trustless, decentralized infrastructure for aggregating ML model inferences from multiple independent oracle nodes. The network uses a commit-reveal scheme, quorum-based aggregation, and economic incentives to ensure accurate and reliable results.

## System Components

### 1. Smart Contracts

#### Oracle Network Contract (`contracts/oracle-network/`)
The core smart contract implements the oracle network logic on the Stellar blockchain.

**Key Modules:**
- **Node Registry**: Manages oracle node registration, staking, and reputation
- **Commit-Reveal**: Implements the two-phase submission scheme to prevent front-running
- **Aggregation**: Computes median/trimmed-mean of submissions for final results
- **Dispute Resolution**: Handles dispute filing, voting, and re-aggregation
- **Slashing**: Enforces penalties for malicious behavior
- **Model Version Binding**: Ensures only approved model versions are used

**Storage:**
- Node information (address, stake, reputation, active status)
- Submission data (commits, reveals, timestamps)
- Dispute records (disputer, evidence, votes, resolution)
- Approved model versions (hash, metadata)
- Reputation snapshots (historical tracking)

#### Governance Contract Extension
Extended with `ApproveModelVersion` proposal type to govern which model versions can be used in the oracle network.

#### Consumer Contracts
- **Credit Score Contract**: Migrated to oracle-gated writes
- **Fraud Detection Contract**: Migrated to oracle-gated writes

### 2. Oracle Node Package (`packages/oracle-node/`)

TypeScript package for running oracle nodes.

**Components:**
- **OracleWorker**: Main service handling inference requests and submissions
- **CommitRevealManager**: Manages commit-reveal transaction execution with timing
- **MetricsCollector**: Collects and reports health/liveness metrics
- **Drift Detection Integration**: Refuses serving drifted models

**Configuration:**
```typescript
interface OracleConfig {
  nodeKeypair: Keypair;
  rpcUrl: string;
  contractAddress: string;
  modelPath: string;
  driftThreshold: number;
}
```

### 3. Backend Services (`backend/src/`)

#### Service Layer (`services/oracleService.ts`)
Business logic for oracle network operations:
- Node registration and management
- Submission tracking
- Dispute handling
- Reputation calculation
- Statistics aggregation

#### API Routes (`routes/v2/oracle.ts`)
RESTful endpoints for oracle operations:
- `GET /api/v2/oracle/nodes` - List oracle nodes
- `POST /api/v2/oracle/nodes` - Register new node
- `GET /api/v2/oracle/submissions` - List submissions
- `POST /api/v2/oracle/disputes` - File dispute
- `GET /api/v2/oracle/reputation` - Get reputation data
- `GET /api/v2/oracle/stats` - Network statistics

#### Background Job (`jobs/oracleEventReconciliation.ts`)
Polls blockchain events and reconciles with database:
- Node registration events
- Commit/reveal events
- Aggregation finalization events
- Dispute events
- Slashing events

### 4. ML Governance (`ml/governance/`)

#### Model Card (`model_card.py`)
Extended with oracle network metadata:
- Model hash computation and verification
- Oracle approval status
- Reproducibility requirements

#### Policy (`policy.py`)
Extended with oracle-specific requirements:
- `OracleNetworkPolicy`: Model size limits, drift detection requirements
- `evaluate_oracle_readiness()`: Comprehensive oracle readiness check

### 5. Evaluation Tools (`ml/evaluation/`)

#### Quorum Simulation (`quorum_simulation.py`)
Simulates oracle network behavior:
- Honest/dishonest node distributions
- Various attack scenarios
- Aggregation method comparison
- Dispute rate analysis

## Data Flow

### 1. Inference Request Flow

```
Consumer Contract
    ↓ (request inference)
Oracle Network Contract
    ↓ (broadcast to nodes)
Oracle Nodes (via OracleWorker)
    ↓ (run ML inference)
Oracle Nodes (via CommitRevealManager)
    ↓ (submit commit)
Oracle Network Contract (commit phase)
    ↓ (wait for reveal window)
Oracle Nodes (via CommitRevealManager)
    ↓ (submit reveal)
Oracle Network Contract (reveal phase)
    ↓ (aggregate quorum)
Oracle Network Contract (finalization)
    ↓ (return result)
Consumer Contract
```

### 2. Dispute Resolution Flow

```
Disputer
    ↓ (file dispute)
Oracle Network Contract
    ↓ (open dispute window)
Other Nodes
    ↓ (vote on dispute)
Oracle Network Contract
    ↓ (tally votes)
Governance Contract
    ↓ (resolve dispute)
Oracle Network Contract
    ↓ (re-aggregate or slash)
```

### 3. Chain Event Reconciliation

```
Blockchain Events
    ↓ (poll by background job)
OracleEventReconciliation
    ↓ (process events)
Prisma Database
    ↓ (update records)
Backend API
    ↓ (serve data)
Frontend
```

## Security Mechanisms

### 1. Commit-Reveal Scheme
- **Commit Phase**: Nodes submit hash of (result + salt)
- **Reveal Phase**: Nodes submit actual result and salt
- **Prevents**: Front-running and copying other nodes' submissions

### 2. Quorum Aggregation
- **Median**: Resistant to outliers from dishonest nodes
- **Trimmed Mean**: Removes extreme values before averaging
- **Variance Threshold**: Triggers disputes on high variance

### 3. Economic Incentives
- **Staking**: Nodes must stake tokens to participate
- **Rewards**: Nodes earn for successful submissions
- **Slashing**: Nodes lose stake for malicious behavior
- **Reputation**: Tracks long-term node reliability

### 4. Dispute Resolution
- **Dispute Window**: Time window to file disputes after aggregation
- **Voting**: Other nodes vote on dispute validity
- **Penalties**: Frivolous disputes result in reputation loss
- **Re-aggregation**: Excludes disputed submissions and recalculates

### 5. Model Version Control
- **Governance Approval**: Only model versions approved by governance can be used
- **Hash Binding**: Submissions are bound to specific model hashes
- **Drift Detection**: Nodes refuse serving drifted models

## Database Schema

### Prisma Models

#### OracleNode
```prisma
model OracleNode {
  id          String   @id @default(cuid())
  address     String   @unique
  stake       BigInt
  reputation  Int      @default(1000)
  isActive    Boolean  @default(true)
  registeredAt DateTime @default(now())
  lastSeenAt  DateTime?
  submissions OracleSubmission[]
  disputes    Dispute[]
  slashEvents SlashEvent[]
  reputationSnapshots ReputationSnapshot[]
}
```

#### OracleSubmission
```prisma
model OracleSubmission {
  id          String   @id @default(cuid())
  requestId   String
  nodeId      String
  phase       String   // commit, reveal
  value       Float?
  commitHash  String
  modelHash   String
  status      String   // pending, finalized, disputed
  submittedAt DateTime @default(now())
  revealedAt  DateTime?
  node        OracleNode @relation(fields: [nodeId], references: [id])
}
```

#### Dispute
```prisma
model Dispute {
  id          String   @id @default(cuid())
  requestId   String
  disputerId  String
  reason      String
  status      String   // pending, resolved, rejected
  votesFor    Int      @default(0)
  votesAgainst Int     @default(0)
  resolvedAt  DateTime?
  node        OracleNode @relation(fields: [disputerId], references: [id])
}
```

#### SlashEvent
```prisma
model SlashEvent {
  id          String   @id @default(cuid())
  nodeId      String
  reason      String
  amount      BigInt
  slashedAt   DateTime @default(now())
  node        OracleNode @relation(fields: [nodeId], references: [id])
}
```

#### ReputationSnapshot
```prisma
model ReputationSnapshot {
  id          String   @id @default(cuid())
  nodeId      String
  reputation  Int
  snapshotAt DateTime @default(now())
  node        OracleNode @relation(fields: [nodeId], references: [id])
}
```

## Frontend Architecture

### Oracle Network Page (`frontend/src/pages/OracleNetwork.tsx`)

Tabbed interface with:
- **Live Feed**: Real-time submission feed
- **Nodes**: Node reputation and stake table
- **Disputes**: Dispute filing and voting UI
- **Analytics**: Variance charts and statistics

### Components

#### NetworkStats
Displays key network statistics:
- Total nodes
- Active nodes
- Total stake
- Average reputation

#### LiveSubmissionFeed
Real-time feed of oracle submissions:
- Node address
- Phase (commit/reveal)
- Status
- Request ID
- Auto-refresh

#### NodeReputationTable
Sortable table of oracle nodes:
- Address
- Reputation
- Stake
- Activity status
- Pagination

#### DisputeFiling
Form for filing disputes:
- Request ID
- Evidence
- Reason
- Submission

#### VarianceCharts
Analytics visualization using Chart.js:
- Submission variance by node
- Dispute status distribution
- Slash event reasons

## Deployment Architecture

### Development
```
┌─────────────────┐
│  Frontend Dev   │
│  (localhost)    │
└────────┬────────┘
         │
┌────────▼────────┐
│  Backend Dev    │
│  (localhost)    │
└────────┬────────┘
         │
┌────────▼────────┐
│  Prisma DB      │
│  (SQLite)       │
└─────────────────┘
```

### Production
```
┌─────────────────┐
│  Frontend       │
│  (CDN)          │
└────────┬────────┘
         │
┌────────▼────────┐
│  Backend API    │
│  (Load Balanced)│
└────────┬────────┘
         │
┌────────▼────────┐
│  PostgreSQL     │
│  (Primary)      │
└─────────────────┘
         │
┌────────▼────────┐
│  Stellar        │
│  Blockchain     │
└─────────────────┘
```

## Monitoring and Observability

### Metrics Collected
- Node uptime and availability
- Submission success/failure rates
- Response times
- Reputation changes
- Dispute rates
- Variance statistics

### Tracing
- End-to-end inference request tracing
- Transaction submission tracking
- Event reconciliation monitoring

### Logging
- Structured logging for all oracle operations
- Error tracking and alerting
- Audit logs for governance actions

## Testing Strategy

### Unit Tests
- Smart contract functions
- Oracle node components
- Backend service methods
- ML governance functions

### Integration Tests
- Contract-to-contract interactions
- Backend-to-database operations
- API endpoint testing
- Oracle node to contract communication

### Adversarial Tests
- Dishonest majority attacks
- Late reveal attacks
- No reveal attacks
- Commit hash mismatches
- Frivolous disputes

### Simulation Tests
- Quorum aggregation simulation
- Attack scenario simulation
- Aggregation method comparison
- Economic incentive modeling

## Performance Considerations

### Gas Optimization
- Batch operations where possible
- Efficient storage patterns
- Minimize contract state changes

### Scalability
- Horizontal scaling of backend services
- Database indexing for queries
- Caching of frequently accessed data
- Rate limiting for API endpoints

### Latency
- Commit-reveal timing optimization
- Efficient event polling
- Background job prioritization

## Future Enhancements

### Planned Features
- Multi-chain support
- Advanced reputation algorithms
- Dynamic quorum thresholds
- Cross-chain model verification
- Zero-knowledge proof integration

### Research Areas
- Improved aggregation algorithms
- Better dispute resolution mechanisms
- Enhanced economic security models
- Privacy-preserving inference
