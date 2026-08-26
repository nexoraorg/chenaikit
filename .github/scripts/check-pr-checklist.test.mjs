/**
 * Unit tests for the PR checklist validator.
 *
 * Run locally with:  node --test .github/scripts/
 * CI runs the same command in .github/workflows/pr-checklist.yml.
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import {
  BYPASS_LABEL,
  checkPullRequest,
  formatReport,
  getBypassReason,
  isUiFile,
  normalizeHeading,
  parseSections,
} from './check-pr-checklist.mjs';

const VALID_BODY = `## Summary

Adds a checklist validation workflow so incomplete PRs are caught early.

Closes #326

## Testing done

- \`node --test .github/scripts/\` — 20 unit tests pass.
- Validated the workflow YAML with \`yaml.safe_load\`.

## Screenshots

N/A — CI-only change, no UI surface.

## Checklist

- [x] Branch follows \`feat/<short-description>\`
- [x] Commits follow Conventional Commits
- [ ] Screenshots attached for UI changes
`;

const missingIds = (result) => result.problems.map((problem) => problem.id);

test('a fully valid body passes', () => {
  const result = checkPullRequest({ body: VALID_BODY });

  assert.equal(result.ok, true);
  assert.equal(result.skipped, false);
  assert.deepEqual(result.problems, []);
  assert.deepEqual(result.satisfied, ['Summary', 'Testing done', 'Checklist']);
});

test('a body missing the Summary section fails and says so', () => {
  const body = VALID_BODY.replace(
    /## Summary[\s\S]*?(?=## Testing done)/,
    '',
  );
  const result = checkPullRequest({ body });

  assert.equal(result.ok, false);
  assert.deepEqual(missingIds(result), ['summary']);
  assert.match(result.problems[0].reason, /missing the "## Summary" section/);
  assert.match(formatReport(result), /Summary/);
});

test('a body missing Testing done fails', () => {
  const body = VALID_BODY.replace(
    /## Testing done[\s\S]*?(?=## Screenshots)/,
    '',
  );
  const result = checkPullRequest({ body });

  assert.equal(result.ok, false);
  assert.deepEqual(missingIds(result), ['testing']);
  assert.match(result.problems[0].reason, /"## Testing done"/);
});

test('an empty body reports every required section', () => {
  const result = checkPullRequest({ body: '' });

  assert.equal(result.ok, false);
  assert.deepEqual(missingIds(result), ['summary', 'testing', 'checklist']);
});

test('a null/undefined body is treated as empty rather than throwing', () => {
  assert.equal(checkPullRequest({ body: null }).ok, false);
  assert.equal(checkPullRequest().ok, false);
});

test('a body that is only the unfilled template fails', () => {
  const body = `## Summary

<!-- What does this change and why? -->

## Testing done

<!-- Commands you ran. -->

## Checklist

- [ ] Branch follows the naming convention
- [ ] Commits follow Conventional Commits
`;
  const result = checkPullRequest({ body });

  assert.equal(result.ok, false);
  assert.deepEqual(missingIds(result), ['summary', 'testing', 'checklist']);
  assert.match(result.problems[0].reason, /is empty/);
  assert.match(result.problems[2].reason, /no ticked/);
});

test('a Checklist with no ticked box fails', () => {
  const body = VALID_BODY.replace('- [x] Branch', '- [ ] Branch').replace(
    '- [x] Commits',
    '- [ ] Commits',
  );
  const result = checkPullRequest({ body });

  assert.equal(result.ok, false);
  assert.deepEqual(missingIds(result), ['checklist']);
});

test('heading aliases and emoji decoration are accepted', () => {
  const body = `### 📌 Summary
Rewrites the retry backoff.

### 🧪 Test plan
\`cargo test --workspace\`

### ✅ Checklist
- [x] CI is green
`;

  assert.equal(checkPullRequest({ body }).ok, true);
});

test('headings inside fenced code blocks are not counted as sections', () => {
  const body = `\`\`\`md
## Summary
## Testing done
## Checklist
- [x] nope
\`\`\`
`;
  const result = checkPullRequest({ body });

  assert.equal(result.ok, false);
  assert.deepEqual(missingIds(result), ['summary', 'testing', 'checklist']);
});

test('Screenshots is required only when the diff touches UI files', () => {
  const body = VALID_BODY.replace(
    /## Screenshots[\s\S]*?(?=## Checklist)/,
    '',
  );

  assert.equal(
    checkPullRequest({ body, changedFiles: ['.github/workflows/ci.yml'] }).ok,
    true,
    'non-UI diff should not require screenshots',
  );

  const uiResult = checkPullRequest({
    body,
    changedFiles: ['apps/frontend/src/App.tsx'],
  });
  assert.equal(uiResult.ok, false);
  assert.deepEqual(missingIds(uiResult), ['screenshots']);
});

test('isUiFile recognises frontend and style paths only', () => {
  assert.equal(isUiFile('apps/frontend/src/main.ts'), true);
  assert.equal(isUiFile('packages/ui/Button.tsx'), true);
  assert.equal(isUiFile('docs/theme.css'), true);
  assert.equal(isUiFile('apps/backend/src/server.ts'), false);
  assert.equal(isUiFile('.github/workflows/pr-checklist.yml'), false);
});

test('the bypass label skips validation even for an empty body', () => {
  const result = checkPullRequest({ body: '', labels: [BYPASS_LABEL] });

  assert.equal(result.ok, true);
  assert.equal(result.skipped, true);
  assert.match(result.skipReason, /skip-checklist/);
  assert.match(formatReport(result), /^## PR checklist\n\nSkipped —/);
});

test('the bypass label is matched case-insensitively and as a label object', () => {
  assert.equal(
    checkPullRequest({ body: '', labels: [{ name: 'Skip-Checklist' }] }).skipped,
    true,
  );
});

test('bot authors are exempt', () => {
  for (const author of [
    'dependabot[bot]',
    'github-actions[bot]',
    'renovate[bot]',
    'some-other-app[bot]',
  ]) {
    const result = checkPullRequest({ body: '', author });
    assert.equal(result.skipped, true, `${author} should be exempt`);
    assert.match(result.skipReason, /automation account/);
  }
});

test('a human author with an unrelated label is not exempt', () => {
  assert.equal(getBypassReason({ author: 'octocat', labels: ['bug'] }), null);
  assert.equal(getBypassReason(), null);
  assert.equal(checkPullRequest({ body: '', author: 'octocat' }).skipped, false);
});

test('the failure report names every missing section and the bypass label', () => {
  const report = formatReport(checkPullRequest({ body: '' }));

  assert.match(report, /missing 3 required items/);
  assert.match(report, /\*\*Summary\*\*/);
  assert.match(report, /\*\*Testing done\*\*/);
  assert.match(report, /\*\*Checklist\*\*/);
  assert.match(report, /PULL_REQUEST_TEMPLATE\.md/);
  assert.match(report, new RegExp(BYPASS_LABEL));
});

test('the success report lists the satisfied sections', () => {
  const report = formatReport(checkPullRequest({ body: VALID_BODY }));

  assert.match(report, /All required sections are present/);
  assert.match(report, /`Testing done`/);
});

test('normalizeHeading strips emoji, formatting and punctuation', () => {
  assert.equal(normalizeHeading('## 🧪 **Testing done**:'), 'testing done');
  assert.equal(normalizeHeading('`Checklist`'), 'checklist');
  assert.equal(normalizeHeading('Screenshots / recordings'), 'screenshots recordings');
});

test('parseSections captures heading text and content, ignoring comments', () => {
  const sections = parseSections(
    '## Summary\n<!-- hint -->\nreal content\n\n## Testing done\n`npm test`\n',
  );

  assert.equal(sections.length, 2);
  assert.equal(sections[0].heading, 'Summary');
  assert.equal(sections[0].level, 2);
  assert.equal(sections[0].content, 'real content');
  assert.equal(sections[1].content, '`npm test`');
});

test('CRLF bodies are handled', () => {
  const result = checkPullRequest({ body: VALID_BODY.replace(/\n/g, '\r\n') });
  assert.equal(result.ok, true);
});
