#!/bin/bash

# Script para probar el login en la API
# Uso: ./test_login.sh [username] [password]

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
USERNAME="${1:-manuelarrojo}"
PASSWORD="${2:-Manuelmarica123/}"

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}        PRUEBA DE LOGIN${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""

# 1. Intenta hacer login
echo -e "${YELLOW}1. Intentando LOGIN...${NC}"
echo "   Servidor: $SERVER_URL"
echo "   Username: $USERNAME"
echo ""

LOGIN_RESPONSE=$(curl -s -k -X POST "$API_BASE/login" \
  -H "Content-Type: application/json" \
  -d "$(cat <<EOF
{
  "username": "$USERNAME",
  "password": "$PASSWORD"
}
EOF
)")

echo -e "${BLUE}Respuesta:${NC}"
echo "$LOGIN_RESPONSE" | jq '.' 2>/dev/null || echo "$LOGIN_RESPONSE"
echo ""

# Extraer el token si el login fue exitoso
TOKEN=$(echo "$LOGIN_RESPONSE" | jq -r '.token' 2>/dev/null)

if [ "$TOKEN" != "null" ] && [ -n "$TOKEN" ]; then
  echo -e "${GREEN}✓ Login exitoso!${NC}"
  echo ""
  echo -e "${BLUE}Token obtenido:${NC}"
  echo "$TOKEN"
  echo ""
  
  # 2. Prueba usando el token en una solicitud protegida (ejemplo)
  echo -e "${YELLOW}2. Prueba: Usando el token en un header Authorization${NC}"
  echo "   Header: Authorization: Bearer $TOKEN"
  echo ""
  
  echo -e "${GREEN}Token listo para usar en solicitudes protegidas${NC}"
  echo ""
  echo -e "${YELLOW}Ejemplo de uso en curl:${NC}"
  echo "curl -X GET \"$SERVER_URL/api/ruta-protegida\" \\"
  echo "  -H \"Authorization: Bearer $TOKEN\""
  
else
  echo -e "${RED}✗ Error en el login${NC}"
  echo "Verifica que:"
  echo "  1. El servidor está corriendo en $SERVER_URL"
  echo "  2. El usuario '$USERNAME' existe"
  echo "  3. La contraseña es correcta"
fi

echo ""
echo -e "${BLUE}========================================${NC}"
