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

## HTTP Compression

Responses negotiate Brotli or gzip using Accept-Encoding. Small payloads and already-compressed content types are skipped. Express ETags remain based on the original response and Vary: Accept-Encoding keeps shared caches safe.

JSON requests may use Content-Encoding: gzip, deflate, or br. Invalid or unsupported bodies receive a structured 400 or 415 response. Configure behavior with COMPRESSION_ENABLED, COMPRESSION_LEVEL (-1 to 9), COMPRESSION_BROTLI_QUALITY (0 to 11), COMPRESSION_THRESHOLD (bytes, kb, or mb), and COMPRESSION_EXCLUDED_TYPES. Routes can use configureRouteCompression({ enabled, threshold }). Runtime totals and estimated byte savings are available from compressionStatistics.snapshot().
