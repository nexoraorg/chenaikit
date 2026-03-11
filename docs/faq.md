# Frequently Asked Questions (FAQ)

Common questions about ChenAIKit.

## General Questions

### What is ChenAIKit?

ChenAIKit is a TypeScript toolkit for building AI-powered blockchain applications. It provides ready-to-use integrations for credit scoring, fraud detection, and smart decisioning on the Stellar blockchain.

### Who is ChenAIKit for?

- **Developers** building fintech applications
- **Blockchain projects** needing AI capabilities
- **Financial institutions** exploring blockchain + AI
- **Startups** building credit/lending platforms
- **Researchers** studying blockchain and AI integration

### Is ChenAIKit free?

Yes, ChenAIKit is open source under the MIT License. You can use it freely in commercial and non-commercial projects.

### What blockchain does ChenAIKit support?

Currently, ChenAIKit supports Stellar and Soroban smart contracts. We plan to add support for additional blockchains in the future.

---

## Technical Questions

### What are the system requirements?

- **Node.js**: 18.0.0 or higher
- **pnpm**: 8.0.0 or higher
- **Rust**: 1.70+ (for smart contracts)
- **PostgreSQL**: 13+ (for backend)
- **Redis**: 6+ (for caching)

### Can I use ChenAIKit in the browser?

Yes! The core SDK (`@chenaikit/core`) works in both Node.js and browser environments. Some features like file system operations are Node.js only.

### Does ChenAIKit work with TypeScript?

Absolutely! ChenAIKit is written in TypeScript and provides full type definitions for excellent IDE support and type safety.

### Can I use ChenAIKit with JavaScript?

Yes, you can use ChenAIKit with plain JavaScript. The TypeScript types are optional but recommended for better developer experience.

### What databases are supported?

The backend uses Prisma ORM, which supports:
- PostgreSQL (recommended)
- MySQL
- SQLite (development only)
- SQL Server
- MongoDB (preview)

### Do I need to run my own Stellar node?

No, you can use public Horizon servers:
- Testnet: `https://horizon-testnet.stellar.org`
- Mainnet: `https://horizon.stellar.org`

For production applications with high volume, consider running your own Horizon instance.

---

## Credit Scoring Questions

### How is the credit score calculated?

The credit score (0-1000) is calculated using AI models that analyze:
- Account age and history
- Transaction patterns and frequency
- Balance stability
- Network activity and reputation
- Asset diversity
- Payment history

### Can I customize the credit scoring algorithm?

Yes! You can:
1. Adjust scoring weights in the AI service configuration
2. Add custom factors to the scoring model
3. Train your own models using the provided framework
4. Integrate external data sources

### How accurate is the credit scoring?

Accuracy depends on the data quality and model training. Our default models achieve:
- 85-90% accuracy on testnet data
- Continuous improvement through feedback loops
- Regular model updates and retraining

### Can I use credit scores for lending decisions?

Credit scores are informational tools. For lending decisions:
- Combine with traditional credit checks
- Consider regulatory requirements
- Implement proper risk management
- Consult legal and compliance teams

---

## Fraud Detection Questions

### What types of fraud can ChenAIKit detect?

- **Transaction fraud**: Unusual transaction patterns
- **Account takeover**: Suspicious account activity
- **Money laundering**: Rapid movement of funds
- **Wash trading**: Artificial volume creation
- **Phishing**: Suspicious address patterns

### How does fraud detection work?

Fraud detection uses:
1. **Pattern recognition**: Identifies unusual behavior
2. **Anomaly detection**: Flags statistical outliers
3. **Risk scoring**: Assigns risk levels (0-100)
4. **Machine learning**: Learns from historical data

### What is the false positive rate?

Default configuration:
- False positive rate: ~5-10%
- Adjustable through threshold tuning
- Improves with more training data

### Can I train custom fraud models?

Yes! The fraud detection system supports:
- Custom training data
- Adjustable thresholds
- Feature engineering
- Model fine-tuning

---

## Smart Contract Questions

### What programming language are contracts written in?

Soroban smart contracts are written in Rust, which provides:
- Memory safety
- High performance
- Strong type system
- Excellent tooling

### Do I need to know Rust to use ChenAIKit?

No! You can use the pre-built contracts and interact with them through the TypeScript SDK. Rust knowledge is only needed if you want to modify or create new contracts.

