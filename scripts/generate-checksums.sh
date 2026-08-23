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
# no project-specific tooling required.
#
# Reproducibility: file order is sorted under the C locale and only file
# byte content is hashed, so identical artifact content always produces
# a byte-for-byte identical checksum file.

set -euo pipefail

ARTIFACT_DIR="${1:?Usage: generate-checksums.sh <artifact-dir> [output-file]}"
OUTPUT_FILE="${2:-${ARTIFACT_DIR%/}/SHA256SUMS.txt}"

if [ ! -d "$ARTIFACT_DIR" ]; then
  echo "error: artifact directory '$ARTIFACT_DIR' does not exist" >&2
  exit 1
fi

# Use an array, not a plain string, so multi-word commands (shasum -a 256)
# survive word-splitting correctly when invoked below (fixes SC2086).
if command -v sha256sum >/dev/null 2>&1; then
  HASH_CMD=(sha256sum)
elif command -v shasum >/dev/null 2>&1; then
  HASH_CMD=(shasum -a 256)
else
  echo "error: neither sha256sum nor shasum is available on this system" >&2
  exit 1
fi

# -P resolves symlinks to their physical path. Without it, ARTIFACT_DIR
# and OUTPUT_FILE reaching the same directory through different symlinks
# would fail to match below, and a later run would hash the existing
# checksum file into itself instead of excluding it.
ARTIFACT_DIR_ABS="$(cd "$ARTIFACT_DIR" && pwd -P)"
mkdir -p "$(dirname "$OUTPUT_FILE")"
OUTPUT_DIR_ABS="$(cd "$(dirname "$OUTPUT_FILE")" && pwd -P)"
OUTPUT_FILE_ABS="$OUTPUT_DIR_ABS/$(basename "$OUTPUT_FILE")"

# Exclude the *exact* output path (relative to the artifact dir), not
# every file anywhere that happens to share its basename.
OUTPUT_REL=""
case "$OUTPUT_FILE_ABS" in
  "$ARTIFACT_DIR_ABS"/*)
    OUTPUT_REL="${OUTPUT_FILE_ABS#"$ARTIFACT_DIR_ABS"/}"
    ;;
esac

# Build the file list FIRST, before any temp file exists on disk — a
# temp file created ahead of time would risk being picked up by `find`
# itself if it landed inside ARTIFACT_DIR_ABS.
FILE_LIST="$(mktemp)"
trap 'rm -f "$FILE_LIST"' EXIT

(
  cd "$ARTIFACT_DIR_ABS"
  if [ -n "$OUTPUT_REL" ]; then
    find . -type f -not -path "./$OUTPUT_REL" -print0
  else
    find . -type f -print0
  fi
) | LC_ALL=C sort -z > "$FILE_LIST"

# Only now create the temp output file, in the same directory as the
# final destination so the closing `mv` is an atomic same-filesystem
# rename rather than a cross-filesystem copy+delete — readers never see
# a partially written checksum file.
TMP_OUTPUT="$(mktemp "$OUTPUT_DIR_ABS/.SHA256SUMS.XXXXXX")"
trap 'rm -f "$FILE_LIST" "$TMP_OUTPUT"' EXIT

if [ ! -s "$FILE_LIST" ]; then
  echo "warning: no files found in '$ARTIFACT_DIR' to checksum" >&2
  : > "$TMP_OUTPUT"
else
  # Guard against xargs invoking the hash command with zero arguments
  # (which would otherwise hash stdin and emit a bogus "-" entry).
  (cd "$ARTIFACT_DIR_ABS" && xargs -0 "${HASH_CMD[@]}" < "$FILE_LIST") > "$TMP_OUTPUT"
fi

mv "$TMP_OUTPUT" "$OUTPUT_FILE_ABS"
trap - EXIT
rm -f "$FILE_LIST"

echo "Wrote $(wc -l < "$OUTPUT_FILE_ABS" | tr -d ' ') checksum(s) to $OUTPUT_FILE_ABS"
