# @chenaikit/cli

Command-line interface for ChenAIKit - AI-powered blockchain applications.

## Installation

```bash
npm install -g @chenaikit/cli
# or
pnpm add -g @chenaikit/cli
# or
yarn global add @chenaikit/cli
```

## Usage

```bash
# Get help
chenaikit --help

# Check account balance
chenaikit account balance G...

# Calculate credit score
chenaikit ai credit-score G...

# Detect fraud
chenaikit ai fraud-detect --transaction-id 123

# Generate contract template
chenaikit contract generate credit-score
```

## Commands

- `account` - Account operations
- `ai` - AI model operations
- `contract` - Smart contract operations
- `config` - Configuration management
