#!/bin/bash

set -euo pipefail

BASE_URL=${BASE_URL:-http://localhost:5000}

RED='\033[0;31m'
GREEN='\033[0;32m'
NC='\033[0m'

pass() { echo -e "${GREEN}✓ $1${NC}"; }
fail() { echo -e "${RED}✗ $1${NC}"; exit 1; }

# 1) Login as Doctor A and Doctor B
login() {
  local bsnr="$1"; local lanr="$2"; local password="$3";
  curl -s -X POST "$BASE_URL/api/login" -H 'Content-Type: application/json' \
    -d "{\"bsnr\": \"$bsnr\", \"lanr\": \"$lanr\", \"password\": \"$password\"}"
}

TOKEN_A=$(login 123456789 1234567 doctor123 | grep -o '"token":"[^"]*"' | cut -d'"' -f4)
[ -n "$TOKEN_A" ] || fail "Doctor A login failed"
pass "Doctor A login"

# Create Doctor B if not existing via admin (fallback uses predefined lab tech as different LANR)
TOKEN_B=$(login 123456789 1234568 lab123 | grep -o '"token":"[^"]*"' | cut -d'"' -f4)
[ -n "$TOKEN_B" ] || fail "Doctor B (lab tech as other identity) login failed"
pass "Doctor B login"

# 2) List results for A and capture first result id
RID_A=$(curl -s -H "Authorization: Bearer $TOKEN_A" "$BASE_URL/api/results" | grep -o '"id":"res[^"]*"' | head -n1 | cut -d'"' -f4)
[ -n "$RID_A" ] || fail "No result id for Doctor A"
pass "Doctor A has at least one result ($RID_A)"

# 3) Doctor B tries to access Doctor A's result (should be 403)
HTTP_B=$(curl -s -o /dev/null -w "%{http_code}" -H "Authorization: Bearer $TOKEN_B" "$BASE_URL/api/results/$RID_A")
[ "$HTTP_B" = "403" ] || fail "Doctor B should get 403 accessing Doctor A's result, got $HTTP_B"
pass "Doctor B blocked from Doctor A's result (403)"

# 4) Webhook security: missing signature should 401
HTTP_WS=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$BASE_URL/api/mirth-webhook" -H 'Content-Type: text/plain' --data-binary 'test')
[ "$HTTP_WS" = "401" ] || fail "Webhook without signature should 401, got $HTTP_WS"
pass "Webhook signature required"

# 5) Webhook with signature: compute HMAC and send
SECRET=${MIRTH_WEBHOOK_SECRET:-test_secret}
TS=$(date +%s000)
BODY=$'01380008230\n014810000204\n0199212LDT1014.01'
SIG=$(printf "%s.%s" "$TS" "$BODY" | openssl dgst -sha256 -hmac "$SECRET" -binary | xxd -p -c 256)
HTTP_OK=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$BASE_URL/api/mirth-webhook" \
  -H 'Content-Type: text/plain' \
  -H "X-Timestamp: $TS" \
  -H "X-Signature: sha256=$SIG" \
  --data-binary "$BODY")
[ "$HTTP_OK" = "202" ] || fail "Signed webhook should 202, got $HTTP_OK"
pass "Signed webhook accepted (202)"

echo -e "${GREEN}All access control and webhook security tests passed.${NC}"