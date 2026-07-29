# Verifiable Inference Receipts

## Overview

This design adds an end-to-end provenance layer for ChenAIKit inference outputs. It enables a relying application to verify:

- which registered model artifact produced a decision
- whether the model and signer were authorized at inference time
- whether committed inputs/outputs were modified afterward
- whether the receipt was anchored in a Soroban attestation registry

The goal is verifiable provenance, not on-chain model execution. Only hashes, commitments, signatures, and registry state are stored on-chain.

## Key components

- `InferenceReceiptV1` canonical receipt schema
- Ed25519 receipt signing and offline verification
- Soroban `model-attestation` registry contract
- backend attestation service and API endpoints
- core SDK primitives for receipt creation, batch building, and verification
- end-to-end example in `examples/verifiable-credit-score/`

## Canonicalization and hashing

### Format

The canonical receipt payload uses RFC 8785 JSON canonicalization.

- map keys sorted lexicographically
- no insignificant whitespace
- stable encoding for numbers, strings, booleans, null, arrays, and objects
- `expiresAt` optional, omitted when not used
- fixed field names as defined by `InferenceReceiptV1`

This choice is compatible with both TypeScript and Rust golden vectors and remains human-readable for audits.

### Domain separation

Receipt signatures are calculated over the canonical payload prefixed by a domain separation tag:

- `CHENAIKIT:INFERENCE_RECEIPT_V1`

This prevents signature reuse across unrelated message types.

### Hash functions

- SHA-256 for artifact hashes and content commitments
- Ed25519 for receipt signatures
- Merkle tree hashes use SHA-256 applied to leaf/value bytes in deterministic order

## `InferenceReceiptV1` schema

Fields:

- `schemaVersion: 1`
- `receiptId: string` (UUIDv4 or equivalent cryptographic random identifier)
- `nonce: string` (cryptographic random nonce)
- `issuedAt: string` (ISO 8601 UTC timestamp)
- `expiresAt?: string` (ISO 8601 UTC timestamp)
- `requestId?: string`
- `correlationId?: string`
- `subjectCommitment: string` (pseudonymous commitment)
- `modelId: string`
- `modelVersionId: string`
- `modelSemanticVersion?: string`
- `artifactHash: string` (SHA-256 hex)
- `featureSchemaHash: string` (SHA-256 hex)
- `featureCommitment: string` (SHA-256 hex of deterministic feature serialization)
- `featureMerkleRoot?: string` (SHA-256 hex, optional alternative to `featureCommitment`)
- `outputCommitment: string` (SHA-256 hex)
- `publicResultSummary?: Record<string, unknown>`
- `keyId: string`
- `network: string`
- `ledgerBounds?: { minLedger?: number; maxLedger?: number }`
- `batchId?: string`

The signed object excludes runtime-only verification metadata such as proofs.

## Signing and verification

### Signing pipeline

1. Build a canonical receipt object with all required fields.
2. Serialize via RFC 8785 canonical JSON.
3. Prepend domain separator bytes.
4. Sign using Ed25519 via injected `SignerProvider`.
5. Store the resulting `signature` and return `SignedInferenceReceipt`.

### Verification pipeline

1. Reconstruct and canonicalize the receipt payload.
2. Verify the signature using `keyId` and the on-chain registry state.
3. Validate expiration, ledger bounds, and nonce uniqueness/replay controls.
4. Confirm the model artifact hash matches the registry model version.
5. Validate inclusion proof against an anchored Merkle root if provided.

### Signer metadata

Each signer record includes:

- `keyId`
- `publicKey` (Ed25519)
- `validFrom` and optional `validUntil`
- `revokedAt` (optional)
- `status` (`active`, `revoked`)

Verification failures are explicit for:

- tampering
- unknown signer key
- revoked signer
- expired signer
- expired receipt
- invalid network
- invalid proof
- unknown or mismatched model version

## Soroban attestation registry contract

### Contract responsibilities

The `model-attestation` contract stores:

- registered model artifact hashes
- signer public keys and validity windows
- anchored Merkle batch roots
- events for model/signature/batch lifecycle

The contract rejects:

- duplicate `batchId`
- unauthorized writes
- registration of raw PII or feature data

### Core methods

