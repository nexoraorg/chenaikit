#!/bin/bash

# Test Setup Script
# This script sets up the testing environment

set -e

echo "🧪 Setting up test environment..."

# Install dependencies
echo "📦 Installing dependencies..."
pnpm install

# Setup Husky hooks
echo "🪝 Setting up Git hooks..."
pnpm prepare

# Create test databases
echo "🗄️  Setting up test databases..."
cd backend
if [ -f "prisma/schema.prisma" ]; then
  echo "Running Prisma migrations for test database..."
  DATABASE_URL="file:./test.db" npx prisma migrate deploy
fi
cd ..

# Run initial test to verify setup
echo "✅ Running initial test suite..."
pnpm test:ci

echo ""
echo "✨ Test environment setup complete!"
echo ""
echo "Available test commands:"
echo "  pnpm test              - Run all tests with coverage"
echo "  pnpm test:watch        - Run tests in watch mode"
echo "  pnpm test:core         - Run core package tests"
echo "  pnpm test:cli          - Run CLI tests"
echo "  pnpm test:backend      - Run backend tests"
echo "  pnpm test:frontend     - Run frontend tests"
echo "  pnpm test:integration  - Run integration tests"
echo "  pnpm coverage          - Generate and open coverage report"
echo ""
