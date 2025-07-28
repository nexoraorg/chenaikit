#!/bin/bash

# Test runner script for Skillsig backend

set -e

echo "🧪 Running Skillsig Backend Tests"
echo "================================="

# Check if required environment variables are set
if [ -z "$TEST_DATABASE_URL" ]; then
    echo "⚠️  TEST_DATABASE_URL not set, using default"
    export TEST_DATABASE_URL="postgres://test:test@localhost/skillsig_test"
fi

if [ -z "$TEST_REDIS_URL" ]; then
    echo "⚠️  TEST_REDIS_URL not set, using default"
    export TEST_REDIS_URL="redis://localhost:6379/1"
fi

echo "📊 Database: $TEST_DATABASE_URL"
echo "🔴 Redis: $TEST_REDIS_URL"
echo ""

# Run different test categories
echo "🔧 Running unit tests..."
cargo test --lib tests::progress_tests -- --nocapture

echo ""
echo "🌲 Running skill tree tests..."
cargo test --lib tests::skill_tree_tests -- --nocapture

echo ""
echo "💾 Running cache tests..."
cargo test --lib tests::cache_tests -- --nocapture

echo ""
echo "🔗 Running integration tests..."
cargo test --lib tests::integration_tests -- --nocapture

echo ""
echo "🚀 Running all tests..."
cargo test -- --nocapture

echo ""
echo "✅ All tests completed!"
echo ""
echo "📈 Test Coverage Report:"
echo "========================"
echo "To generate coverage report, run:"
echo "cargo tarpaulin --out Html --output-dir coverage"
echo ""
echo "🔍 Performance Tests:"
echo "====================="
echo "To run performance tests, run:"
echo "cargo test --release -- --nocapture performance"
echo ""
echo "🎯 Next Steps:"
echo "=============="
echo "1. Set up CI/CD pipeline with these tests"
echo "2. Add performance benchmarks"
echo "3. Set up test database seeding"
echo "4. Add end-to-end tests with real blockchain interaction"
