#!/bin/bash
# Script para probar la API de mensajes
# Uso: ./test_messages.sh <TOKEN> <CONTACT_ID>

set -e

SERVER_URL="${SERVER_URL:-http://localhost:3000}"
API_BASE="$SERVER_URL/api/messages"
TOKEN="$1"
CONTACT_ID="$2"

if [ -z "$TOKEN" ] || [ -z "$CONTACT_ID" ]; then
  echo "Uso: $0 <TOKEN_DE_AUTENTICACION> <CONTACT_ID>"
  exit 1
fi

# Enviar mensaje
SEND_RESPONSE=$(curl -s -X POST "$API_BASE/$CONTACT_ID" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"content": "Hola desde script de test!"}')
echo "\n[POST] /api/messages/$CONTACT_ID (enviar mensaje)"
echo "$SEND_RESPONSE" | jq .

# Obtener mensajes pendientes
PENDING_RESPONSE=$(curl -s -X GET "$API_BASE/pending" -H "Authorization: Bearer $TOKEN")
echo "\n[GET] /api/messages/pending"
echo "$PENDING_RESPONSE" | jq .

# Obtener historial con contacto
HISTORIAL_RESPONSE=$(curl -s -X GET "$API_BASE/$CONTACT_ID" -H "Authorization: Bearer $TOKEN")
echo "\n[GET] /api/messages/$CONTACT_ID (historial)"
echo "$HISTORIAL_RESPONSE" | jq .
