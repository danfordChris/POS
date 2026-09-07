#!/usr/bin/env bash
# MVP acceptance smoke — walks the core PRD stories end-to-end through Kong.
# Requires the compose stack up (Kong on :8000, all services healthy).
#
#   bash infra/acceptance-smoke.sh
#
# Covers: U1 (sign up a business), U4 (add a product), U5 (stock-in), U8
# (complete a sale + anonymous receipt), U10/U11/U12 (winger authorize + catalog
# + cross-business probe), U13 (operator denied on a data route), U14 (credit
# sale issues an invoice + public view + PDF), U15 (payments settle the balance).
set -euo pipefail
BASE="${1:-http://localhost:8000}"
TS=$(date +%s)
J() { python3 -c "import sys,json;print(json.load(sys.stdin)$1)"; }
PSQL() { docker exec pos-local-postgres-1 psql -U pos -d pos_dev -qtAc "$1"; }
ok() { printf '  \033[32mOK\033[0m %s\n' "$1"; }
die() { printf '\033[31mFAIL\033[0m %s\n' "$1" >&2; exit 1; }

OWNER="acc-owner-$TS@example.com"
WINGER="acc-winger-$TS@example.com"

echo "== U1: sign up a business =="
curl -s -X POST "$BASE/v1/auth/register" -H 'content-type: application/json' \
  -d "{\"name\":\"Acc Owner\",\"email\":\"$OWNER\",\"password\":\"password12345\"}" >/dev/null
OTOK=$(curl -s -X POST "$BASE/v1/auth/login" -H 'content-type: application/json' \
  -d "{\"email\":\"$OWNER\",\"password\":\"password12345\"}" | J "['accessToken']")
BID=$(curl -s -X POST "$BASE/v1/businesses" -H "authorization: Bearer $OTOK" \
  -H 'content-type: application/json' -d '{"name":"Acceptance Shop"}' | J "['id']")
[ -n "$BID" ] || die "no business id"
role=$(curl -s "$BASE/v1/businesses/$BID" -H "authorization: Bearer $OTOK" | J "['role']")
[ "$role" = "owner" ] || die "caller is not owner ($role)"
ok "business $BID created; caller is owner"

echo "== U4: add a product =="
PID=$(curl -s -X POST "$BASE/v1/businesses/$BID/products" -H "authorization: Bearer $OTOK" \
  -H 'content-type: application/json' \
  -d "{\"sku\":\"ACC-$TS\",\"name\":\"Acceptance widget\",\"unit\":\"each\",\"sell_price\":1500,\"winger_price\":1200}" | J "['id']")
[ -n "$PID" ] || die "no product id"
ok "product $PID created"

echo "== U5: stock-in =="
onhand=$(curl -s -X POST "$BASE/v1/businesses/$BID/stock/movements" -H "authorization: Bearer $OTOK" \
  -H 'content-type: application/json' -d "{\"product_id\":\"$PID\",\"type\":\"stock_in\",\"quantity_delta\":20}" | J "['on_hand']")
[ "$onhand" = "20" ] || die "on_hand after stock_in is $onhand, expected 20"
ok "on_hand = 20 after stock-in"

echo "== U8: complete a sale + anonymous receipt =="
# The sale needs the product's name/price cached in `sales` — fed async from
# catalog's ProductUpserted / PriceChanged. Retry until the projection lands.
TOKEN=""
for _ in $(seq 1 20); do
  SALE=$(curl -s -X POST "$BASE/v1/businesses/$BID/sales" -H "authorization: Bearer $OTOK" \
    -H 'content-type: application/json' -d "{\"lines\":[{\"product_id\":\"$PID\",\"quantity\":3}]}")
  TOKEN=$(printf '%s' "$SALE" | python3 -c "import sys,json;d=json.load(sys.stdin);print(d.get('receipt',{}).get('public_token','') if 'error' not in d else '')")
  [ -n "$TOKEN" ] && break
  sleep 1
