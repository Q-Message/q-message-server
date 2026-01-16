#!/bin/bash

# Script para probar el registro de usuarios en la API
# Uso: ./test_register.sh [username] [password]

# Colores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuración
SERVER_URL="${SERVER_URL:-https://194.9.6.94:3000}"
API_BASE="$SERVER_URL/api/auth"

# Variables por defecto
TIMESTAMP=$(date +%s)
USERNAME="${1:-pNigers1asasdd221123}"  # Username único con timestamp
PASSWORD="${2:-Test@13Ae1sad23AA!}"
EMAIL="${EMAIL:-palenciahugo17@gmail.com}"

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}        PRUEBA DE REGISTRO${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""

# 1. Intenta registrar un usuario
echo -e "${YELLOW}1. Intentando REGISTRO...${NC}"
echo "   Servidor: $SERVER_URL"
echo "   Username: $USERNAME"
echo "   Email: $EMAIL"
echo "   Password: $PASSWORD"
echo ""

REGISTER_RESPONSE=$(curl -s -k -X POST "$API_BASE/register" \
  -H "Content-Type: application/json" \
  -d "{
    \"username\": \"$USERNAME\",
    \"email\": \"$EMAIL\",
    \"password\": \"$PASSWORD\"
  }")

echo -e "${BLUE}Respuesta:${NC}"
echo "$REGISTER_RESPONSE" | jq '.' 2>/dev/null || echo "$REGISTER_RESPONSE"
echo ""

# Verificar si el registro fue exitoso
USER_ID=$(echo "$REGISTER_RESPONSE" | jq -r '.user.id' 2>/dev/null)
USER_EMAIL=$(echo "$REGISTER_RESPONSE" | jq -r '.user.email' 2>/dev/null)
EMAIL_SENT=$(echo "$REGISTER_RESPONSE" | jq -r '.email_sent' 2>/dev/null)
VERIFICATION_CODE=$(echo "$REGISTER_RESPONSE" | jq -r '.user.verification_code' 2>/dev/null)

if [ "$USER_ID" != "null" ] && [ -n "$USER_ID" ]; then
  echo -e "${GREEN}✓ Registro exitoso!${NC}"
  echo ""
  echo -e "${BLUE}Datos del usuario creado:${NC}"
  echo "$REGISTER_RESPONSE" | jq '.user' 2>/dev/null
  echo ""
  echo -e "${BLUE}Email enviado?:${NC} ${EMAIL_SENT}"
  [ -n "$VERIFICATION_CODE" ] && echo -e "${BLUE}Código de verificación:${NC} $VERIFICATION_CODE" && echo ""
  
  # 2. Ahora prueba hacer login con el usuario registrado
  echo -e "${YELLOW}2. Probando LOGIN con el usuario registrado...${NC}"
  echo ""
  
  LOGIN_RESPONSE=$(curl -s -k -X POST "$API_BASE/login" \
    -H "Content-Type: application/json" \
    -d "{
      \"username_or_email\": \"$EMAIL\",
      \"password\": \"$PASSWORD\"
    }")
  
  echo -e "${BLUE}Respuesta del login:${NC}"
  echo "$LOGIN_RESPONSE" | jq '.' 2>/dev/null || echo "$LOGIN_RESPONSE"
  echo ""
  
  TOKEN=$(echo "$LOGIN_RESPONSE" | jq -r '.token' 2>/dev/null)
  
  if [ "$TOKEN" != "null" ] && [ -n "$TOKEN" ]; then
    echo -e "${GREEN}✓ Login también exitoso!${NC}"
    echo ""
    echo -e "${BLUE}Token obtenido:${NC}"
    echo "$TOKEN"
  else
    echo -e "${RED}✗ Error en el login${NC}"
  fi
  
else
  echo -e "${RED}✗ Error en el registro${NC}"
  echo "Posibles causas:"
  echo "  - Usuario ya existe"
  echo "  - Contraseña no cumple requisitos"
  echo "  - Servidor no está disponible"
fi

echo ""
echo -e "${BLUE}========================================${NC}"
