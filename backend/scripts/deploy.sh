#!/usr/bin/env bash
#
# deploy.sh - Build, publish and deploy the ChenAIKit backend container.
#
# This script is intentionally container/registry driven so it works the same
# way locally, in CI and on a deployment host. It supports multiple
# environments, records the deployment so it can be rolled back, runs a health
# check against the freshly deployed service and emits a notification.
#
# Usage:
#   ./deploy.sh <environment> [image-tag]
#
#   environment   One of: dev | staging | prod        (required)
#   image-tag     Image tag to deploy (default: current git short SHA)
#
# Environment variables (all optional, sensible defaults applied):
#   IMAGE_NAME        Container image repository
#                     (default: ghcr.io/nexoraorg/chenaikit-backend)
#   REGISTRY          Registry host for `docker login` (default: ghcr.io)
#   REGISTRY_USERNAME / REGISTRY_PASSWORD
#                     Credentials for the registry. If unset, login is skipped
#                     (assumes the host/CI is already authenticated).
#   DEPLOY_HOST       Optional ssh target (user@host) to deploy remotely.
#   HEALTHCHECK_URL   URL polled to confirm the deployment is healthy
#                     (default: http://localhost:<PORT>/api/health)
#   PORT              Container/host port (default: 3000)
#   SKIP_BUILD        If "true", reuse an existing image instead of building.
#   SLACK_WEBHOOK_URL If set, a deployment notification is posted to Slack.
#
set -euo pipefail

# ---------------------------------------------------------------------------
# Resolve paths & configuration
# ---------------------------------------------------------------------------
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"
STATE_DIR="${SCRIPT_DIR}/.deploy-state"

ENVIRONMENT="${1:-}"
GIT_SHA="$(git -C "${REPO_ROOT}" rev-parse --short HEAD 2>/dev/null || echo "manual")"
IMAGE_TAG="${2:-${GIT_SHA}}"

IMAGE_NAME="${IMAGE_NAME:-ghcr.io/nexoraorg/chenaikit-backend}"
REGISTRY="${REGISTRY:-ghcr.io}"
PORT="${PORT:-3000}"
HEALTHCHECK_URL="${HEALTHCHECK_URL:-http://localhost:${PORT}/api/health}"
SKIP_BUILD="${SKIP_BUILD:-false}"

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------
log()  { printf '\033[0;32m[deploy]\033[0m %s\n' "$*"; }
warn() { printf '\033[0;33m[deploy]\033[0m %s\n' "$*" >&2; }
fail() { printf '\033[0;31m[deploy] ERROR:\033[0m %s\n' "$*" >&2; exit 1; }

notify() {
  # notify <status> <message>
  local status="$1" message="$2"
  log "${status}: ${message}"
  if [[ -n "${SLACK_WEBHOOK_URL:-}" ]]; then
    local emoji=":white_check_mark:"
    [[ "${status}" == "FAILED" ]] && emoji=":x:"
    curl -fsS -X POST -H 'Content-type: application/json' \
      --data "{\"text\":\"${emoji} *ChenAIKit backend deploy* [${ENVIRONMENT}] ${status}: ${message} (tag: ${IMAGE_TAG})\"}" \
      "${SLACK_WEBHOOK_URL}" >/dev/null 2>&1 || warn "Slack notification failed"
  fi
}

# Run a command locally or over ssh when DEPLOY_HOST is set.
remote() {
  if [[ -n "${DEPLOY_HOST:-}" ]]; then
    ssh "${DEPLOY_HOST}" "$@"
  else
    bash -c "$*"
  fi
}

validate_environment() {
  case "${ENVIRONMENT}" in
    dev|staging|prod) ;;
    "") fail "Environment is required. Usage: ./deploy.sh <dev|staging|prod> [tag]" ;;
    *)  fail "Unknown environment '${ENVIRONMENT}'. Use dev, staging or prod." ;;
  esac
}

# ---------------------------------------------------------------------------
# Deployment steps
# ---------------------------------------------------------------------------
registry_login() {
  if [[ -n "${REGISTRY_USERNAME:-}" && -n "${REGISTRY_PASSWORD:-}" ]]; then
    log "Logging in to ${REGISTRY}"
    echo "${REGISTRY_PASSWORD}" | docker login "${REGISTRY}" -u "${REGISTRY_USERNAME}" --password-stdin
  else
    warn "No registry credentials provided - assuming the host is already authenticated."
  fi
}

