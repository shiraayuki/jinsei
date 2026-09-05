#!/usr/bin/env bash
# One-off, run once on a host whose database predates commit 53eef16.
#
# AddWeightAndSleep was written without a [Migration] attribute, so EF never
# discovered it and never recorded it — while the tables it describes,
# weight_entries and sleep_entries, were created anyway and are in daily use.
# Giving the migration its attribute makes EF consider it pending against
# exactly those databases, where it would try to CREATE TABLE over live data
# and take the backend into a crash loop on the next start.
#
# So: write the history row the database should have had all along, before
# the new backend comes up. Safe to run twice, and a no-op on a database that
# does not need it.
set -euo pipefail

CONTAINER="${JINSEI_DB_CONTAINER:-docker-postgres-1}"
MIGRATION="20260428180000_AddWeightAndSleep"

user="$(docker exec "$CONTAINER" printenv POSTGRES_USER)"
db="$(docker exec "$CONTAINER" printenv POSTGRES_DB)"

psql() { docker exec -i "$CONTAINER" psql -U "$user" -d "$db" -tAc "$1"; }

# A database with no history table has never been migrated: it is a fresh
# install, the chain will run from the top, and it must not be marked.
if [ "$(psql "SELECT to_regclass('public.\"__EFMigrationsHistory\"') IS NOT NULL;")" != "t" ]; then
    echo "No __EFMigrationsHistory — fresh database, nothing to mark."
    exit 0
fi

if [ "$(psql "SELECT EXISTS (SELECT 1 FROM \"__EFMigrationsHistory\" WHERE migration_id = '$MIGRATION');")" = "t" ]; then
    echo "$MIGRATION is already recorded. Nothing to do."
    exit 0
fi

# Only mark it where the tables really are already there. If they are not, the
# migration has genuine work to do and must be left to run.
present="$(psql "SELECT count(*) FROM pg_tables WHERE schemaname = 'public' AND tablename IN ('weight_entries', 'sleep_entries');")"
if [ "$present" != "2" ]; then
    echo "weight_entries/sleep_entries are not both present ($present/2)."
    echo "The migration has work to do here — leaving it pending."
    exit 0
fi

# Borrow the version the other rows carry rather than hardcoding one, so the
# row matches its neighbours on whatever host this runs.
version="$(psql "SELECT product_version FROM \"__EFMigrationsHistory\" ORDER BY migration_id LIMIT 1;")"

psql "INSERT INTO \"__EFMigrationsHistory\" (migration_id, product_version)
      VALUES ('$MIGRATION', '$version') ON CONFLICT DO NOTHING;" > /dev/null

echo "Recorded $MIGRATION (product_version $version). Safe to deploy."
