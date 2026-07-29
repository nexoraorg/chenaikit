# Complex Issues for Contributors

## 🔴 Issue 1: Real-time WebSocket Infrastructure with Event Broadcasting

**Complexity**: Very High  
**Effort**: 3-4 weeks  
**Skills**: Node.js, WebSockets, Redis Pub/Sub, React, TypeScript, Authentication

### Description
Currently, `frontend/src/components/WebSocketProvider.tsx` exists but there's no actual WebSocket backend. Implement a complete real-time event system for live updates across the platform.

### Requirements
- **Backend**: Add `socket.io` or `ws` server to Express with namespace-based routing
- **Authentication**: JWT-based WebSocket auth with handshake validation
- **Redis Adapter**: Horizontal scaling with Redis pub/sub for multi-instance deployments
- **Event Types**: Real-time credit score updates, fraud alerts, transaction notifications, system metrics
- **Frontend**: Complete the WebSocketProvider with reconnection logic, event routing, and React hooks
- **Resilience**: Heartbeat/ping-pong, graceful degradation, message queuing during disconnection
- **Testing**: Integration tests with concurrent connections, stress testing

### Challenges
- Coordinating state between HTTP and WebSocket contexts
- Handling reconnection without duplicate events
- Scaling across multiple backend instances

### Acceptance Criteria
- [ ] `pnpm add socket.io && pnpm add @types/socket.io` in backend
- [ ] WebSocket server attached to Express in `backend/src/index.ts`
- [ ] JWT authentication middleware for socket connections
- [ ] Redis adapter configured for multi-instance scaling
- [ ] Namespace-based routing: `/alerts`, `/scores`, `/transactions`
- [ ] Frontend WebSocketProvider fully functional with TypeScript types
- [ ] Custom React hooks: `useWebSocket`, `useWebSocketEvent`
- [ ] Integration tests: 100+ concurrent connections, message latency <100ms
- [ ] Documentation with connection lifecycle and event contracts
- [ ] Docker compose example with Redis for local development

---

## 🔴 Issue 2: Multi-Factor Authentication (MFA) System

**Complexity**: Very High  
**Effort**: 2-3 weeks  
**Skills**: Cryptography, QR codes, Auth flows, React, Prisma

### Description
Implement a complete MFA system supporting TOTP, backup codes, and recovery mechanisms compliant with NIST 800-63B.

### Requirements
- **Backend**:
  - TOTP secret generation and validation (RFC 6238)
  - Backup code generation (10 one-time codes, hashed storage using bcrypt)
  - Time-based window tolerance (±1 step = 60 seconds)
  - MFA enforcement per-user or per-account based on policies
  - Recovery email flow with encrypted tokens (AES-256-GCM)
- **Frontend**:
  - QR code display for authenticator apps using `qrcode.react`
  - Backup code display (one-time reveal, copy-to-clipboard)
  - MFA setup wizard with step-by-step guidance
  - Recovery flow UI
- **Database**: Add `mfaSecret`, `mfaEnabled`, `backupCodes` columns to User model
- **Security**: Rate limiting on MFA attempts (5 attempts/5 min), account lockout after 10 failures

### Challenges
- Ensuring TOTP algorithms implement proper time synchronization
- Secure backup code storage (hashed, not plaintext)
- Migration path for existing users (graceful enrollment)
- Handling clock drift across distributed systems

### Acceptance Criteria
- [ ] Database migration adding MFA fields to User model
- [ ] `POST /api/auth/mfa/setup` - generates TOTP secret, returns QR code
- [ ] `POST /api/auth/mfa/verify` - validates TOTP token, enables MFA
- [ ] `POST /api/auth/mfa/disable` - requires password + current TOTP
- [ ] `POST /api/auth/mfa/recovery` - sends recovery email with encrypted link
- [ ] Middleware `requireMFA` that checks session and prompts for TOTP if needed
- [ ] Frontend pages: `/settings/security/mfa`, MFA challenge modal
- [ ] Unit tests: TOTP generation/validation with 30s time window
- [ ] Security tests: timing attack resistance, brute force protection
- [ ] Documentation: MFA enrollment flow, recovery procedures, admin override

