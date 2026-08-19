#!/usr/bin/env bash
#
# Vercel "Ignored Build Step" gate.
#
# Vercel runs this before every build and reads the EXIT CODE:
#   exit 1  -> proceed with the build
#   exit 0  -> cancel the build (ignored)
#
# Policy enforced here:
#   1. Only the `main` branch deploys.
#   2. Only commits authored by `gelluisaac` deploy.
#
# Everything else is cancelled cheaply, before install/build runs.

set -uo pipefail

# Branch Vercel is building. VERCEL_GIT_COMMIT_REF is set by Vercel; fall back
# to git so the script is also runnable locally for debugging.
BRANCH="${VERCEL_GIT_COMMIT_REF:-$(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo unknown)}"

# Commit author. Vercel exposes the GitHub login, which is the value we want to
# match. Fall back to the git author name/email when running outside Vercel.
AUTHOR_LOGIN="${VERCEL_GIT_COMMIT_AUTHOR_LOGIN:-}"
AUTHOR_NAME="${VERCEL_GIT_COMMIT_AUTHOR_NAME:-$(git log -1 --pretty=%an 2>/dev/null || echo '')}"
AUTHOR_EMAIL="$(git log -1 --pretty=%ae 2>/dev/null || echo '')"

ALLOWED_BRANCH="main"
ALLOWED_AUTHOR="gelluisaac"

echo "Deploy gate: branch='${BRANCH}' author_login='${AUTHOR_LOGIN}' author_name='${AUTHOR_NAME}'"

# --- Rule 1: branch must be main -------------------------------------------
if [ "${BRANCH}" != "${ALLOWED_BRANCH}" ]; then
  echo "Cancelled: only '${ALLOWED_BRANCH}' deploys (got '${BRANCH}')."
  exit 0
fi

# --- Rule 2: commit author must be gelluisaac ------------------------------
# Compare case-insensitively across login, name, and email local-part so the
# gate holds whether Vercel supplies the GitHub login or only git metadata.
shopt -s nocasematch
if [[ "${AUTHOR_LOGIN}" == "${ALLOWED_AUTHOR}" ]] \
  || [[ "${AUTHOR_NAME}" == "${ALLOWED_AUTHOR}" ]] \
  || [[ "${AUTHOR_EMAIL}" == "${ALLOWED_AUTHOR}@"* ]] \
  || [[ "${AUTHOR_EMAIL}" == *"+${ALLOWED_AUTHOR}@"* ]]; then
  echo "Proceeding: '${ALLOWED_AUTHOR}' commit on '${ALLOWED_BRANCH}'."
  exit 1
fi
shopt -u nocasematch

echo "Cancelled: commit not authored by '${ALLOWED_AUTHOR}'."
exit 0
