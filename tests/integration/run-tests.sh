#!/bin/bash

# Integration Test Runner Script

set -e

echo "🚀 ChenAIKit Integration Test Suite"
echo "===================================="

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Check if .env exists
if [ ! -f .env ]; then
    echo -e "${YELLOW}⚠️  .env file not found. Copying from .env.example...${NC}"
    cp .env.example .env
fi

# Start Docker services
echo -e "\n${GREEN}📦 Starting Docker services...${NC}"
docker-compose up -d

# Wait for services to be healthy
echo -e "${GREEN}⏳ Waiting for services to be ready...${NC}"
sleep 5

# Check Redis
echo -e "${GREEN}🔍 Checking Redis...${NC}"
docker-compose exec -T redis redis-cli ping || {
    echo -e "${RED}❌ Redis is not responding${NC}"
    exit 1
}

# Check PostgreSQL
echo -e "${GREEN}🔍 Checking PostgreSQL...${NC}"
docker-compose exec -T postgres pg_isready -U chenaikit || {
    echo -e "${RED}❌ PostgreSQL is not responding${NC}"
    exit 1
}

echo -e "${GREEN}✅ All services are ready${NC}"

# Run tests
echo -e "\n${GREEN}🧪 Running integration tests...${NC}"
pnpm test "$@"

TEST_EXIT_CODE=$?

# Cleanup
if [ "$KEEP_SERVICES" != "true" ]; then
    echo -e "\n${GREEN}🧹 Cleaning up Docker services...${NC}"
    docker-compose down
fi

if [ $TEST_EXIT_CODE -eq 0 ]; then
    echo -e "\n${GREEN}✅ All tests passed!${NC}"
else
    echo -e "\n${RED}❌ Some tests failed${NC}"
fi

exit $TEST_EXIT_CODE
