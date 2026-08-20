#!/usr/bin/env bash
# Dumps the jinsei database and keeps the last N days of dumps.
#
# Run from cron on the host that runs the stack:
#   0 3 * * * /home/n8n/dev/repos/jinsei/scripts/backup-db.sh >> /home/n8n/jinsei-backup.log 2>&1
set -euo pipefail

CONTAINER="${JINSEI_DB_CONTAINER:-docker-postgres-1}"
DEST="${JINSEI_BACKUP_DIR:-$HOME/backups/jinsei}"
KEEP_DAYS="${JINSEI_BACKUP_KEEP_DAYS:-14}"

mkdir -p "$DEST"
stamp="$(date +%F-%H%M)"
target="$DEST/jinsei-$stamp.sql.gz"

# Read the credentials from the running container so the script does not need
# its own copy of them.
user="$(docker exec "$CONTAINER" printenv POSTGRES_USER)"
db="$(docker exec "$CONTAINER" printenv POSTGRES_DB)"

# Write to a temporary name first: a dump interrupted halfway must not be left
# behind looking like a usable backup.
docker exec "$CONTAINER" pg_dump -U "$user" -d "$db" | gzip > "$target.partial"
mv "$target.partial" "$target"

size="$(du -h "$target" | cut -f1)"
echo "$(date -Is) wrote $target ($size)"

# Rotate. -mtime is whole days, so +KEEP_DAYS keeps today plus KEEP_DAYS back.
deleted="$(find "$DEST" -name 'jinsei-*.sql.gz' -mtime "+$KEEP_DAYS" -print -delete | wc -l)"
[ "$deleted" -gt 0 ] && echo "$(date -Is) rotated out $deleted old dump(s)"

# A backup nobody ever restores is a guess. Check the dump is readable and
# actually contains the schema. grep -c rather than -q: with pipefail set, a
# grep that exits early sends SIGPIPE upstream and fails the whole pipeline.
tables="$(zcat "$target" | grep -c 'CREATE TABLE' || true)"
if ! gzip -t "$target" || [ "$tables" -eq 0 ]; then
    echo "$(date -Is) WARNING: $target does not look like a complete dump" >&2
    exit 1
fi
echo "$(date -Is) verified: $tables tables in dump"
