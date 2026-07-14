#!/bin/bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
COMPOSE_FILE="${REPO_DIR}/compose.production.yaml"
ENV_FILE="${REPO_DIR}/apps/web/.env.production"
STATE_DIR="${REPO_DIR}/.deploy"
DEPLOYED_SHA_FILE="${STATE_DIR}/deployed-sha"
LOCK_DIR="${TMPDIR:-/tmp}/handy-dandy-deploy.lock"
HEALTH_URL="${HANDY_DANDY_HEALTH_URL:-http://127.0.0.1:3010/api/health}"

timestamp() {
  date '+%Y-%m-%d %H:%M:%S'
}

log() {
  printf '[%s] %s\n' "$(timestamp)" "$*"
}

if ! mkdir "${LOCK_DIR}" 2>/dev/null; then
  lock_pid=""
  if [[ -f "${LOCK_DIR}/pid" ]]; then
    lock_pid="$(cat "${LOCK_DIR}/pid")"
  fi
  if [[ -n "${lock_pid}" ]] && kill -0 "${lock_pid}" 2>/dev/null; then
    log "Another deployment is already running; exiting."
    exit 0
  fi
  log "Removing a stale deployment lock."
  rm -f "${LOCK_DIR}/pid"
  rmdir "${LOCK_DIR}"
  mkdir "${LOCK_DIR}"
fi
printf '%s\n' "$$" > "${LOCK_DIR}/pid"
trap 'rm -f "${LOCK_DIR}/pid"; rmdir "${LOCK_DIR}"' EXIT

cd "${REPO_DIR}"

if [[ ! -f "${ENV_FILE}" ]]; then
  log "Missing production environment file: ${ENV_FILE}"
  exit 1
fi

if [[ -n "$(git status --porcelain --untracked-files=no)" ]]; then
  log "Tracked files have local changes. Refusing to overwrite them."
  exit 1
fi

current_branch="$(git branch --show-current)"
if [[ "${current_branch}" != "main" ]]; then
  log "The server checkout must be on main, but it is on ${current_branch:-a detached HEAD}."
  exit 1
fi

log "Checking for a tested production commit..."
git fetch --quiet origin \
  refs/heads/production:refs/remotes/origin/production

target_sha="$(git rev-parse origin/production)"
current_sha="$(git rev-parse HEAD)"
deployed_sha=""
if [[ -f "${DEPLOYED_SHA_FILE}" ]]; then
  deployed_sha="$(cat "${DEPLOYED_SHA_FILE}")"
fi

if [[ "${target_sha}" == "${deployed_sha}" ]]; then
  log "Production is already running ${target_sha}."
  exit 0
fi

if ! git merge-base --is-ancestor "${current_sha}" "${target_sha}"; then
  log "The server checkout cannot fast-forward from ${current_sha} to ${target_sha}."
  log "Resolve the checkout manually before automatic deployments continue."
  exit 1
fi

log "Deploying tested commit ${target_sha}..."
git merge --ff-only "${target_sha}"

compose=(docker compose --env-file "${ENV_FILE}" -f "${COMPOSE_FILE}")

log "Building production images..."
COMPOSE_PARALLEL_LIMIT=1 "${compose[@]}" build migrate web reminder-worker

log "Applying migrations and starting updated services..."
"${compose[@]}" up -d --remove-orphans

log "Waiting for the application health check..."
healthy=false
for _ in {1..30}; do
  if curl --fail --silent --show-error --max-time 5 "${HEALTH_URL}" >/dev/null; then
    healthy=true
    break
  fi
  sleep 5
done

if [[ "${healthy}" != "true" ]]; then
  log "Deployment failed: ${HEALTH_URL} did not become healthy."
  "${compose[@]}" ps
  exit 1
fi

mkdir -p "${STATE_DIR}"
printf '%s\n' "${target_sha}" > "${DEPLOYED_SHA_FILE}"
log "Deployment complete and healthy at ${target_sha}."
