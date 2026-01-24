#!/bin/bash
# Script de prueba para registro con email y login
# Uso: bash scripts/test_register_with_email.sh

echo " Probando registro CON EMAIL..."
echo ""

# URL del servidor
SERVER="http://localhost:3000"

# Datos de prueba
USERNAME="testuser_$(date +%s)"
EMAIL="test_$(date +%s)@example.com"
PASSWORD="SecurePass123!"

echo "Intentando registrar:"
echo "  Username: $USERNAME"
echo "  Email: $EMAIL"
echo "  Password: $PASSWORD"
echo ""

# Hacer la petición de registro
RESPONSE=$(curl -s -X POST "$SERVER/api/auth/register" \
  -H "Content-Type: application/json" \
  -d "{\"username\": \"$USERNAME\",\"email\": \"$EMAIL\",\"password\": \"$PASSWORD\"}")

echo "Respuesta del servidor:"
echo "$RESPONSE" | jq .
echo ""

echo "---"
echo "🔑 Probando login CON USERNAME..."
LOGIN_RESPONSE=$(curl -s -X POST "$SERVER/api/auth/login" \
  -H "Content-Type: application/json" \
  -d "{\"username\": \"$USERNAME\", \"password\": \"$PASSWORD\"}")

echo "Respuesta:"
echo "$LOGIN_RESPONSE" | jq .
echo ""

echo " Pruebas completadas"