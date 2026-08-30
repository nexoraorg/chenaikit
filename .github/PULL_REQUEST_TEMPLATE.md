<!--
Keep the `## ` headings below — the "PR Checklist" workflow
(.github/workflows/pr-checklist.yml) validates that Summary, Testing done and
Checklist are present and filled in. Screenshots is additionally required when
the diff touches UI files.

Delete the hint comments as you go; they don't count as content.
-->

## Summary

<!--
What does this change, and why? One or two paragraphs is plenty.
Link the issue this closes, e.g. "Closes #123".
-->

## Testing done

<!--
The commands you actually ran and what you verified. For example:

- `pnpm test:all`
- `cd contracts && cargo test --workspace`
- Manually checked <flow> in the browser

Write "N/A" plus a reason if this genuinely cannot be tested.
-->

## Screenshots

<!--
Required for any UI change (`apps/frontend/**`, `*.tsx`, `*.css`, ...).
Before/after images or a short recording. Otherwise: "N/A — no UI surface".
-->

## Checklist

<!-- See CONTRIBUTING.md. Tick what applies; at least one box must be ticked. -->

- [ ] Branch follows the naming convention (`feat/`, `fix/`, `chore/`, `docs/`, `refactor/`)
- [ ] Commits follow [Conventional Commits](https://www.conventionalcommits.org/) (`type(scope): summary`)
- [ ] The PR is scoped to one domain / one issue, with no unrelated churn
- [ ] All CI checks are green (see the CI requirements in `CONTRIBUTING.md`)
- [ ] Docs updated where behavior changed
- [ ] Screenshots attached for UI changes
