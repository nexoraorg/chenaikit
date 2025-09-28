# ChenAIKit Backend

Backend services and APIs for ChenAIKit.

## Features

- REST API endpoints
- Authentication and authorization
- Database integration
- Caching layer
- Webhook system
- Monitoring and logging

## Quick Start

```bash
# Install dependencies
pnpm install

# Start development server
pnpm dev

# Build for production
pnpm build

# Run tests
pnpm test
```

## API Endpoints

- `GET /api/health` - Health check
- `GET /api/accounts/:id` - Get account information
- `POST /api/accounts` - Create new account
- `GET /api/accounts/:id/credit-score` - Get credit score
- `POST /api/fraud/detect` - Detect fraud

## Environment Variables

```env
PORT=3000
NODE_ENV=development
DATABASE_URL=postgresql://...
REDIS_URL=redis://...
AI_API_KEY=your_ai_api_key
```
