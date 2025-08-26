#!/bin/bash

# Comprehensive API Test Script for Labor Results Web App
# This script tests all major API endpoints to ensure they're working correctly

echo "🧪 Testing Labor Results Web App API Endpoints"
echo "=============================================="

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Test counter
TESTS_PASSED=0
TESTS_FAILED=0

# Function to run a test
run_test() {
    local test_name="$1"
    local command="$2"
    local expected_pattern="$3"
    
    echo -n "Testing $test_name... "
    
    # Run the command and capture output
    local output
    output=$(eval "$command" 2>&1)
    local exit_code=$?
    
    if [ $exit_code -eq 0 ] && echo "$output" | grep -q "$expected_pattern"; then
        echo -e "${GREEN}✓ PASS${NC}"
        ((TESTS_PASSED++))
    else
        echo -e "${RED}✗ FAIL${NC}"
        echo "Command: $command"
        echo "Output: $output"
        ((TESTS_FAILED++))
    fi
}

# Wait for servers to be ready
echo "Waiting for servers to be ready..."
sleep 3

# Test 1: Health Check
run_test "Health Check" \
    "curl -s http://localhost:5000/api/health" \
    '"status":"healthy"'

# Test 2: Login with Doctor Credentials
run_test "Login (Doctor)" \
    "curl -s -X POST http://localhost:5000/api/login -H 'Content-Type: application/json' -d '{\"bsnr\": \"123456789\", \"lanr\": \"1234567\", \"password\": \"doctor123\"}'" \
    '"success":true'

# Test 3: Login with Lab Technician Credentials
run_test "Login (Lab Tech)" \
    "curl -s -X POST http://localhost:5000/api/login -H 'Content-Type: application/json' -d '{\"bsnr\": \"123456789\", \"lanr\": \"1234568\", \"password\": \"lab123\"}'" \
    '"success":true'

# Test 4: Login with Admin Credentials
run_test "Login (Admin)" \
    "curl -s -X POST http://localhost:5000/api/login -H 'Content-Type: application/json' -d '{\"bsnr\": \"999999999\", \"lanr\": \"9999999\", \"password\": \"admin123\"}'" \
    '"success":true'

# Test 5: Invalid Login
run_test "Invalid Login" \
    "curl -s -X POST http://localhost:5000/api/login -H 'Content-Type: application/json' -d '{\"bsnr\": \"123456789\", \"lanr\": \"1234567\", \"password\": \"wrongpassword\"}'" \
    '"success":false'

# Get a valid token for authenticated tests
echo "Getting authentication token..."
TOKEN_RESPONSE=$(curl -s -X POST http://localhost:5000/api/login -H 'Content-Type: application/json' -d '{"bsnr": "123456789", "lanr": "1234567", "password": "doctor123"}')
TOKEN=$(echo "$TOKEN_RESPONSE" | grep -o '"token":"[^"]*"' | cut -d'"' -f4)

if [ -n "$TOKEN" ]; then
    echo "✓ Authentication token obtained"
    
    # Test 6: Get Results (Authenticated)
    run_test "Get Results (Authenticated)" \
        "curl -s -H 'Authorization: Bearer $TOKEN' http://localhost:5000/api/results" \
        '"success":true'
    
    # Test 7: Download LDT (Authenticated)
    run_test "Download LDT (Authenticated)" \
        "curl -s -H 'Authorization: Bearer $TOKEN' http://localhost:5000/api/download/ldt -o /tmp/test.ldt && ls -la /tmp/test.ldt" \
        "test.ldt"
    
    # Test 8: Download PDF (Authenticated)
    run_test "Download PDF (Authenticated)" \
        "curl -s -H 'Authorization: Bearer $TOKEN' http://localhost:5000/api/download/pdf -o /tmp/test.pdf && ls -la /tmp/test.pdf" \
        "test.pdf"
    
    # Test 9: Unauthorized Access
    run_test "Unauthorized Access" \
        "curl -s http://localhost:5000/api/results" \
        '"success":false'
    
else
    echo -e "${RED}✗ Failed to get authentication token${NC}"
    ((TESTS_FAILED++))
fi

# Test 10: Mirth Connect Webhook (XML format) - signed
SECRET=${MIRTH_WEBHOOK_SECRET:-test_secret}
TS_XML=$(date +%s000)
BODY_XML='<column1>0278000921818LABOR_RESULTS_V2.1</column1><column1>022800091032024XXXXX</column1>'
SIG_XML=$(printf "%s.%s" "$TS_XML" "$BODY_XML" | openssl dgst -sha256 -hmac "$SECRET" -binary | xxd -p -c 256)
run_test "Mirth Connect Webhook (XML)" \
    "curl -s -X POST http://localhost:5000/api/mirth-webhook -H 'Content-Type: text/plain' -H 'X-Timestamp: $TS_XML' -H 'X-Signature: sha256=$SIG_XML' --data-binary \"$BODY_XML\"" \
    '"success":true'

# Test 11: Mirth Connect Webhook (Line-based format) - signed
TS_LN=$(date +%s000)
BODY_LN=$'01380008230\n014810000204\n0199212LDT1014.01'
SIG_LN=$(printf "%s.%s" "$TS_LN" "$BODY_LN" | openssl dgst -sha256 -hmac "$SECRET" -binary | xxd -p -c 256)
run_test "Mirth Connect Webhook (Line-based)" \
    "curl -s -X POST http://localhost:5000/api/mirth-webhook -H 'Content-Type: text/plain' -H 'X-Timestamp: $TS_LN' -H 'X-Signature: sha256=$SIG_LN' --data-binary \"$BODY_LN\"" \
    '"success":true'

# Test 12: Invalid Mirth Webhook
run_test "Invalid Mirth Webhook" \
    "curl -s -X POST http://localhost:5000/api/mirth-webhook -H 'Content-Type: text/plain' -d 'invalid data'" \
    '"success":false'

# Test 13: Frontend Accessibility
run_test "Frontend Accessibility" \
    "curl -s -I http://localhost:3000" \
    "HTTP/1.1 200"

# Test 14: Frontend API Proxy
run_test "Frontend API Proxy" \
    "curl -s http://localhost:3000/api/health" \
    '"status":"healthy"'

# Clean up test files
rm -f /tmp/test.ldt /tmp/test.pdf

# Summary
echo ""
echo "=============================================="
echo "🧪 Test Summary"
echo "=============================================="
echo -e "${GREEN}Tests Passed: $TESTS_PASSED${NC}"
echo -e "${RED}Tests Failed: $TESTS_FAILED${NC}"
echo "Total Tests: $((TESTS_PASSED + TESTS_FAILED))"

if [ $TESTS_FAILED -eq 0 ]; then
    echo -e "${GREEN}🎉 All tests passed! The API is working correctly.${NC}"
    exit 0
else
    echo -e "${RED}❌ Some tests failed. Please check the output above.${NC}"
    exit 1
fi