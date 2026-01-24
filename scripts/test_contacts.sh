#!/bin/bash
# Script para probar la API de contactos
# Uso: ./test_contacts.sh <TOKEN>

set -e

SERVER_URL="${SERVER_URL:-http://localhost:3000}"
API_BASE="$SERVER_URL/api/contacts"
TOKEN="$1"

if [ -z "$TOKEN" ]; then
  echo "Uso: $0 <TOKEN_DE_AUTENTICACION>"
  exit 1
fi

# Compartir enlace
RESPONSE=$(curl -s -X GET "$API_BASE/share-link" -H "Authorization: Bearer $TOKEN")
echo "\n[GET] /api/contacts/share-link"
echo "$RESPONSE" | jq .

# Simular añadir contacto desde link (requiere token de invitación)
INVITE_TOKEN=$(echo "$RESPONSE" | jq -r .token)
if [ "$INVITE_TOKEN" != "null" ]; then
  ADD_RESPONSE=$(curl -s -X POST "$API_BASE/add-from-link" \
    -H "Authorization: Bearer $TOKEN" \
    -H "Content-Type: application/json" \
    -d "{\"token\": \"$INVITE_TOKEN\"}")
  echo "\n[POST] /api/contacts/add-from-link"
  echo "$ADD_RESPONSE" | jq .
else
  echo "No se pudo obtener token de invitación para probar add-from-link."
fi

# Listar contactos
LIST_RESPONSE=$(curl -s -X GET "$API_BASE/list" -H "Authorization: Bearer $TOKEN")
echo "\n[GET] /api/contacts/list"
echo "$LIST_RESPONSE" | jq .
