# ADR 001: Monorepo Structure with pnpm Workspaces

## Status
Accepted

## Context
ChenAIKit consists of multiple interconnected packages (core SDK, CLI, backend, frontend, examples) that share code and dependencies. We needed to decide on a repository structure that would:

- Enable code sharing between packages
- Simplify dependency management
- Support independent versioning
- Facilitate coordinated releases
- Improve developer experience

## Decision
We will use a monorepo structure managed by pnpm workspaces.

### Repository Structure
```
chenaikit/
├── packages/
│   ├── core/           # Core TypeScript SDK
│   └── cli/            # CLI tool
├── backend/            # Backend services
├── frontend/           # Frontend applications
├── contracts/          # Soroban smart contracts
├── examples/           # Sample applications
├── docs/               # Documentation
└── tests/              # Shared test utilities
```

### Workspace Configuration
```json
{
  "workspaces": [
    "packages/*",
    "examples/*",
    "tests/*"
  ]
}
```

## Consequences

### Positive
- **Code Sharing**: Packages can easily import from each other using workspace protocol (`workspace:*`)
- **Dependency Management**: Single `pnpm-lock.yaml` ensures consistent versions
- **Atomic Changes**: Changes across multiple packages can be committed together
- **Simplified CI/CD**: Single repository to clone and test
- **Better Refactoring**: IDE support for cross-package refactoring
- **Faster Development**: No need to publish packages locally for testing

### Negative
- **Build Complexity**: Need to manage build order and dependencies
- **Larger Repository**: More code to clone initially
- **CI Time**: All packages tested even if only one changes (mitigated with change detection)
- **Learning Curve**: Developers need to understand workspace concepts

### Neutral
- **Tooling**: Requires pnpm (not npm/yarn) for workspace features
- **Scripts**: Need root-level scripts to coordinate package operations

## Alternatives Considered

### Multi-repo (Separate Repositories)
- **Pros**: Clear boundaries, independent releases, smaller clones
- **Cons**: Difficult code sharing, version management complexity, harder to coordinate changes
- **Rejected**: Too much overhead for our team size and release cadence

### Lerna + npm/yarn
- **Pros**: More mature tooling, wider adoption
- **Cons**: Slower than pnpm, more complex configuration, less efficient disk usage
- **Rejected**: pnpm workspaces are simpler and faster

### Nx Monorepo
- **Pros**: Advanced caching, task orchestration, change detection
- **Cons**: Additional complexity, opinionated structure, learning curve
- **Rejected**: Overkill for our current needs, can migrate later if needed

## Implementation Notes

### Package References
Packages reference each other using workspace protocol:
```json
{
  "dependencies": {
    "@chenaikit/core": "workspace:*"
  }
}
```

### Build Scripts
Root package.json includes coordinated scripts:
```json
{
  "scripts": {
    "build": "pnpm -r build",
    "test": "pnpm -r test",
    "lint": "pnpm -r lint"
  }
}
```

### CI/CD Strategy
- Use pnpm's built-in change detection
- Cache node_modules and build artifacts
- Run tests in parallel where possible

## References
- [pnpm Workspaces Documentation](https://pnpm.io/workspaces)
- [Monorepo Best Practices](https://monorepo.tools/)
- [Why pnpm?](https://pnpm.io/motivation)

## Date
2024-10-04

## Authors
ChenAIKit Team
