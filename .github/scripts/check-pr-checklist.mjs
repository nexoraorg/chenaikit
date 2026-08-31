#!/usr/bin/env node
/**
 * Contributor pull request checklist validation.
 *
 * The interesting part of this file is pure: `checkPullRequest()` takes a PR
 * body (plus, optionally, the list of changed files, the author and the
 * labels) and returns which required sections are missing. That keeps it
 * unit-testable without GitHub in the loop — see `check-pr-checklist.test.mjs`.
 *
 * The CLI wrapper at the bottom only reads the webhook payload GitHub already
 * wrote to disk (`GITHUB_EVENT_PATH`). It needs no token and no secrets.
 */

import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

/** Sections every pull request must fill in. */
export const REQUIRED_SECTIONS = [
  {
    id: 'summary',
    title: 'Summary',
    aliases: ['summary', 'overview', 'what changed', 'description'],
    hint: 'Describe what this PR changes and why.',
  },
  {
    id: 'testing',
    title: 'Testing done',
    aliases: [
      'testing done',
      'testing',
      'tests',
      'how has this been tested',
      'test plan',
    ],
    hint: 'List the commands you ran (e.g. `pnpm test:all`) and what you verified.',
  },
  {
    id: 'checklist',
    title: 'Checklist',
    aliases: ['checklist'],
    requiresTickedBox: true,
    hint: 'Tick the boxes you satisfied (branch naming, conventional commits, green CI).',
  },
];

/** Sections only required when the diff touches user-facing code. */
export const CONDITIONAL_SECTIONS = [
  {
    id: 'screenshots',
    title: 'Screenshots',
    aliases: [
      'screenshots',
      'screenshots for ui changes',
      'screenshots recordings',
      'screenshots or recordings',
    ],
    hint: 'This PR touches UI files — attach a screenshot/recording, or write "N/A" with a reason.',
    requiredWhen: (changedFiles) => changedFiles.some(isUiFile),
  },
];

/** Maintainer-applied label that skips the whole check. */
export const BYPASS_LABEL = 'skip-checklist';

/** Automation accounts whose PRs never carry a hand-written template. */
export const BOT_AUTHORS = [
  'dependabot[bot]',
  'github-actions[bot]',
  'renovate[bot]',
  'pre-commit-ci[bot]',
];

const UI_FILE_RE = /(^apps\/frontend\/)|(\.(tsx|jsx|css|scss|svg)$)/i;

/** True when a changed path is user-facing enough to warrant a screenshot. */
export function isUiFile(filePath) {
  return UI_FILE_RE.test(String(filePath).trim());
}

/**
 * Collapse a markdown heading down to comparable text: drop emoji, inline
 * code, bold/italic markers and punctuation, then lowercase.
 */
export function normalizeHeading(text) {
  return String(text)
    .replace(/`([^`]*)`/g, '$1')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/[^\p{L}\p{N}\s]+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

/** Strip HTML comments — that is how the template carries its hints. */
function stripComments(body) {
  return String(body).replace(/<!--[\s\S]*?-->/g, '');
}

/**
 * Split a PR body into `{ heading, normalized, level, content }` sections.
 * Fenced code blocks are skipped so a `# comment` inside a snippet is not
 * mistaken for a heading.
 */