---

## 🔴 Issue 3: Audit Log Search & Compliance Dashboard

**Complexity**: High  
**Effort**: 3 weeks  
**Skills**: PostgreSQL full-text search, React, Data visualization, Access control, Retention policies

### Description
The backend emits audit logs but they're only in memory. Build a persistent, queryable audit system with compliance reporting for SOC2/GDPR requirements.

### Requirements
- **Storage**: Persist audit logs to PostgreSQL with optimized indexes (B-tree on timestamp/action, GIN on JSONB)
- **Search API**: 
  - Filter by date range, user, action type, resource, IP address
  - Full-text search on request/response details using PostgreSQL `tsvector`
  - Pagination with cursor-based navigation (seek method)
- **Frontend Dashboard**:
  - Advanced filter panel with date pickers, multi-select dropdowns
  - Audit trail viewer with expandable JSON details
  - Statistics: top users, failed actions, geographic distribution (GeoIP)
- **Export**: CSV/JSON/PDF export with access control (RBAC)
- **Retention**: Automated archiving policy (90 days hot storage, 1 year cold storage in S3)
- **Compliance**: GDPR/SOC2 reports showing data access patterns, PII access logs
- **Redaction**: Automatic PII redaction (emails, SSNs, credit cards) using regex patterns

### Challenges
- Indexing billions of log entries efficiently without impacting write performance
- Real-time aggregation without exhausting memory
- Redacting sensitive data in logs while maintaining searchability
- Balancing retention costs vs. compliance requirements

### Acceptance Criteria
- [ ] Database migration creating `audit_logs` table with proper indexes
- [ ] Repository pattern `AuditLogRepository` with search methods
- [ ] REST API: `GET /api/audit?start_date&end_date&user_id&action&search`
- [ ] Advanced filter parser supporting nested JSON queries
- [ ] React dashboard with `@mui/x-date-pickers` and `@tanstack/react-table`
- [ ] Detail drawer with syntax-highlighted JSON (using `react-json-view`)
- [ ] Statistics cards: total events, unique users, failure rate, top resources
- [ ] CSV export with streaming (for large datasets)
- [ ] Automated retention job (runs daily, archives to S3)
- [ ] PII redaction middleware in logging pipeline
- [ ] Tests: 1M log entries searchable in <500ms
- [ ] Documentation: retention policy, compliance report samples

---

## 🟡 Issue 4: Plugin Architecture with Hot-Reloading

**Complexity**: Very High  
**Effort**: 4 weeks  
**Skills**: Design patterns, Module federation, JavaScript proxies, Hot Module Replacement, Plugin systems

### Description
Transform `@chenaikit/core` into an extensible platform with a plugin system that allows runtime extension without core modifications.

### Requirements
- **Plugin Lifecycle**: Registration, initialization, activation, deactivation, disposal with hooks
- **Hook System**: Before/after hooks for every major operation (validation, API calls, DB queries)
- **Configuration**: Each plugin has a JSON schema config, validated at load time using Zod
- **Isolation**: Plugins run in isolated contexts with controlled access to core internals (proxy-based)
- **Hot-Reloading**: Development mode plugin reloading without server restart using `chokidar`
- **Frontend**: Plugin-aware UI that dynamically loads micro-frontends via Module Federation
- **CLI**: `chenaikit plugin install <name>`, `plugin list`, `plugin uninstall`
- **Example Plugins**: 
  - Custom validation rules
  - Third-party API integrations
  - Webhook dispatchers
  - Custom fraud detection models (Python WASM modules)