### How much does it cost to deploy a contract?

On Stellar:
- **Testnet**: Free (use testnet XLM)
- **Mainnet**: ~0.1-1 XLM (~$0.01-0.10 USD)

Costs vary based on contract size and network fees.

### Can contracts be upgraded?

Yes! Our contracts include upgrade functionality:
- Admin-controlled upgrades
- Version tracking
- Data migration support
- Rollback capabilities

### Are the contracts audited?

Yes, our contracts have undergone security audits. See [audit-report.md](../contracts/audit-report.md) for details.

---

## API Questions

### Is there a rate limit on the API?

Yes, rate limits depend on your tier:
- **Free**: 100 requests/hour
- **Basic**: 1,000 requests/hour
- **Pro**: 10,000 requests/hour
- **Enterprise**: Custom limits

### How do I get an API key?

```bash
# Using CLI
npx @chenaikit/cli auth login
npx @chenaikit/cli keys create --name "My App"

# Or via backend API
POST /api/v1/keys
{
  "name": "My App",
  "tier": "basic"
}
```

### What authentication methods are supported?

- **API Keys**: For server-to-server communication
- **JWT Tokens**: For user authentication
- **OAuth 2.0**: Coming soon

### Can I use the API from the frontend?

For security, API keys should only be used server-side. For frontend applications:
1. Use JWT authentication
2. Proxy requests through your backend
3. Implement proper CORS configuration

---

## Deployment Questions

### How do I deploy to production?

See our [deployment guide](./tutorials/deploying-contracts.md) for detailed instructions.

Quick overview:
1. Build all packages: `pnpm build`
2. Deploy contracts to mainnet
3. Configure production environment variables
4. Deploy backend to your hosting provider
5. Deploy frontend to CDN/hosting

### What hosting providers are recommended?

**Backend:**
- Vercel
- Railway
- Heroku
- AWS/GCP/Azure
- DigitalOcean

**Frontend:**
- Vercel
- Netlify
- Cloudflare Pages
- AWS S3 + CloudFront

**Database:**
- Supabase
- PlanetScale
- AWS RDS
- Heroku Postgres

### How do I handle environment variables in production?

```bash
# Use your hosting provider's environment variable management
# Never commit .env files to git

# Required variables:
DATABASE_URL=postgresql://...
REDIS_URL=redis://...
ACCESS_TOKEN_SECRET=...
REFRESH_TOKEN_SECRET=...
AI_API_KEY=...
STELLAR_NETWORK=mainnet
```

### What about scaling?

ChenAIKit is designed to scale:
- **Horizontal scaling**: Add more backend instances
- **Caching**: Redis for frequently accessed data
- **Database**: Connection pooling and read replicas
- **CDN**: Serve frontend assets from CDN
- **Load balancing**: Distribute traffic across instances

---

## Development Questions

### How do I contribute to ChenAIKit?

See [CONTRIBUTING.md](../CONTRIBUTING.md) for guidelines.

Quick start:
1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests
5. Submit a pull request

### How do I report a bug?

