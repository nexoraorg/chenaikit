#!/usr/bin/env bash
# Generates a SHA256SUMS.txt for every file in a given directory.
#
# Usage:
#   scripts/generate-checksums.sh <artifact-dir> [output-file]
#
# Example (frontend build output):
#   scripts/generate-checksums.sh apps/frontend/dist apps/frontend/dist/SHA256SUMS.txt
#
# The output file uses the same format as `sha256sum`, so it can be
# verified with the standard `sha256sum -c` / `shasum -a 256 -c` tools —
# no project-specific tooling required (satisfies the issue's acceptance
# criterion that consumers can verify without project-specific tooling).
#
# Reproducibility: this only hashes file bytes, so the same artifact
# content always produces the same checksum file, regardless of when or
# where it's generated.

set -euo pipefail

ARTIFACT_DIR="${1:?Usage: generate-checksums.sh <artifact-dir> [output-file]}"
OUTPUT_FILE="${2:-${ARTIFACT_DIR%/}/SHA256SUMS.txt}"

if [ ! -d "$ARTIFACT_DIR" ]; then
  echo "error: artifact directory '$ARTIFACT_DIR' does not exist" >&2
  exit 1
fi

HASH_CMD=""
if command -v sha256sum >/dev/null 2>&1; then
  HASH_CMD="sha256sum"
elif command -v shasum >/dev/null 2>&1; then
  HASH_CMD="shasum -a 256"
else
  echo "error: neither sha256sum nor shasum is available on this system" >&2
  exit 1
fi

TMP_OUTPUT="$(mktemp)"
trap 'rm -f "$TMP_OUTPUT"' EXIT

# Walk files in a stable, sorted order so the checksum file itself is
# byte-for-byte reproducible across runs (same file set -> same output).
(
  cd "$ARTIFACT_DIR"
  find . -type f ! -name "$(basename "$OUTPUT_FILE")" -print0 \
    | sort -z \
    | xargs -0 $HASH_CMD
) > "$TMP_OUTPUT"

mv "$TMP_OUTPUT" "$OUTPUT_FILE"

echo "Wrote $(wc -l < "$OUTPUT_FILE" | tr -d ' ') checksum(s) to $OUTPUT_FILE"
