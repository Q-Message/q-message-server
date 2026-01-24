#!/bin/bash
# Script para probar el modelo de usuarios (API)
# Uso: ./test_users.sh <TOKEN>

set -e

SERVER_URL="${SERVER_URL:-http://localhost:3000}"
API_BASE="$SERVER_URL/api/users"
TOKEN="$1"

if [ -z "$TOKEN" ]; then
  echo "Uso: $0 <TOKEN_DE_AUTENTICACION>"
  exit 1
fi

# Obtener perfil de usuario
PROFILE_RESPONSE=$(curl -s -X GET "$API_BASE/profile" -H "Authorization: Bearer $TOKEN")
echo "\n[GET] /api/users/profile"
echo "$PROFILE_RESPONSE" | jq .

# (Puedes agregar aquí más pruebas de endpoints de usuario si existen)