- `initialize(admin: Address)`
- `register_model(modelId: String, modelVersionId: String, artifactHash: String, schemaVersion: u32)`
- `revoke_model(modelId: String, modelVersionId: String)`
- `register_signer(keyId: String, publicKey: BytesN<32>, validFrom: u64, validUntil: Option<u64>)`
- `revoke_signer(keyId: String)`
- `anchor_batch(batchId: String, modelId: String, root: BytesN<32>, count: u32, ledger: u32, timestamp: u64, schemaVersion: u32)`
- `get_model(modelId: String, modelVersionId: String, ledger: Option<u64>) -> Option<ModelRecord>`
- `get_signer(keyId: String, ledger: Option<u64>) -> Option<SignerRecord>`
- `get_batch(batchId: String) -> Option<BatchRecord>`

### Access control

- only the configured admin can register/revoke models, signers, and anchors
- the admin is established at initialization
- duplicate `batchId` anchor submissions are rejected

### Storage model

- `ModelRecord` stores `artifactHash`, `schemaVersion`, `registeredAt`, `revokedAt`
- `SignerRecord` stores `publicKey`, `validFrom`, `validUntil`, `revokedAt`
- `BatchRecord` stores `root`, `modelId`, `count`, `ledger`, `timestamp`, `schemaVersion`

### Events

- `ModelRegistered`
- `ModelRevoked`
- `SignerRegistered`
- `SignerRevoked`
- `BatchAnchored`

### Upgrade path

The contract will follow existing Soroban upgrade patterns used elsewhere in `contracts/`.

## Backend integration

### Service

`backend/src/services/inferenceAttestationService.ts` will:

- lookup the exact `modelVersion` via `ModelRegistryService`
- ensure `artifactHash` matches registry and optionally on-chain state
- build canonical receipt payload
- sign via injected `SignerProvider`
- persist metadata to Prisma without raw PII
- queue receipts for deterministic batch anchoring
- submit anchors idempotently and retry safely

### API routes

Expose v2 endpoints:

- `POST /api/v2/attestations/verify`
- `GET /api/v2/attestations/:receiptId`

Additional internal worker or authenticated operation for batch anchoring.

### Schema validation

`backend/src/schemas/attestation.schema.ts` will validate:

- canonical receipt fields
- SHA-256 hex digests
- ISO 8601 date strings
- signer key IDs and network names
- object shape restrictions

### Prisma models

New models will include:

- `InferenceReceipt`
- `ReceiptBatch`
- optional `AttestationSigner` audit trail

Receipts store metadata and anchor state, not raw feature values or subject identifiers.

## Core SDK

New SDK modules under `packages/core/src/ai/attestation/` will expose:

- `createInferenceReceipt(input, signer): Promise<SignedInferenceReceipt>`
- `verifyInferenceReceipt(receipt, options): Promise<VerificationResult>`
- `buildReceiptBatch(receipts): ReceiptBatch`
- `verifyReceiptInclusion(receipt, proof, root): boolean`
- `verifyAnchoredReceipt(receipt, proof, registryClient): Promise<VerificationResult>`

The verifier is backend-independent and only requires network access for registry/anchor state.

## End-to-end example

The example flow in `examples/verifiable-credit-score/` will:

1. register a model artifact hash in the on-chain registry
2. compute a sample credit inference
3. create and sign `InferenceReceiptV1`
4. batch receipts and anchor a Merkle root to local Soroban
5. verify receipt signature, registry state, and inclusion proof
6. demonstrate verification failure after mutating a committed field

## Historical revocation semantics

- model/signature revocation is historical and scoped by ledger/time
- receipts signed while a model and signer were active remain verifiable
- revoked keys/models should fail for new receipts after the revocation point
- offline verification uses the registry state at the receipt's ledger or timestamp

## Threat model highlights

- key compromise: rotation and bounded validity windows
- replay: unique `receiptId`, `nonce`, expiry, and ledger bounds
- equivocation: signed receipts reference on-chain registry state via model artifact hashes and anchored batch roots
- proof substitution: inclusion proofs are validated against an anchored Merkle root stored on-chain
- PII leakage: raw subject data, features, and outputs never enter contract storage or events

## Next steps

1. add core SDK receipt model and canonicalizer
2. add backend Prisma models, service, routes, and validation
3. add Soroban contract with registration, signer, and batch anchor logic
4. add cross-language canonicalization test vectors and contract tests
5. add example smoke test and documentation