build_and_push() {
  if [[ "${SKIP_BUILD}" == "true" ]]; then
    log "SKIP_BUILD=true - using existing image ${IMAGE_NAME}:${IMAGE_TAG}"
    return
  fi
  log "Building image ${IMAGE_NAME}:${IMAGE_TAG} (context: ${REPO_ROOT})"
  docker build -f "${REPO_ROOT}/backend/Dockerfile" \
    -t "${IMAGE_NAME}:${IMAGE_TAG}" \
    -t "${IMAGE_NAME}:${ENVIRONMENT}" \
    "${REPO_ROOT}"

  log "Pushing ${IMAGE_NAME}:${IMAGE_TAG}"
  docker push "${IMAGE_NAME}:${IMAGE_TAG}"
  docker push "${IMAGE_NAME}:${ENVIRONMENT}"
}

current_running_tag() {
  # Best-effort lookup of the tag currently running, used to record the
  # previous version before we replace it.
  remote "docker inspect --format '{{ index .Config.Image }}' chenaikit-backend-${ENVIRONMENT} 2>/dev/null" 2>/dev/null || true
}

record_state() {
  # Persist the previous image so rollback.sh can restore it.
  mkdir -p "${STATE_DIR}"
  local state_file="${STATE_DIR}/${ENVIRONMENT}.env"
  local previous="${1:-}"
  {
    echo "ENVIRONMENT=${ENVIRONMENT}"
    echo "IMAGE_NAME=${IMAGE_NAME}"
    echo "CURRENT_TAG=${IMAGE_TAG}"
    echo "PREVIOUS_IMAGE=${previous}"
    echo "DEPLOYED_AT=$(date -u +%Y-%m-%dT%H:%M:%SZ)"
    echo "DEPLOYED_BY=${USER:-ci}"
  } > "${state_file}"
  log "Recorded deployment state -> ${state_file}"
}

deploy_container() {
  local container="chenaikit-backend-${ENVIRONMENT}"
  log "Deploying container ${container} from ${IMAGE_NAME}:${IMAGE_TAG}"

  remote "docker pull ${IMAGE_NAME}:${IMAGE_TAG}"
  remote "docker rm -f ${container} 2>/dev/null || true"
  remote "docker run -d --name ${container} \
    --restart unless-stopped \
    --env-file /etc/chenaikit/${ENVIRONMENT}.env 2>/dev/null \
    -e NODE_ENV=${ENVIRONMENT} \
    -e PORT=${PORT} \
    -p ${PORT}:${PORT} \
    ${IMAGE_NAME}:${IMAGE_TAG} \
    || docker run -d --name ${container} \
    --restart unless-stopped \
    -e NODE_ENV=${ENVIRONMENT} \
    -e PORT=${PORT} \
    -p ${PORT}:${PORT} \
    ${IMAGE_NAME}:${IMAGE_TAG}"
}

health_check() {
  log "Running health check against ${HEALTHCHECK_URL}"
  local attempts=30
  for i in $(seq 1 "${attempts}"); do
    if curl -fsS "${HEALTHCHECK_URL}" >/dev/null 2>&1; then
      log "Health check passed on attempt ${i}"
      return 0
    fi
    sleep 5
  done
  return 1
}

# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------
main() {
  validate_environment
  log "Starting deployment: env=${ENVIRONMENT} image=${IMAGE_NAME}:${IMAGE_TAG}"
  notify "STARTED" "Deployment of ${IMAGE_TAG} to ${ENVIRONMENT} started"

  registry_login
  build_and_push

  local previous
  previous="$(current_running_tag)"

  deploy_container

  if health_check; then
    record_state "${previous}"
    notify "SUCCESS" "Deployment of ${IMAGE_TAG} to ${ENVIRONMENT} succeeded"
    log "Deployment complete."
  else
    notify "FAILED" "Health check failed - run rollback.sh ${ENVIRONMENT} to restore ${previous:-previous version}"
    fail "Health check failed after deployment. The previous version is still recorded for rollback."
  fi
}

main "$@"