[Create an issue](https://github.com/nexoraorg/chenaikit/issues/new) with:
- Clear description
- Steps to reproduce
- Expected vs actual behavior
- Environment details
- Error messages/logs

### How do I request a feature?

[Open a feature request](https://github.com/nexoraorg/chenaikit/issues/new?template=feature_request.md) describing:
- Use case
- Proposed solution
- Alternatives considered
- Additional context

### Where can I get help?

- **Documentation**: [docs/](./getting-started.md)
- **Discord**: [Join our server](https://discord.gg/chenaikit)
- **GitHub Discussions**: [Ask questions](https://github.com/nexoraorg/chenaikit/discussions)
- **Email**: support@chenaikit.com

---

## Integration Questions

### Can I integrate ChenAIKit with my existing app?

Yes! ChenAIKit is designed to be modular:
- Use only the features you need
- Integrate with existing authentication
- Connect to your database
- Customize the UI components

### Does ChenAIKit work with React?

Yes! We provide React components and hooks:
```typescript
import { useCreditScore, useTransactionMonitor } from '@chenaikit/frontend';

function MyComponent() {
  const { score, loading } = useCreditScore(accountId);
  return <div>Score: {score}</div>;
}
```

### Can I use ChenAIKit with Vue or Angular?

The core SDK works with any framework. We provide React components, but you can:
- Use the core SDK directly
- Build your own components
- Contribute framework-specific packages

### How do I integrate with my backend?

```typescript
// Express.js example
import { StellarConnector, AIService } from '@chenaikit/core';

app.get('/api/credit-score/:accountId', async (req, res) => {
  const stellar = new StellarConnector({ network: 'mainnet' });
  const ai = new AIService({ apiKey: process.env.AI_API_KEY });
  
  const account = await stellar.getAccount(req.params.accountId);
  const score = await ai.calculateCreditScore(account);
  
  res.json({ score });
});
```

---

## Pricing Questions

### Is there a cost to use ChenAIKit?

- **Open Source SDK**: Free (MIT License)
- **AI Services**: Tiered pricing based on usage
- **Blockchain Fees**: Stellar network fees (~$0.00001 per transaction)
- **Infrastructure**: Your hosting costs

### What are the AI service pricing tiers?

- **Free**: 100 API calls/month
- **Basic**: $29/month - 10,000 calls
- **Pro**: $99/month - 100,000 calls
- **Enterprise**: Custom pricing

### Can I self-host everything?

Yes! You can:
- Run your own backend
- Host your own AI models
- Use public Stellar infrastructure
- Deploy contracts yourself

This eliminates recurring costs but requires more technical expertise.

---

## Security Questions

### Is ChenAIKit secure?

We follow security best practices:
- Regular security audits
- Dependency vulnerability scanning
- Secure coding guidelines
- Encryption for sensitive data
- Rate limiting and DDoS protection

See [security-guidelines.md](./security-guidelines.md) for details.

### How are API keys stored?

- Hashed using bcrypt
- Never logged or exposed
- Transmitted over HTTPS only
- Rotatable at any time

### What about private keys?

ChenAIKit never stores or transmits private keys. Users maintain control of their keys through:
- Hardware wallets
- Secure key management
- Multi-signature accounts

### Is my data encrypted?

- **In transit**: TLS/HTTPS encryption
- **At rest**: Database encryption (optional)
- **Sensitive fields**: Application-level encryption
- **Backups**: Encrypted backups

---

## Performance Questions

### How fast are credit score calculations?

- **Average**: 200-500ms
- **With caching**: 10-50ms
- **Batch processing**: 100+ scores/second

### What's the transaction monitoring latency?

- **WebSocket streaming**: <100ms from blockchain
- **Processing**: 10-50ms per transaction
- **Alert delivery**: <1 second

### Can ChenAIKit handle high volume?

Yes! Designed for scale:
- Batch processing support
- Efficient caching
- Horizontal scaling
- Connection pooling

Tested with:
- 1000+ transactions/second
- 10,000+ concurrent users
- Millions of records

---

## Troubleshooting Questions

### Why is my installation failing?

See [Troubleshooting Guide](./troubleshooting.md#installation-issues) for common solutions.

### Why can't I connect to Stellar?

Check:
1. Network configuration (testnet vs mainnet)
2. Horizon URL is correct
3. Account exists and is funded
4. Internet connection is stable

### Why are my tests failing?

Common causes:
1. Missing environment variables
2. Database not running
3. Redis not running
4. Outdated dependencies

Run: `pnpm install && pnpm -r build`

---

## Roadmap Questions

### What features are planned?

See our [GitHub Projects](https://github.com/nexoraorg/chenaikit/projects) for the roadmap.

Upcoming features:
- Multi-chain support (Ethereum, Polygon)
- Advanced ML models
- Mobile SDKs
- GraphQL API
- Real-time dashboards

### When will feature X be released?

Check the [roadmap](https://github.com/nexoraorg/chenaikit/projects) for estimated timelines. Dates are subject to change based on priorities and resources.

### Can I sponsor a feature?

Yes! Contact us at partnerships@chenaikit.com to discuss:
- Feature sponsorship
- Custom development
- Enterprise support
- Training and consulting

---

## Still Have Questions?

- 📖 [Read the docs](./getting-started.md)
- 💬 [Join Discord](https://discord.gg/chenaikit)
- 🐛 [Report issues](https://github.com/nexoraorg/chenaikit/issues)
- 📧 [Email us](mailto:support@chenaikit.com)
