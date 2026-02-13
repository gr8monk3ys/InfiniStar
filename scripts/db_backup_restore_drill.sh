#!/usr/bin/env bash

set -euo pipefail

BACKUP_SOURCE_URL="${DATABASE_URL:-}"
RESTORE_TARGET_URL="${DRILL_DATABASE_URL:-}"
BACKUP_DIR="${BACKUP_DIR:-./tmp/db-drills}"
BACKUP_PREFIX="${BACKUP_PREFIX:-infinistar-drill}"
REQUIRED_TABLE_COUNT="${REQUIRED_TABLE_COUNT:-1}"

log_step() {
  printf "\n[%s] %s\n" "$(date +"%H:%M:%S")" "$1"
}

abort() {
  printf "ERROR: %s\n" "$1" >&2
  exit 1
}

check_dependency() {
  local binary="$1"
  command -v "$binary" >/dev/null 2>&1 || abort "Missing dependency: $binary"
}

[[ -n "$BACKUP_SOURCE_URL" ]] || abort "DATABASE_URL is required."
[[ -n "$RESTORE_TARGET_URL" ]] || abort "DRILL_DATABASE_URL is required."

if [[ "$BACKUP_SOURCE_URL" == "$RESTORE_TARGET_URL" ]]; then
  abort "DRILL_DATABASE_URL must not match DATABASE_URL."
fi

check_dependency "pg_dump"
check_dependency "pg_restore"
check_dependency "psql"

mkdir -p "$BACKUP_DIR"

timestamp="$(date +"%Y%m%d-%H%M%S")"
backup_file="$BACKUP_DIR/${BACKUP_PREFIX}-${timestamp}.dump"

log_step "Creating backup from DATABASE_URL"
pg_dump \
  --format=custom \
  --no-owner \
  --no-privileges \
  --file="$backup_file" \
  "$BACKUP_SOURCE_URL"

if [[ ! -s "$backup_file" ]]; then
  abort "Backup file is empty: $backup_file"
fi

log_step "Restoring backup into DRILL_DATABASE_URL"
pg_restore \
  --clean \
  --if-exists \
  --no-owner \
  --no-privileges \
  --dbname="$RESTORE_TARGET_URL" \
  "$backup_file"

log_step "Validating restored schema"
table_count="$(
  psql "$RESTORE_TARGET_URL" -Atqc \
    "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public';"
)"

if [[ -z "$table_count" ]]; then
  abort "Unable to read table count from restore target."
fi

if [[ "$table_count" -lt "$REQUIRED_TABLE_COUNT" ]]; then
  abort "Restore validation failed. Found $table_count tables, expected at least $REQUIRED_TABLE_COUNT."
fi

log_step "Backup/restore drill passed"
printf "Backup artifact: %s\n" "$backup_file"
printf "Public tables restored: %s\n" "$table_count"
