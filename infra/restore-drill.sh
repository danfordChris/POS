#!/usr/bin/env bash
# Restore drill: dump the live compose database, restore into a throwaway copy,
# and verify roles + FORCE RLS + tenant isolation survived. Drops the copy.
#
#   bash infra/restore-drill.sh
#
# All pg_dump / pg_restore / psql run inside the compose postgres container, so
# no local client is needed. Assumes the stack is up (pos-local-postgres-1).
set -euo pipefail

PG=pos-local-postgres-1
SRC=pos_dev
DRILL=pos_restore_drill
# Maintenance connection (CREATE/DROP DATABASE) — connect to an existing db.
Q() { docker exec "$PG" psql -U pos -d "$SRC" -v ON_ERROR_STOP=1 "$@"; }

echo "== dump $SRC (inside the container) =="
docker exec "$PG" pg_dump -U pos -Fc -d "$SRC" -f /tmp/pos-drill.dump

echo "== (re)create $DRILL =="
Q -c "DROP DATABASE IF EXISTS $DRILL WITH (FORCE);"
Q -c "CREATE DATABASE $DRILL OWNER pos;"

echo "== restore into $DRILL =="
docker exec "$PG" pg_restore -U pos -d "$DRILL" -j 4 /tmp/pos-drill.dump

echo "== verify: *_app roles present + non-superuser =="
Q -d "$DRILL" -tAc \
  "SELECT string_agg(rolname||'='||rolsuper, ' ' ORDER BY rolname) FROM pg_roles WHERE rolname LIKE '%\_app';"

echo "== verify: FORCE RLS on sampled tenant tables =="
BAD=$(docker exec "$PG" psql -U pos -d "$DRILL" -tAc "
  SELECT count(*) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
  WHERE c.relname IN ('product','stock_item','sale','winger_catalog_projection',
                      'membership','notification_contact')
    AND c.relforcerowsecurity = false;")
[ "$BAD" = "0" ] || { echo "FAIL: $BAD tenant tables lost FORCE RLS"; exit 1; }
echo "  all sampled tenant tables: FORCE RLS on"

echo "== verify: a scoped role reads 0 rows with no tenant context =="
N=$(docker exec "$PG" psql -U pos -d "$DRILL" -qtAX \
  -c "SET ROLE catalog_app" -c "SET search_path=catalog" \
  -c "SELECT count(*) FROM product" | tail -1 | tr -d '[:space:]')
[ "$N" = "0" ] || { echo "FAIL: catalog_app saw $N product rows unscoped"; exit 1; }
echo "  catalog_app unscoped product count: 0"

echo "== drop $DRILL =="
Q -c "DROP DATABASE IF EXISTS $DRILL WITH (FORCE);"
docker exec "$PG" rm -f /tmp/pos-drill.dump

echo "restore drill: PASS"
