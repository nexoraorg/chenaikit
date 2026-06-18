#!/usr/bin/env bash
#
# rollback.sh - Roll the ChenAIKit backend back to its previous deployed image.
#
# Reads the deployment state written by deploy.sh and redeploys the previously
# running image for the given environment, then verifies health and notifies.
#
# Usage:
#   ./rollback.sh <environment> [target-image]
#
#   environment    One of: dev | staging | prod                 (required)
#   target-image   Explicit image (name:tag) to roll back to.   (optional)
#                  Defaults to PREVIOUS_IMAGE from the saved state.
#
# Honors the same environment variables as deploy.sh (DEPLOY_HOST, PORT,
# HEALTHCHECK_URL, SLACK_WEBHOOK_URL, ...).
#
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
STATE_DIR="${SCRIPT_DIR}/.deploy-state"

ENVIRONMENT="${1:-}"
TARGET_IMAGE="${2:-}"
PORT="${PORT:-3000}"
HEALTHCHECK_URL="${HEALTHCHECK_URL:-http://localhost:${PORT}/api/health}"

log()  { printf '\033[0;32m[rollback]\033[0m %s\n' "$*"; }
warn() { printf '\033[0;33m[rollback]\033[0m %s\n' "$*" >&2; }
fail() { printf '\033[0;31m[rollback] ERROR:\033[0m %s\n' "$*" >&2; exit 1; }

notify() {
  local status="$1" message="$2"
  log "${status}: ${message}"
  if [[ -n "${SLACK_WEBHOOK_URL:-}" ]]; then
    local emoji=":leftwards_arrow_with_hook:"
    [[ "${status}" == "FAILED" ]] && emoji=":x:"
    curl -fsS -X POST -H 'Content-type: application/json' \
      --data "{\"text\":\"${emoji} *ChenAIKit backend rollback* [${ENVIRONMENT}] ${status}: ${message}\"}" \
      "${SLACK_WEBHOOK_URL}" >/dev/null 2>&1 || warn "Slack notification failed"
  fi
}

remote() {
  if [[ -n "${DEPLOY_HOST:-}" ]]; then
    ssh "${DEPLOY_HOST}" "$@"
  else
    bash -c "$*"
  fi
}

case "${ENVIRONMENT}" in
  dev|staging|prod) ;;
  "") fail "Environment is required. Usage: ./rollback.sh <dev|staging|prod> [image]" ;;
  *)  fail "Unknown environment '${ENVIRONMENT}'. Use dev, staging or prod." ;;
esac

STATE_FILE="${STATE_DIR}/${ENVIRONMENT}.env"

# Resolve the image to roll back to.
if [[ -z "${TARGET_IMAGE}" ]]; then
  [[ -f "${STATE_FILE}" ]] || fail "No deployment state at ${STATE_FILE}. Pass an explicit image: ./rollback.sh ${ENVIRONMENT} <name:tag>"
  # shellcheck disable=SC1090
  source "${STATE_FILE}"
  TARGET_IMAGE="${PREVIOUS_IMAGE:-}"
  [[ -n "${TARGET_IMAGE}" ]] || fail "No PREVIOUS_IMAGE recorded for ${ENVIRONMENT}. Pass an explicit image to roll back to."
fi

container="chenaikit-backend-${ENVIRONMENT}"
log "Rolling back ${container} to ${TARGET_IMAGE}"
notify "STARTED" "Rolling back ${ENVIRONMENT} to ${TARGET_IMAGE}"

remote "docker pull ${TARGET_IMAGE}"
remote "docker rm -f ${container} 2>/dev/null || true"
remote "docker run -d --name ${container} \
  --restart unless-stopped \
  --env-file /etc/chenaikit/${ENVIRONMENT}.env 2>/dev/null \
  -e NODE_ENV=${ENVIRONMENT} \
  -e PORT=${PORT} \
  -p ${PORT}:${PORT} \
  ${TARGET_IMAGE} \
  || docker run -d --name ${container} \
  --restart unless-stopped \
  -e NODE_ENV=${ENVIRONMENT} \
  -e PORT=${PORT} \
  -p ${PORT}:${PORT} \
  ${TARGET_IMAGE}"

log "Verifying health at ${HEALTHCHECK_URL}"
ok=false
for i in $(seq 1 30); do
  if curl -fsS "${HEALTHCHECK_URL}" >/dev/null 2>&1; then
    log "Health check passed on attempt ${i}"
    ok=true
    break
  fi
  sleep 5
done

if [[ "${ok}" == "true" ]]; then
  # Mark the rolled-back image as current so a subsequent rollback is coherent.
  if [[ -f "${STATE_FILE}" ]]; then
    {
      echo "ENVIRONMENT=${ENVIRONMENT}"
      echo "IMAGE_NAME=${IMAGE_NAME:-}"
      echo "CURRENT_TAG=${TARGET_IMAGE##*:}"
      echo "PREVIOUS_IMAGE=${TARGET_IMAGE}"
      echo "DEPLOYED_AT=$(date -u +%Y-%m-%dT%H:%M:%SZ)"
      echo "DEPLOYED_BY=${USER:-ci}-rollback"
    } > "${STATE_FILE}"
  fi
  notify "SUCCESS" "Rolled back ${ENVIRONMENT} to ${TARGET_IMAGE}"
  log "Rollback complete."
else
  notify "FAILED" "Rollback health check failed for ${ENVIRONMENT} (${TARGET_IMAGE})"
  fail "Rollback health check failed."
fi