### Challenges
- Type safety across plugin boundaries (shared TypeScript interfaces)
- Preventing plugin memory leaks (automatic cleanup in dispose hook)
- Version compatibility matrix between plugins and core
- Circular dependency detection in plugin graph
- Security: sandboxing untrusted plugins (restricted Node.js VM context)

### Acceptance Criteria
- [ ] Plugin interface definition with lifecycle methods
- [ ] PluginManager class with registry, validation, and execution
- [ ] Hook system: `plugin.hooks.before('validation', fn)` and `plugin.hooks.after('api.call', fn)`
- [ ] Config schema validation using `zod`
- [ ] Hot-reload watcher for development (file change → dispose → reload)
- [ ] Frontend `PluginLoader` component with dynamic imports
- [ ] CLI commands: `plugin install`, `plugin enable`, `plugin disable`, `plugin remove`
- [ ] 3 example plugins implemented (webhook, custom validator, metrics exporter)
- [ ] Tests: plugin isolation, hook ordering, error handling, hot-reload
- [ ] Documentation: plugin API, creating plugins, publishing to registry
- [ ] Security audit: plugin permission model, sandbox escape prevention

---

## 🟡 Issue 5: Distributed Tracing with OpenTelemetry + Jaeger

**Complexity**: High  
**Effort**: 2-3 weeks  
**Skills**: Observability, Distributed systems, OpenTelemetry, React tracing, Sampling strategies

### Description
Enhance the existing OpenTelemetry setup with custom spans, frontend-backend correlation, and a Jaeger UI for end-to-end trace visualization.

### Requirements
- **Backend**:
  - Custom spans for credit scoring (duration, model version, feature weights)
  - Fraud detection spans (risk score calculation time)
  - External API call spans (Stellar Horizon, OpenAI, email service)
  - Baggage propagation for request context (tenant ID, feature flags, user tier)
  - Exporters to Jaeger (all environments) and vendor-neutral OTLP format
  - Sampling strategies: probabilistic (1%), error-based (100% on 5xx), rate-limiting
- **Frontend**:
  - `@opentelemetry/sdk-trace-web` integration with `OpenTelemetryBrowserTracerProvider`
  - User action tracing (button clicks, navigation events, form submissions)
  - Network request tracing (fetch/XHR/MutationObserver)
  - Performance marks for rendering phases (first paint, first contentful paint)
  - Correlation with backend via traceparent header
- **Correlation**: Trace IDs in structured logs, metrics with trace exemplars
- **Analysis**: Service dependency maps, flame graphs, bottleneck detection
- **Cost Control**: Sampling to keep monthly data ingestion under budget

### Challenges
- Managing trace volume in production (cost control with intelligent sampling)
- Correlating frontend/backend traces across network boundaries
- Sampling strategies that don't miss critical errors (tail-based sampling)
- Performance overhead (<2% CPU, <5MB memory per trace)

### Acceptance Criteria
- [ ] Backend custom span decorators for all service-to-service calls
- [ ] Wrapper functions: `traceCreditScore()`, `traceFraudDetection()`, `traceExternalAPI()`
- [ ] Baggage propagation middleware extracting tenant/user context
- [ ] Jaeger all-in-one deployment via Docker Compose
- [ ] Frontend `BrowserTracerProvider` initialized in `index.tsx`
- [ ] React component wrapper: `<TracedComponent name="CreditScoreCard">`
- [ ] Network instrumentation via `patchedFetch` and `XMLHttpRequest` interceptor
- [ ] Correlation: trace ID injected into log metadata and response headers
- [ ] Sampling config: 1% default, 100% on errors, max 1000 traces/min
- [ ] Distributed tracing tests: trace propagation across 5 microservices
- [ ] Documentation: tracing architecture, sampling config, debugging with Jaeger
- [ ] Cost analysis: projected monthly storage vs. budget

---

## 🟢 Issue 6: ML Model Versioning & A/B Testing Framework