done
[ -n "$TOKEN" ] || die "sale never succeeded (product cache not populated?): $SALE"
rc=$(curl -s -o /dev/null -w '%{http_code}' "$BASE/v1/r/$TOKEN")
[ "$rc" = "200" ] || die "anonymous receipt GET returned $rc"
# on_hand should have dropped by 3 (commit is async via the SaleCompleted backstop; poll)
for _ in $(seq 1 15); do
  oh=$(curl -s "$BASE/v1/businesses/$BID/stock" -H "authorization: Bearer $OTOK" \
    | python3 -c "import sys,json;d=json.load(sys.stdin)['data'];print(next((i['on_hand'] for i in d if i['product_id']=='$PID'),'?'))")
  [ "$oh" = "17" ] && break
  sleep 1
done
[ "$oh" = "17" ] || die "on_hand after sale is $oh, expected 17"
ok "sale completed; receipt 200 for anon; on_hand = 17"

echo "== U10/U11/U12: winger =="
curl -s -X POST "$BASE/v1/auth/register" -H 'content-type: application/json' \
  -d "{\"name\":\"Acc Winger\",\"email\":\"$WINGER\",\"password\":\"password12345\"}" >/dev/null
curl -s -X POST "$BASE/v1/businesses/$BID/winger-accounts" -H "authorization: Bearer $OTOK" \
  -H 'content-type: application/json' -d "{\"email\":\"$WINGER\"}" >/dev/null
WTOK=$(curl -s -X POST "$BASE/v1/auth/login" -H 'content-type: application/json' \
  -d "{\"email\":\"$WINGER\",\"password\":\"password12345\"}" | J "['accessToken']")
prod=$(curl -s "$BASE/v1/winger/businesses/$BID/products" -H "authorization: Bearer $WTOK")
keys=$(printf '%s' "$prod" | python3 -c "import sys,json;d=json.load(sys.stdin)['data'];print(','.join(sorted(d[0].keys())) if d else 'empty')")
[ "$keys" = "currency,image_url,in_stock,name,price" ] || die "winger product keys: $keys"
other=$(PSQL "SELECT uuidv7();" | tr -d '[:space:]')
rc=$(curl -s -o /dev/null -w '%{http_code}' "$BASE/v1/winger/businesses/$other/products" -H "authorization: Bearer $WTOK")
[ "$rc" = "403" ] || die "winger probe of another business returned $rc, expected 403"
ok "winger catalog whitelisted; cross-business probe → 403"

echo "== U13: operator denied on a data route =="
OP="acc-op-$TS@example.com"
HASH=$(cd "$(dirname "$0")/../services/identity" && node --input-type=module -e \
  "import { hashPassword } from './dist/auth/password.js'; process.stdout.write(await hashPassword('operator12345'));")
PSQL "INSERT INTO identity.operator (name,email,password_hash) VALUES ('Acc Op','$OP','$HASH');" >/dev/null
OPTOK=$(curl -s -X POST "$BASE/v1/auth/operator/login" -H 'content-type: application/json' \
  -d "{\"email\":\"$OP\",\"password\":\"operator12345\"}" | J "['accessToken']")
rc=$(curl -s -o /dev/null -w '%{http_code}' "$BASE/v1/businesses/$BID/products" -H "authorization: Bearer $OPTOK")
[ "$rc" = "403" ] || die "operator token on /products returned $rc, expected 403"
ok "operator token on a data route → 403"

echo "== U14: credit sale → invoice + public view + PDF =="
CID=$(curl -s -X POST "$BASE/v1/businesses/$BID/customers" -H "authorization: Bearer $OTOK" \
  -H 'content-type: application/json' -d "{\"name\":\"Acc Customer\",\"email\":\"acc-cust-$TS@example.com\"}" | J "['id']")
[ -n "$CID" ] || die "no customer id"
# retry: product_cache in sales is fed async
CSALE=""
for _ in $(seq 1 20); do
  CSALE=$(curl -s -X POST "$BASE/v1/businesses/$BID/sales" -H "authorization: Bearer $OTOK" \
    -H 'content-type: application/json' \
    -d "{\"lines\":[{\"product_id\":\"$PID\",\"quantity\":2}],\"payment_terms\":\"credit\",\"customer_id\":\"$CID\"}")
  echo "$CSALE" | grep -q '"invoice"' && break
  sleep 1
