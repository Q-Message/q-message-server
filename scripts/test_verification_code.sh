#!/bin/bash

# Script de prueba para el sistema de códigos de verificación

echo "========================================"
echo "🧪 Test: Códigos de Verificación"
echo "========================================"
echo ""

# URLs
BASE_URL="https://localhost:3000"

# Ignorar certificados autofirmados para desarrollo
CURL_OPTS="-k -s -X POST"

# 1. Test: Registro con código de verificación
echo "1️⃣ Test: Registrarse (con código de verificación)"
echo "────────────────────────────────────"

TIMESTAMP=$(date +%s)
TEST_USERNAME="testuser_${TIMESTAMP}"
TEST_EMAIL="testuser_${TIMESTAMP}@example.com"
TEST_PASSWORD="SecurePass123!"

REGISTER_RESPONSE=$(curl $CURL_OPTS \
  -H "Content-Type: application/json" \
  -d "{
    \"username\": \"$TEST_USERNAME\",
    \"email\": \"$TEST_EMAIL\",
    \"password\": \"$TEST_PASSWORD\"
  }" \
  "$BASE_URL/api/auth/register")

echo "Request:"
echo "  POST /api/auth/register"
echo "  {\"username\": \"$TEST_USERNAME\", \"email\": \"$TEST_EMAIL\", \"password\": \"$TEST_PASSWORD\"}"
echo ""

echo "Response:"
echo "$REGISTER_RESPONSE" | jq '.' 2>/dev/null || echo "$REGISTER_RESPONSE"
echo ""

# Extraer el ID y código de verificación
USER_ID=$(echo "$REGISTER_RESPONSE" | jq -r '.user.id // empty' 2>/dev/null)
VERIFICATION_CODE=$(echo "$REGISTER_RESPONSE" | jq -r '.user.verification_code // empty' 2>/dev/null)

if [ -z "$USER_ID" ]; then
  echo "❌ Error: No se pudo extraer el ID del usuario"
  exit 1
fi

if [ -z "$VERIFICATION_CODE" ]; then
  echo "❌ Error: No se recibió código de verificación"
  exit 1
fi

echo "✅ Usuario registrado:"
echo "   ID: $USER_ID"
echo "   Email: $TEST_EMAIL"
echo "   Código de verificación: $VERIFICATION_CODE"
echo ""

# 2. Test: Login
echo "2️⃣ Test: Loguearse con la cuenta nueva"
echo "────────────────────────────────────"

LOGIN_RESPONSE=$(curl $CURL_OPTS \
  -H "Content-Type: application/json" \
  -d "{
    \"username_or_email\": \"$TEST_EMAIL\",
    \"password\": \"$TEST_PASSWORD\"
  }" \
  "$BASE_URL/api/auth/login")

echo "Request:"
echo "  POST /api/auth/login"
echo "  {\"username_or_email\": \"$TEST_EMAIL\", \"password\": \"$TEST_PASSWORD\"}"
echo ""

echo "Response:"
echo "$LOGIN_RESPONSE" | jq '.' 2>/dev/null || echo "$LOGIN_RESPONSE"
echo ""

# 3. Test: Información general
echo "3️⃣ Información del test"
echo "────────────────────────────────────"
echo "✅ Los siguientes datos se han creado:"
echo "   Username: $TEST_USERNAME"
echo "   Email: $TEST_EMAIL"
echo "   Verification Code: $VERIFICATION_CODE (válido por 5 minutos)"
echo "   User ID: $USER_ID"
echo ""

echo "📝 Próximos pasos:"
echo "   1. Guardar el código de verificación: $VERIFICATION_CODE"
echo "   2. El código expira en 5 minutos desde la creación"
echo "   3. Más adelante, puedes implementar:"
echo "      - GET /api/auth/verify/:userId/:code"
echo "      - Marcar usuario como verificado"
echo ""
echo "✨ Test completado"
