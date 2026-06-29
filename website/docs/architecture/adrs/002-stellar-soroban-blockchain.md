# ADR 002: Stellar and Soroban for Blockchain Layer

## Status
Accepted

## Context
ChenAIKit requires blockchain functionality for:
- Decentralized credit scoring storage
- Transparent fraud detection records
- Immutable transaction history
- Smart contract execution for business logic
- Cross-border payment capabilities

We needed to choose a blockchain platform that provides:
- Smart contract capabilities
- Low transaction costs
- Fast finality
- Good developer experience
- Active ecosystem

## Decision
We will use Stellar as our primary blockchain platform with Soroban for smart contracts.

### Technology Stack
- **Stellar Network**: Layer 1 blockchain for payments and asset issuance
- **Soroban**: Smart contract platform built on Stellar
- **Horizon API**: REST API for Stellar network interaction
- **Stellar SDK**: JavaScript/TypeScript SDK for client applications
- **Rust**: Programming language for Soroban contracts

## Rationale

### Why Stellar?

1. **Low Cost**: Transaction fees are ~$0.00001, making it economical for high-volume operations
2. **Fast Finality**: 3-5 second transaction confirmation
3. **Built-in DEX**: Native decentralized exchange for asset trading
4. **Asset Issuance**: Easy creation of custom tokens
5. **Compliance**: Built-in compliance features (authorized accounts, clawback)
6. **Mature Ecosystem**: 8+ years of production use

### Why Soroban?

1. **Modern Language**: Rust provides memory safety and performance
2. **WebAssembly**: Contracts compile to WASM for portability
3. **Stellar Integration**: Native access to Stellar accounts and assets
4. **Developer Experience**: Excellent tooling and documentation
5. **Cost Efficiency**: Optimized for low gas costs
6. **Security**: Strong type system and ownership model

## Consequences

### Positive
- **Low Operational Costs**: Minimal fees for transactions and contract execution
- **Fast User Experience**: Quick transaction finality improves UX
- **Rich Functionality**: Access to DEX, multi-sig, and asset features
- **Developer Productivity**: Rust's tooling and safety features
- **Ecosystem Support**: Active community and extensive documentation
- **Compliance Ready**: Built-in features for regulatory requirements

### Negative
- **Learning Curve**: Developers need to learn Rust and Soroban
- **Ecosystem Size**: Smaller than Ethereum (but growing rapidly)
- **Contract Limitations**: Some restrictions compared to EVM chains
- **Tooling Maturity**: Soroban is newer than established platforms

### Neutral
- **Network Effects**: Need to build on Stellar's existing ecosystem
- **Interoperability**: Limited direct bridges to other chains (can be added)

## Alternatives Considered

### Ethereum + Solidity
- **Pros**: Largest ecosystem, most developers, extensive tooling
- **Cons**: High gas fees ($5-50+ per transaction), slower finality (12-15s), complex development
- **Rejected**: Cost prohibitive for our use case

### Polygon/L2 Solutions
- **Pros**: Lower fees than Ethereum, EVM compatibility
- **Cons**: Still higher fees than Stellar, additional complexity, bridge risks
- **Rejected**: Stellar provides better cost/performance ratio

### Solana + Rust
- **Pros**: Very fast, low fees, Rust-based
- **Cons**: Network stability concerns, complex programming model, less mature tooling
- **Rejected**: Stellar offers better stability and developer experience

### Cosmos SDK
- **Pros**: Flexible, IBC for interoperability, Rust support
- **Cons**: Need to run own chain or find suitable zone, higher operational complexity
- **Rejected**: Too much infrastructure overhead

## Implementation Details

### Smart Contracts
We implement three core contracts in Soroban:

1. **Credit Score Contract**
   - Store and calculate credit scores
   - Access control for score updates
   - Oracle integration for external data

2. **Fraud Detection Contract**
   - Pattern recognition and risk scoring
   - Alert generation
   - Historical fraud data storage

3. **Governance Contract**
   - Voting mechanisms
   - Timelock for critical operations
   - Proposal management

### Backend Integration
```typescript
import { StellarConnector } from '@chenaikit/core';

const stellar = new StellarConnector({
  network: 'mainnet',
  horizonUrl: 'https://horizon.stellar.org'
});

// Interact with contracts
const score = await stellar.invokeContract(
  contractId,
  'calculate_score',
  [accountAddress]
);
```

### Network Strategy
- **Development**: Stellar testnet for development and testing
- **Staging**: Stellar testnet with production-like data
- **Production**: Stellar mainnet (public network)

## Migration Path

If we need to support additional blockchains in the future:

1. **Abstract Blockchain Layer**: Create interface for blockchain operations
2. **Adapter Pattern**: Implement adapters for each blockchain
3. **Multi-Chain Support**: Allow users to choose their preferred chain
4. **Bridge Contracts**: Enable cross-chain functionality

```typescript
interface BlockchainAdapter {
  deployContract(wasm: Buffer): Promise<string>;
  invokeContract(id: string, method: string, args: any[]): Promise<any>;
  getAccount(address: string): Promise<Account>;
}

class StellarAdapter implements BlockchainAdapter { /* ... */ }
class EthereumAdapter implements BlockchainAdapter { /* ... */ }
```

## Performance Considerations

### Transaction Throughput
- Stellar: ~1000 TPS (operations per second)
- Sufficient for our current scale
- Can batch operations for efficiency

### Contract Execution
- Soroban contracts execute in milliseconds
- Gas costs are predictable and low
- Optimization techniques available (WASM size reduction)

### Data Storage
- Use contract storage for critical data
- Use Horizon API for historical queries
- Cache frequently accessed data in backend

## Security Considerations

### Contract Security
- Comprehensive testing with Soroban SDK test utilities
- Access control on all sensitive operations
- Upgrade mechanisms for bug fixes
- External security audits before mainnet deployment

### Key Management
- Use Stellar's multi-signature capabilities
- Hardware wallet support for production keys
- Separate keys for different environments

### Network Security
- Use HTTPS for all Horizon API calls
- Validate all transaction signatures
- Implement rate limiting on contract calls

## References
- [Stellar Documentation](https://developers.stellar.org/)
- [Soroban Documentation](https://soroban.stellar.org/docs)
- [Stellar Consensus Protocol](https://www.stellar.org/papers/stellar-consensus-protocol)
- [Soroban by Example](https://soroban.stellar.org/docs/examples)

## Date
2024-10-04

## Authors
ChenAIKit Team