**Complexity**: Very High  
**Effort**: 4 weeks  
**Skills**: MLflow, Python, React, Statistics, Feature flags, Experimentation, CI/CD

### Description
Add MLOps capabilities for versioning, deploying, and A/B testing ML models (credit scoring, fraud detection) with statistical rigor.

### Requirements
- **Model Registry**: 
  - Version control for `.pkl`/`.joblib` models with content-addressable storage (SHA256)
  - Model metadata: accuracy, precision/recall, training data version, hyperparameters
  - Staging → Production promotion workflow with approval gates
  - Model lineage tracking (training run, dataset, code commit)
- **Experiment Tracking**:
  - A/B test framework with configurable traffic splitting (50/50, 90/10, etc.)
  - Statistical significance testing (p-value, confidence intervals, power analysis)
  - Minimum detectable effect (MDE) calculator
  - Early stopping rules (peek prevention using confidence intervals)
- **Frontend**:
  - Model performance comparison charts (ROC curves, feature importance)
  - Experiment configuration UI with traffic allocation sliders
  - Real-time A/B test results with statistical indicators
  - Model rollback button with one-click revert
- **Rollback**: Automated canary analysis (compare metrics for 24h, auto-rollback if degradation >5%)
- **Integration**: GitHub Actions workflow for model training → validation → deployment
- **Examples**: 
  - Compare two credit scoring models side-by-side
  - Gradually roll out improved fraud detector to 10% → 50% → 100%

### Challenges
- Ensuring model serialization compatibility across scikit-learn versions
- Statistical rigor: preventing p-hacking, handling multiple comparison problem (Bonferroni correction)
- Cold-start strategies for new models (bandit algorithms before A/B test)
- Model drift detection (trigger retraining when performance degrades)
- Handling biased traffic allocation (network partitions, user stickiness)

### Acceptance Criteria
- [ ] Model registry database schema with versioning tables
- [ ] `ModelRegistry` class: `register()`, `promote()`, `rollback()`, `getVersion()`
- [ ] A/B test service: `createExperiment()`, `assignVariant()`, `trackConversion()`
- [ ] Statistical analysis: `calculatePValue()`, `checkSignificance()`, `computeConfidenceInterval()`
- [ ] Feature flag integration for variant routing
- [ ] React dashboard: experiment list, variant comparison, statistical metrics
- [ ] CI workflow: `.github/workflows/model-deployment.yml`
- [ ] Python SDK: `chenai-mlflow` package for model registration
- [ ] Model drift detector: monitor production metrics, alert when AUC drops >3%
- [ ] Integration tests: A/B test with simulated conversions, verify statistical validity
- [ ] Documentation: experiment design guide, model deployment runbook, rollback procedures
- [ ] Example: Credit score model v2.0 vs v1.0 with 90/10 traffic split

---

## 📋 Implementation Guidelines for Contributors

### Getting Started
1. **Claim an issue**: Comment on the GitHub issue with "I'd like to work on this"
2. **Create a branch**: `git checkout -b feature/issue-<number>-<short-description>`
3. **Ask questions**: Tag maintainers in questions within 24 hours
4. **Design doc**: For Very High complexity, submit a design doc for review before implementation

### Code Standards
- Follow existing patterns in `packages/core/src/` and `backend/src/middleware/`
- Write tests: aim for >80% coverage on new code
- Update documentation: README, API docs, inline JSDoc comments
- Type safety: no `any` types without justification, strict TypeScript

### Review Process
- Requires 2 approving reviews from maintainers
- CI must pass: lint, test, build
- Security review for auth/crypto/encryption changes
- Performance benchmarks for database/algorithm changes

### Support
- **Mentorship**: Each Very High issue has an assigned senior maintainer
- **Check-ins**: Weekly sync calls on Fridays for complex issues
- **Documentation**: Pair programming sessions available upon request

---

*Last updated: 2026-07-17*
*Maintained by: ChenAIKit Core Team*