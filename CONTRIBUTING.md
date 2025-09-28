# Contributing to ChenAIKit

Thank you for your interest in contributing to ChenAIKit! This document provides guidelines and information for contributors.

## Getting Started

1. Fork the repository
2. Clone your fork: `git clone https://github.com/your-username/chenaikit.git`
3. Install dependencies: `pnpm install`
4. Create a new branch: `git checkout -b feature/your-feature-name`

## Development Setup

### Prerequisites
- Node.js 18+ 
- pnpm 8+
- Rust (for smart contracts)
- Git

### Install Dependencies
```bash
pnpm install
```

### Build the Project
```bash
pnpm build
```

### Run Tests
```bash
pnpm test
```

### Run Linting
```bash
pnpm lint
```

## Project Structure

- `packages/` - Core SDK and CLI packages
- `contracts/` - Soroban smart contracts
- `examples/` - Sample applications
- `docs/` - Documentation
- `tests/` - Test suites

## Contributing Guidelines

### Code Style
- Use TypeScript for all new code
- Follow the existing code style and patterns
- Add proper type annotations
- Include JSDoc comments for public APIs

### Commit Messages
Use conventional commits format:
- `feat:` for new features
- `fix:` for bug fixes
- `docs:` for documentation changes
- `style:` for formatting changes
- `refactor:` for code refactoring
- `test:` for adding tests
- `chore:` for maintenance tasks

### Pull Requests
1. Ensure all tests pass
2. Add tests for new functionality
3. Update documentation as needed
4. Keep PRs focused and atomic
5. Provide clear description of changes

## Issue Templates

We have issue templates for different areas:
- Frontend development
- Backend development  
- AI/ML development
- Blockchain development

Choose the appropriate template when creating issues.

## Getting Help

- Check existing issues and discussions
- Join our Discord community
- Ask questions in GitHub Discussions

## License

By contributing, you agree that your contributions will be licensed under the MIT License.

