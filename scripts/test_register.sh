#!/bin/bash

# Script para probar el registro de usuarios en la API
# Uso: ./test_register.sh [username] [email] [password]

# Colores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuración del servidor
# Usar localhost para pruebas locales o la URL pública para pruebas remotas
if [ -z "$SERVER_URL" ]; then
  # Detectar si el servidor está corriendo localmente
  if nc -z 127.0.0.1 3000 2>/dev/null; then
    SERVER_URL="https://api.qmessage.info"
    echo -e "${YELLOW}[MODO LOCAL] Conectando a servidor local${NC}"
  else
    SERVER_URL="https://api.qmessage.info"
    echo -e "${YELLOW}[MODO REMOTO] Conectando a servidor público${NC}"
  fi
fi

API_BASE="$SERVER_URL/api/auth"

# Variables por defecto - generar username único con timestamp
TIMESTAMP=$(date +%s)
USERNAME="${1:-user_$TIMESTAMP}"
EMAIL="${2:-user_$TIMESTAMP@test.com}"
PASSWORD="${3:-Test@12345ABC!}"

echo ""
echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}    PRUEBA DE REGISTRO DE USUARIO${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""
echo -e "${BLUE}Configuración:${NC}"
echo "   🌐 Servidor: $SERVER_URL"
echo "   👤 Username: $USERNAME"
echo "   📧 Email: $EMAIL"
echo "   🔑 Password: $PASSWORD"
echo ""

# 1. Intenta registrar un usuario
echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${YELLOW}PASO 1: Registrando nuevo usuario...${NC}"
echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

REGISTER_RESPONSE=$(curl -s -k -w "\n%{http_code}" -X POST "$API_BASE/register" \
  -H "Content-Type: application/json" \
  -d "{
    \"username\": \"$USERNAME\",
    \"email\": \"$EMAIL\",
    \"password\": \"$PASSWORD\"
  }")

# Separar body y status code
HTTP_BODY=$(echo "$REGISTER_RESPONSE" | head -n -1)
HTTP_STATUS=$(echo "$REGISTER_RESPONSE" | tail -n 1)

echo -e "📊 ${BLUE}Status HTTP:${NC} $HTTP_STATUS"
echo ""

# Verificar si el registro fue exitoso
if [ "$HTTP_STATUS" -eq 201 ]; then
  echo -e "${GREEN}✅ REGISTRO EXITOSO${NC}"
  echo ""
  echo -e "${BLUE}Respuesta del servidor:${NC}"
  echo "$HTTP_BODY" | jq '.' 2>/dev/null || echo "$HTTP_BODY"
  echo ""
  
  # Extraer datos del usuario
  USER_ID=$(echo "$HTTP_BODY" | jq -r '.user.id' 2>/dev/null)
  USER_EMAIL=$(echo "$HTTP_BODY" | jq -r '.user.email' 2>/dev/null)
  EMAIL_SENT=$(echo "$HTTP_BODY" | jq -r '.email_sent' 2>/dev/null)
  VERIFICATION_CODE=$(echo "$HTTP_BODY" | jq -r '.user.verification_code' 2>/dev/null)
  
  echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
  echo -e "${BLUE}Detalles del usuario:${NC}"
  echo "   🆔 User ID: $USER_ID"
  echo "   👤 Username: $USERNAME"
  echo "   📧 Email: $USER_EMAIL"
  echo "   📨 Email enviado: $EMAIL_SENT"
  [ "$VERIFICATION_CODE" != "null" ] && [ -n "$VERIFICATION_CODE" ] && echo "   🔐 Código verificación: $VERIFICATION_CODE"
  echo ""
  
  # 2. Probar verificación (si tenemos el código)
  if [ "$VERIFICATION_CODE" != "null" ] && [ -n "$VERIFICATION_CODE" ]; then
    echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${YELLOW}PASO 2: Verificando cuenta...${NC}"
    echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo ""
    
    VERIFY_RESPONSE=$(curl -s -k -w "\n%{http_code}" -X POST "$API_BASE/verify" \
      -H "Content-Type: application/json" \
      -d "{
        \"userId\": \"$USER_ID\",
        \"code\": \"$VERIFICATION_CODE\"
      }")
    
    VERIFY_BODY=$(echo "$VERIFY_RESPONSE" | head -n -1)
    VERIFY_STATUS=$(echo "$VERIFY_RESPONSE" | tail -n 1)
    
    echo -e "📊 ${BLUE}Status HTTP:${NC} $VERIFY_STATUS"
    echo ""
    
    if [ "$VERIFY_STATUS" -eq 200 ]; then
      echo -e "${GREEN}✅ VERIFICACIÓN EXITOSA${NC}"
      echo ""
      echo "$VERIFY_BODY" | jq '.' 2>/dev/null || echo "$VERIFY_BODY"
    else
      echo -e "${RED}❌ Error en verificación${NC}"
      echo "$VERIFY_BODY" | jq '.' 2>/dev/null || echo "$VERIFY_BODY"
    fi
    echo ""
  fi
  
  # 3. Probar login con el usuario verificado
  echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
  echo -e "${YELLOW}PASO 3: Probando LOGIN...${NC}"
  echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
  echo ""
  
  LOGIN_RESPONSE=$(curl -s -k -w "\n%{http_code}" -X POST "$API_BASE/login" \
    -H "Content-Type: application/json" \
    -d "{
      \"username\": \"$USERNAME\",
      \"password\": \"$PASSWORD\"
    }")
  
  LOGIN_BODY=$(echo "$LOGIN_RESPONSE" | head -n -1)
  LOGIN_STATUS=$(echo "$LOGIN_RESPONSE" | tail -n 1)
  
  echo -e "📊 ${BLUE}Status HTTP:${NC} $LOGIN_STATUS"
  echo ""
  
  TOKEN=$(echo "$LOGIN_BODY" | jq -r '.token' 2>/dev/null)
  
  if [ "$LOGIN_STATUS" -eq 200 ] && [ "$TOKEN" != "null" ] && [ -n "$TOKEN" ]; then
    echo -e "${GREEN}✅ LOGIN EXITOSO${NC}"
    echo ""
    echo "$LOGIN_BODY" | jq '.' 2>/dev/null || echo "$LOGIN_BODY"
    echo ""
    echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "🎟️  ${GREEN}Token JWT obtenido:${NC}"
    echo "$TOKEN"
  elif [ "$LOGIN_STATUS" -eq 403 ]; then
    echo -e "${YELLOW}⚠️  CUENTA NO VERIFICADA${NC}"
    echo ""
    echo "$LOGIN_BODY" | jq '.' 2>/dev/null || echo "$LOGIN_BODY"
    echo ""
    echo -e "${YELLOW}ℹ️  Debes verificar tu cuenta antes de hacer login${NC}"
  else
    echo -e "${RED}❌ ERROR EN LOGIN${NC}"
    echo ""
    echo "$LOGIN_BODY" | jq '.' 2>/dev/null || echo "$LOGIN_BODY"
  fi
  
elif [ "$HTTP_STATUS" -eq 409 ]; then
  echo -e "${RED}❌ USUARIO YA EXISTE${NC}"
  echo ""
  echo "$HTTP_BODY" | jq '.' 2>/dev/null || echo "$HTTP_BODY"
  echo ""
  echo -e "${YELLOW}💡 Prueba con otro username o email${NC}"
  
elif [ "$HTTP_STATUS" -eq 400 ]; then
  echo -e "${RED}❌ DATOS INVÁLIDOS${NC}"
  echo ""
  echo "$HTTP_BODY" | jq '.' 2>/dev/null || echo "$HTTP_BODY"
  echo ""
  echo -e "${YELLOW}Requisitos de contraseña:${NC}"
  echo "  • Mínimo 8 caracteres"
  echo "  • Al menos una mayúscula"
  echo "  • Al menos un número"
  echo "  • Al menos un carácter especial (!@#$%^&*)"
  
else
  echo -e "${RED}❌ ERROR EN EL REGISTRO${NC}"
  echo ""
  echo "$HTTP_BODY" | jq '.' 2>/dev/null || echo "$HTTP_BODY"
  echo ""
  echo -e "${YELLOW}Posibles causas:${NC}"
  echo "  • Servidor no está disponible en $SERVER_URL"
  echo "  • Problemas de red o firewall"
  echo "  • Error interno del servidor"
fi

echo ""
echo -e "${BLUE}========================================${NC}"