done
IID=$(printf '%s' "$CSALE" | python3 -c "import sys,json;d=json.load(sys.stdin);print((d.get('invoice') or {}).get('id',''))")
ITOK=$(printf '%s' "$CSALE" | python3 -c "import sys,json;d=json.load(sys.stdin);print((d.get('invoice') or {}).get('public_token',''))")
[ -n "$IID" ] || die "credit sale issued no invoice: $CSALE"
bal=$(curl -s "$BASE/v1/businesses/$BID/invoices/$IID" -H "authorization: Bearer $OTOK" | J "['balance_due_minor']")
tot=$(printf '%s' "$CSALE" | J "['total']")
[ "$bal" = "$tot" ] || die "invoice balance_due ($bal) != sale total ($tot)"
rc=$(curl -s -o /dev/null -w '%{http_code}' "$BASE/v1/i/$ITOK")
[ "$rc" = "200" ] || die "public invoice GET returned $rc, expected 200"
custbal=$(curl -s "$BASE/v1/businesses/$BID/customers/$CID" -H "authorization: Bearer $OTOK" | J "['outstanding_balance']")
[ "$custbal" = "$tot" ] || die "customer outstanding_balance ($custbal) != invoice total ($tot)"
# the media service renders the PDF off InvoiceIssued — poll the public /pdf
pdfrc=0
for _ in $(seq 1 20); do
  pdfrc=$(curl -s -o /dev/null -w '%{http_code}' -L "$BASE/v1/i/$ITOK/pdf")
  [ "$pdfrc" = "200" ] && break
  sleep 1
done
[ "$pdfrc" = "200" ] || die "invoice PDF never became ready (last $pdfrc)"
ok "credit sale issued invoice $IID; balance == total; public view 200; PDF 200"

echo "== U15: payments settle the invoice =="
half=$(( tot / 2 ))
curl -s -X POST "$BASE/v1/businesses/$BID/invoices/$IID/payments" -H "authorization: Bearer $OTOK" \
  -H 'content-type: application/json' -d "{\"amount_minor\":$half,\"method\":\"cash\"}" >/dev/null
st=$(curl -s "$BASE/v1/businesses/$BID/invoices/$IID" -H "authorization: Bearer $OTOK" | J "['status']")
[ "$st" = "partially_paid" ] || die "invoice status after part payment is $st, expected partially_paid"
rest=$(( tot - half ))
curl -s -X POST "$BASE/v1/businesses/$BID/invoices/$IID/payments" -H "authorization: Bearer $OTOK" \
  -H 'content-type: application/json' -d "{\"amount_minor\":$rest,\"method\":\"mobile_money\"}" >/dev/null
final=$(curl -s "$BASE/v1/businesses/$BID/invoices/$IID" -H "authorization: Bearer $OTOK")
st=$(printf '%s' "$final" | J "['status']")
fb=$(printf '%s' "$final" | J "['balance_due_minor']")
[ "$st" = "paid" ] && [ "$fb" = "0" ] || die "invoice not fully paid (status $st, balance $fb)"
custbal=$(curl -s "$BASE/v1/businesses/$BID/customers/$CID" -H "authorization: Bearer $OTOK" | J "['outstanding_balance']")
[ "$custbal" = "0" ] || die "customer balance after full payment is $custbal, expected 0"
# a payment past the balance is rejected
rc=$(curl -s -o /dev/null -w '%{http_code}' -X POST "$BASE/v1/businesses/$BID/invoices/$IID/payments" \
  -H "authorization: Bearer $OTOK" -H 'content-type: application/json' -d '{"amount_minor":1,"method":"cash"}')
[ "$rc" = "409" ] || die "payment on a paid invoice returned $rc, expected 409"
ok "invoice paid in full; customer balance 0; payment on paid invoice → 409"

echo
echo "acceptance smoke: all stories passed"
