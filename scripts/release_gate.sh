#!/usr/bin/env bash

set -euo pipefail

RUN_BUILD="${RUN_BUILD:-1}"
RUN_E2E="${RUN_E2E:-0}"
RUN_LOAD_SMOKE="${RUN_LOAD_SMOKE:-0}"

LOAD_SMOKE_BASE_URL="${LOAD_SMOKE_BASE_URL:-http://localhost:3000}"
LOAD_SMOKE_REQUESTS="${LOAD_SMOKE_REQUESTS:-40}"
LOAD_SMOKE_CONCURRENCY="${LOAD_SMOKE_CONCURRENCY:-8}"
LOAD_SMOKE_P95_MS="${LOAD_SMOKE_P95_MS:-900}"

log_step() {
  printf "\n[%s] %s\n" "$(date +"%H:%M:%S")" "$1"
}

log_step "Running formatter check"
npm run format:check

log_step "Running ESLint"
npm run lint

log_step "Running TypeScript checks"
npm run typecheck

log_step "Running unit/API tests"
npm test -- --runInBand

if [[ "$RUN_BUILD" == "1" ]]; then
  log_step "Running production build"
  npm run build
fi

if [[ "$RUN_E2E" == "1" ]]; then
  log_step "Running end-to-end tests"
  npm run test:e2e -- --reporter=line
fi

if [[ "$RUN_LOAD_SMOKE" == "1" ]]; then
  log_step "Running load smoke check"
  npm run test:load:smoke -- \
    --base-url="$LOAD_SMOKE_BASE_URL" \
    --requests="$LOAD_SMOKE_REQUESTS" \
    --concurrency="$LOAD_SMOKE_CONCURRENCY" \
    --p95-ms="$LOAD_SMOKE_P95_MS"
fi

log_step "Release gate passed"
