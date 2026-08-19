#!/usr/bin/env bash

set -euo pipefail

if [[ $# -ne 1 ]]; then
  echo "Usage: just restore /absolute/path/to/data.db" >&2
  exit 2
fi

source_db=$1
repo_root=$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)
data_dir="$repo_root/server/pb_data"
target_db="$data_dir/data.db"

if [[ $(basename "$source_db") != "data.db" ]]; then
  echo "Restore source must be a data.db file: $source_db" >&2
  exit 2
fi

if [[ ! -f "$source_db" || ! -r "$source_db" ]]; then
  echo "Restore source is not a readable file: $source_db" >&2
  exit 2
fi

if ! command -v sqlite3 >/dev/null; then
  echo "sqlite3 is required to validate the backup before restoring it" >&2
  exit 2
fi

if [[ $(sqlite3 "$source_db" "PRAGMA quick_check;") != "ok" ]]; then
  echo "Restore source failed SQLite quick_check: $source_db" >&2
  exit 1
fi

if command -v lsof >/dev/null && lsof "$target_db" >/dev/null 2>&1; then
  echo "Local data.db is in use. Stop just dev before restoring a backup." >&2
  exit 1
fi

timestamp=$(date +%Y%m%d-%H%M%S)
backup_dir="$data_dir/backups/$timestamp"
temp_db=""

cleanup() {
  if [[ -n "$temp_db" && -e "$temp_db" ]]; then
    rm -f "$temp_db"
  fi
}
trap cleanup EXIT

mkdir -p "$data_dir"

if [[ -e "$target_db" || -e "$target_db-wal" || -e "$target_db-shm" ]]; then
  mkdir -p "$backup_dir"

  for database_file in "$target_db" "$target_db-wal" "$target_db-shm"; do
    if [[ -e "$database_file" ]]; then
      mv "$database_file" "$backup_dir/$(basename "$database_file")"
    fi
  done
fi

temp_db=$(mktemp "$data_dir/.data.db.restore.XXXXXX")
cp -p "$source_db" "$temp_db"
mv "$temp_db" "$target_db"
temp_db=""

echo "Restored $source_db to $target_db"
if [[ -d "$backup_dir" ]]; then
  echo "Previous local data saved to $backup_dir"
fi