export function parseSections(body) {
  const lines = stripComments(body ?? '')
    .replace(/\r\n?/g, '\n')
    .split('\n');

  const sections = [];
  let current = null;
  let inFence = false;

  for (const line of lines) {
    if (/^\s{0,3}(```|~~~)/.test(line)) inFence = !inFence;

    const heading = inFence ? null : line.match(/^\s{0,3}(#{1,6})\s+(.+?)\s*#*\s*$/);
    if (heading) {
      current = {
        heading: heading[2].trim(),
        normalized: normalizeHeading(heading[2]),
        level: heading[1].length,
        lines: [],
      };
      sections.push(current);
      continue;
    }

    if (current) current.lines.push(line);
  }

  return sections.map(({ lines: sectionLines, ...rest }) => ({
    ...rest,
    content: sectionLines.join('\n').trim(),
  }));
}

/** A section counts as unfilled if only blanks/empty checkboxes remain. */
function isBlank(content) {
  return (
    String(content)
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line.length > 0)
      .filter((line) => !/^[-*]?\s*\[[ xX]\]\s*$/.test(line))
      .filter((line) => !/^[-*_\s]{3,}$/.test(line))
      .join('')
      .trim().length === 0
  );
}

/** At least one `- [x]` in the section. */
function hasTickedBox(content) {
  return /^\s*[-*]?\s*\[[xX]\]\s+\S/m.test(String(content));
}

function findSection(sections, spec) {
  const aliases = spec.aliases.map(normalizeHeading);
  return sections.find(
    (section) =>
      aliases.includes(section.normalized) ||
      aliases.some(
        (alias) =>
          section.normalized.startsWith(`${alias} `) ||
          section.normalized.endsWith(` ${alias}`),
      ),
  );
}

/**
 * Reason this PR is exempt from the check, or `null` if it must be validated.
 * Bypass paths: a maintainer-applied `skip-checklist` label, or a bot author.
 */
export function getBypassReason({ author = '', labels = [] } = {}) {
  const normalizedLabels = labels
    .map((label) => (typeof label === 'string' ? label : label?.name ?? ''))
    .map((name) => String(name).trim().toLowerCase());

  if (normalizedLabels.includes(BYPASS_LABEL)) {
    return `the "${BYPASS_LABEL}" label is applied`;
  }

  const login = String(author).trim().toLowerCase();
  if (login && (BOT_AUTHORS.includes(login) || login.endsWith('[bot]'))) {
    return `the author "${author}" is an automation account`;
  }

  return null;
}

/**
 * Validate a pull request body against the template.
 *
 * @param {object} input
 * @param {string} input.body           PR description.
 * @param {string[]} [input.changedFiles] Paths changed by the PR.
 * @param {string} [input.author]       PR author login.
 * @param {Array}  [input.labels]       Label names (or label objects).
 * @returns {{ok: boolean, skipped: boolean, skipReason: (string|null),
 *            problems: Array<{id: string, title: string, reason: string, hint: string}>,
 *            satisfied: string[]}}
 */
export function checkPullRequest({
  body = '',
  changedFiles = [],
  author = '',
  labels = [],
} = {}) {
  const skipReason = getBypassReason({ author, labels });
  if (skipReason) {
    return { ok: true, skipped: true, skipReason, problems: [], satisfied: [] };
  }

  const sections = parseSections(body);
  const files = (changedFiles ?? []).map(String).filter(Boolean);

  const specs = [
    ...REQUIRED_SECTIONS,
    ...CONDITIONAL_SECTIONS.filter((spec) => spec.requiredWhen(files)),
  ];

  const problems = [];
  const satisfied = [];

  for (const spec of specs) {
    const section = findSection(sections, spec);

    if (!section) {
      problems.push({
        id: spec.id,
        title: spec.title,
        reason: `missing the "## ${spec.title}" section`,
        hint: spec.hint,
      });
      continue;
    }

    if (isBlank(section.content)) {
      problems.push({
        id: spec.id,
        title: spec.title,
        reason: `the "## ${spec.title}" section is empty`,
        hint: spec.hint,
      });
      continue;
    }

    if (spec.requiresTickedBox && !hasTickedBox(section.content)) {
      problems.push({
        id: spec.id,
        title: spec.title,
        reason: `the "## ${spec.title}" section has no ticked "- [x]" item`,
        hint: spec.hint,
      });
      continue;
    }

    satisfied.push(spec.title);
  }

  return {
    ok: problems.length === 0,
    skipped: false,
    skipReason: null,
    problems,
    satisfied,
  };
}

/** Human-readable markdown report for the job summary / logs. */
export function formatReport(result) {
  if (result.skipped) {
    return `## PR checklist\n\nSkipped — ${result.skipReason}.`;
  }

  if (result.ok) {
    const list = result.satisfied.map((title) => `- \`${title}\``).join('\n');
    return `## PR checklist\n\nAll required sections are present:\n\n${list}`;
  }

  const list = result.problems
    .map((problem) => `- **${problem.title}** — ${problem.reason}.\n  ${problem.hint}`)
    .join('\n');

  return [
    '## PR checklist',
    '',
    `This pull request is ${result.problems.length === 1 ? 'missing 1 required item' : `missing ${result.problems.length} required items`}:`,
    '',
    list,
    '',
    'Copy the structure from `.github/PULL_REQUEST_TEMPLATE.md` into the PR',
    'description and fill it in — the check re-runs automatically on edit.',
    '',
    `Maintainers can bypass this with the \`${BYPASS_LABEL}\` label.`,
  ].join('\n');
}

/* ------------------------------------------------------------------------ *
 * CLI: reads only the webhook payload GitHub wrote to disk. No token, no
 * secrets, no network.
 * ------------------------------------------------------------------------ */

function readChangedFiles() {
  const raw = process.env.CHANGED_FILES ?? '';
  return raw
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);
}

function readEvent() {
  const eventPath = process.env.GITHUB_EVENT_PATH;
  if (!eventPath || !fs.existsSync(eventPath)) return null;
  return JSON.parse(fs.readFileSync(eventPath, 'utf8'));
}

export function main() {
  const event = readEvent();
  const pr = event?.pull_request;

  if (!pr) {
    console.log('No pull_request payload found — nothing to validate.');
    return 0;
  }

  const result = checkPullRequest({
    body: pr.body ?? '',
    changedFiles: readChangedFiles(),
    author: pr.user?.login ?? '',
    labels: pr.labels ?? [],
  });

  const report = formatReport(result);
  console.log(report);

  if (process.env.GITHUB_STEP_SUMMARY) {
    fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, `${report}\n`);
  }

  if (result.skipped || result.ok) return 0;

  for (const problem of result.problems) {
    console.log(`::error title=PR checklist::${problem.reason}. ${problem.hint}`);
  }

  return 1;
}

const invokedDirectly =
  process.argv[1] &&
  import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;

if (invokedDirectly) {
  process.exitCode = main();
}
