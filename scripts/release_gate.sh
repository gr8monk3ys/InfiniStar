#!/usr/bin/env bash

set -euo pipefail

RUN_BUILD="${RUN_BUILD:-1}"
RUN_E2E="${RUN_E2E:-0}"
RUN_LOAD_SMOKE="${RUN_LOAD_SMOKE:-0}"

LOAD_SMOKE_BASE_URL="${LOAD_SMOKE_BASE_URL:-${PLAYWRIGHT_TEST_BASE_URL:-http://localhost:3101}}"
LOAD_SMOKE_REQUESTS="${LOAD_SMOKE_REQUESTS:-40}"
LOAD_SMOKE_CONCURRENCY="${LOAD_SMOKE_CONCURRENCY:-8}"
LOAD_SMOKE_P95_MS="${LOAD_SMOKE_P95_MS:-900}"
LOAD_SMOKE_ENDPOINTS="${LOAD_SMOKE_ENDPOINTS:-/api/csrf,/,/pricing}"
LOAD_SMOKE_SERVER_PID=""

log_step() {
  printf "\n[%s] %s\n" "$(date +"%H:%M:%S")" "$1"
}

cleanup() {
  if [[ -n "$LOAD_SMOKE_SERVER_PID" ]]; then
    kill "$LOAD_SMOKE_SERVER_PID" >/dev/null 2>&1 || true
    wait "$LOAD_SMOKE_SERVER_PID" 2>/dev/null || true
  fi
}

ensure_local_smoke_server() {
  local smoke_port

  if ! [[ "$LOAD_SMOKE_BASE_URL" =~ ^http://(localhost|127\.0\.0\.1)(:([0-9]+))?/?$ ]]; then
    return
  fi

  if curl -sS -o /dev/null "$LOAD_SMOKE_BASE_URL"; then
    return
  fi

  smoke_port="${BASH_REMATCH[3]:-80}"
  SKIP_ENV_VALIDATION=1 SKIP_CLERK_AUTH_HANDSHAKE=1 NEXT_PUBLIC_APP_URL="$LOAD_SMOKE_BASE_URL" PORT="$smoke_port" \
    bun run start >/tmp/release-gate-smoke-server.log 2>&1 &
  LOAD_SMOKE_SERVER_PID=$!

  for _ in {1..45}; do
    if curl -sS -o /dev/null "$LOAD_SMOKE_BASE_URL"; then
      return
    fi
    sleep 1
  done

  echo "Failed to start local server for load smoke." >&2
  tail -n 100 /tmp/release-gate-smoke-server.log >&2 || true
  exit 1
}

trap cleanup EXIT

log_step "Running formatter check"
bun run format:check

log_step "Running ESLint"
bun run lint

log_step "Running TypeScript checks"
bun run typecheck

log_step "Running unit/API tests"
bun run test --runInBand

if [[ "$RUN_BUILD" == "1" ]]; then
  log_step "Running production build"
  bun run build
fi

if [[ "$RUN_E2E" == "1" ]]; then
  log_step "Running end-to-end tests"
  bun run test:e2e -- --reporter=line
fi

if [[ "$RUN_LOAD_SMOKE" == "1" ]]; then
  log_step "Running load smoke check"
  ensure_local_smoke_server
  bun run test:load:smoke -- \
    --base-url="$LOAD_SMOKE_BASE_URL" \
    --endpoints="$LOAD_SMOKE_ENDPOINTS" \
    --requests="$LOAD_SMOKE_REQUESTS" \
    --concurrency="$LOAD_SMOKE_CONCURRENCY" \
    --p95-ms="$LOAD_SMOKE_P95_MS"
fi

log_step "Release gate passed"
