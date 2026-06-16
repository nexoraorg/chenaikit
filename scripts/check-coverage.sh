#!/bin/bash

# Coverage Check Script
# Verifies that test coverage meets minimum thresholds

set -e

echo "📊 Checking test coverage..."

# Run tests with coverage
pnpm test:ci

# Parse coverage summary
COVERAGE_FILE="coverage/coverage-summary.json"

if [ ! -f "$COVERAGE_FILE" ]; then
  echo "❌ Coverage file not found!"
  exit 1
fi

# Extract coverage percentages
LINES=$(cat $COVERAGE_FILE | jq '.total.lines.pct')
STATEMENTS=$(cat $COVERAGE_FILE | jq '.total.statements.pct')
FUNCTIONS=$(cat $COVERAGE_FILE | jq '.total.functions.pct')
BRANCHES=$(cat $COVERAGE_FILE | jq '.total.branches.pct')

# Define thresholds
LINES_THRESHOLD=80
STATEMENTS_THRESHOLD=80
FUNCTIONS_THRESHOLD=70
BRANCHES_THRESHOLD=70

echo ""
echo "Coverage Results:"
echo "  Lines:      ${LINES}% (threshold: ${LINES_THRESHOLD}%)"
echo "  Statements: ${STATEMENTS}% (threshold: ${STATEMENTS_THRESHOLD}%)"
echo "  Functions:  ${FUNCTIONS}% (threshold: ${FUNCTIONS_THRESHOLD}%)"
echo "  Branches:   ${BRANCHES}% (threshold: ${BRANCHES_THRESHOLD}%)"
echo ""

# Check if coverage meets thresholds
FAILED=0

if (( $(echo "$LINES < $LINES_THRESHOLD" | bc -l) )); then
  echo "❌ Lines coverage below threshold"
  FAILED=1
fi

if (( $(echo "$STATEMENTS < $STATEMENTS_THRESHOLD" | bc -l) )); then
  echo "❌ Statements coverage below threshold"
  FAILED=1
fi

if (( $(echo "$FUNCTIONS < $FUNCTIONS_THRESHOLD" | bc -l) )); then
  echo "❌ Functions coverage below threshold"
  FAILED=1
fi

if (( $(echo "$BRANCHES < $BRANCHES_THRESHOLD" | bc -l) )); then
  echo "❌ Branches coverage below threshold"
  FAILED=1
fi

if [ $FAILED -eq 1 ]; then
  echo ""
  echo "❌ Coverage check failed!"
  exit 1
fi

echo "✅ Coverage check passed!"
exit 0
