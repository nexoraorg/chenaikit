# =============================================================================
# Build context: monorepo ROOT  (docker build -f backend/Dockerfile .)
# =============================================================================

# ─────────────────────────────────────────────────────────────────────────────
# Stage 1 – deps: install all workspace dependencies (cached layer)
# ─────────────────────────────────────────────────────────────────────────────
FROM node:20-alpine AS deps

# Native module compilation tools (required by better-sqlite3 & bcrypt)
RUN apk add --no-cache python3 make g++

RUN corepack enable && corepack prepare pnpm@10.17.1 --activate

WORKDIR /app

# Copy only manifests first – changes here bust the cache, not source changes
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY tsconfig.base.json ./
COPY packages/core/package.json ./packages/core/
COPY backend/package.json ./backend/

RUN pnpm install --frozen-lockfile

# ─────────────────────────────────────────────────────────────────────────────
# Stage 2 – builder: compile TypeScript, generate Prisma client
# ─────────────────────────────────────────────────────────────────────────────
FROM node:20-alpine AS builder

RUN apk add --no-cache python3 make g++
RUN corepack enable && corepack prepare pnpm@10.17.1 --activate

WORKDIR /app

# Restore installed deps from previous stage
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/packages/core/node_modules ./packages/core/node_modules

# Copy workspace configuration
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY tsconfig.base.json ./

# Copy source packages
COPY packages/core ./packages/core
COPY backend ./backend

# 1. Build @chenaikit/core (backend depends on its dist/)
RUN pnpm --filter @chenaikit/core build

# 2. Generate Prisma client + compile backend TypeScript → dist/
RUN pnpm --filter @chenaikit/backend build

# 3. Create a self-contained deployment bundle (resolves workspace: deps,
#    production-only node_modules, no symlinks)
RUN pnpm --filter @chenaikit/backend deploy --prod /standalone

# Copy compiled output into the standalone bundle
#   (pnpm deploy copies package source but dist/ is generated, so copy explicitly)
RUN cp -r /app/backend/dist /standalone/dist

# Copy Prisma schema + migrations into the bundle
RUN cp -r /app/backend/prisma /standalone/prisma

# ─────────────────────────────────────────────────────────────────────────────
# Stage 3 – production: minimal runtime image
# ─────────────────────────────────────────────────────────────────────────────
FROM node:20-alpine AS production

# tini: proper PID 1 signal handling / zombie reaping
RUN apk add --no-cache tini

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000

# Non-root user for security
RUN addgroup -g 1001 -S nodejs && \
    adduser  -S backend -u 1001 -G nodejs

# Copy standalone bundle (node_modules + package.json + dist + prisma)
COPY --from=builder --chown=backend:nodejs /standalone ./

# Persistent data directory for SQLite database
RUN mkdir -p /data && chown backend:nodejs /data

USER backend

EXPOSE 3000

# Healthcheck: polls /api/health every 30 s, fails after 3 consecutive misses
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD node -e "\
const h=require('http');\
h.get('http://localhost:'+process.env.PORT+'/api/health',r=>{\
  process.exit(r.statusCode===200?0:1)\
}).on('error',()=>process.exit(1))"

ENTRYPOINT ["/sbin/tini", "--"]
CMD ["node", "dist/index.js"]
