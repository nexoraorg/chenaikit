# Governance Contract

This is the Soroban smart contract for handling decentralized governance.

## Features

1. **Proposals**: Create new governance proposals with an end time. Proposer must be authorized and specify a future end time.
2. **Voting**: Authorized voters can cast yes/no votes on active proposals. Duplicate and unauthorized votes are rejected.
3. **Finalization**: Proposals can only be finalized after the end time has passed. They cannot be finalized early or multiple times.

## Rules
- Proposals must have a non-empty description.
- Proposal end time must be strictly greater than the start time (current ledger time).
- A voter must be added by an admin to be authorized to vote.
- Only one vote per proposal per authorized voter is allowed.
- Finalization is locked until the proposal's voting window (end time) closes.
