#!/usr/bin/env bash
# Edge rate-limit smoke. Requires the compose stack up (Kong on :8000).
# Fires more than the configured per-minute allowance at the two public routes
# and asserts a 429 appears; a single request must not be limited.
set -euo pipefail
BASE="${1:-http://localhost:8000}"

fail() { echo "FAIL: $1" >&2; exit 1; }

# 1. A single login attempt is a 4xx (bad creds) — never 429.
code=$(curl -s -o /dev/null -w '%{http_code}' -X POST "$BASE/v1/auth/login" \
  -H 'content-type: application/json' -d '{"email":"x@y.z","password":"nope"}')
[ "$code" = "429" ] && fail "a single /v1/auth/login was rate-limited ($code)"
echo "single /v1/auth/login: $code (not limited) OK"

# 2. Burst past 60/min on /v1/auth/login → expect a 429.
hit=0
for _ in $(seq 1 75); do
  c=$(curl -s -o /dev/null -w '%{http_code}' -X POST "$BASE/v1/auth/login" \
    -H 'content-type: application/json' -d '{"email":"x@y.z","password":"nope"}')
  [ "$c" = "429" ] && { hit=1; break; }
done
[ "$hit" = "1" ] || fail "no 429 after 75 rapid /v1/auth/login calls"
echo "/v1/auth/login burst → 429 OK"

# 3. Burst past 120/min on /v1/r/{token} → expect a 429 (unknown token 404s until limited).
hit=0
for _ in $(seq 1 140); do
  c=$(curl -s -o /dev/null -w '%{http_code}' "$BASE/v1/r/does-not-exist-$RANDOM")
  [ "$c" = "429" ] && { hit=1; break; }
done
[ "$hit" = "1" ] || fail "no 429 after 140 rapid /v1/r/{token} calls"
echo "/v1/r/{token} burst → 429 OK"

echo "rate-limit smoke: all checks passed"
