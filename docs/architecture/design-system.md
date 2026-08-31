# Design system

Single source of truth: `apps/frontend/src/design/tokens.ts`.

Any app or surviving `examples/*` project styling chenaikit UI should import
`color`, `spacing`, and `typography` from that file rather than redefining
values locally. This closes the "no coherent design system" gap called out
in issue #286.

## Tokens

| Category   | Examples                                  |
|------------|-------------------------------------------|
| Color      | `background`, `surface`, `primary`, `danger` |
| Spacing    | `xs` (4px) → `xl` (40px)                 |
| Radius     | `sm` (2px), `md` (3px), `pill` (20px), `full` (50%) |
| Motion     | `duration` (fast/base/slow), `easing` (standard/decelerate) |
| Typography | `fontFamily`, `size`, `weight`             |

## Adding a new token

1. Add it to `tokens.ts`, not inline in a component.
2. If it's needed outside `apps/frontend` (e.g. an example app), consider
   promoting the tokens file into `packages/core` so it can be a real shared
   dependency instead of a copy-paste.
