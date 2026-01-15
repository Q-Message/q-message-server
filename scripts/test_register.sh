#!/usr/bin/env bash
set -euo pipefail

# Usage: ./scripts/test_register.sh [BASE_URL]
# Example: ./scripts/test_register.sh http://localhost:3000

BASE_URL=${1:-http://194.9.6.94:3000}

echo "Probando POST $BASE_URL/api/auth/register"

RESP=$(curl -s -w "\nHTTP_STATUS:%{http_code}\n" -X POST "$BASE_URL/api/auth/register" \
  -H "Content-Type: application/json" \
  -d '{"username":"jaimesanz","password":"nigga12345"}')

echo "$RESP"
