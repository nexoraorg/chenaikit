Model Attestation Soroban Contract

This crate will implement the on-chain attestation registry used to anchor
Merkle roots of inference receipt batches and manage registered signers and models.

Next steps:
- Implement access control (owner/role checks) using `contracts/common-utils` patterns.
- Add comprehensive unit tests in `src/test.rs` with golden vectors.
- Wire contract build into CI and add deployment instructions.
