#!/bin/bash

# Script de prueba para el sistema de contactos

echo "========================================"
echo "🧪 Test: Sistema de Contactos"
echo "========================================"
echo ""

BASE_URL="https://api.qmessage.info"
CURL_OPTS="-k -s"

# Permitir usar usuarios existentes marcando USE_EXISTING=true
USE_EXISTING=${USE_EXISTING:-true}
EXISTING_USER1_USERNAME=${EXISTING_USER1_USERNAME:-"alice_1768822237"}
EXISTING_USER1_PASS=${EXISTING_USER1_PASS:-"Alice123!1768822237"}
EXISTING_USER2_USERNAME=${EXISTING_USER2_USERNAME:-"bob_1768822237"}
EXISTING_USER2_PASS=${EXISTING_USER2_PASS:-"Bob123!1768822237"}

# Colores
GREEN='\033[0;32m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m'

if [ "$USE_EXISTING" = "true" ]; then
  USER1_USERNAME="$EXISTING_USER1_USERNAME"
  USER1_PASS="$EXISTING_USER1_PASS"
  USER2_USERNAME="$EXISTING_USER2_USERNAME"
  USER2_PASS="$EXISTING_USER2_PASS"
else
  # Generar credenciales aleatorias
  TIMESTAMP=$(date +%s)
  USER1_USERNAME="alice_${TIMESTAMP}"
  USER1_EMAIL="alice_${TIMESTAMP}@test.com"
  USER1_PASS="Alice123!${TIMESTAMP}"

  USER2_USERNAME="bob_${TIMESTAMP}"
  USER2_EMAIL="bob_${TIMESTAMP}@test.com"
  USER2_PASS="Bob123!${TIMESTAMP}"
fi

# ==========================================
# 1. REGISTRAR USUARIO 1
# ==========================================
if [ "$USE_EXISTING" = "true" ]; then
  echo -e "${BLUE}1️⃣ Usando Usuario 1 existente ($USER1_USERNAME)${NC}"
  USER1_ID="(preexistente)"
else
  echo -e "${BLUE}1️⃣ Registrando Usuario 1 ($USER1_USERNAME)...${NC}"
  REGISTER1=$(curl $CURL_OPTS -X POST "$BASE_URL/api/auth/register" \
    -H "Content-Type: application/json" \
    -d "{\"username\": \"$USER1_USERNAME\", \"email\": \"$USER1_EMAIL\", \"password\": \"$USER1_PASS\"}")

  USER1_ID=$(echo "$REGISTER1" | jq -r '.user.id')
  if [ "$USER1_ID" = "null" ] || [ -z "$USER1_ID" ]; then
    echo -e "   ${RED}❌ Error en registro${NC}"
    echo "$REGISTER1" | jq '.'
    exit 1
  fi
  echo "   ✅ Usuario registrado (ID: $USER1_ID)"
  echo ""
fi

# ==========================================
# 2. REGISTRAR USUARIO 2
# ==========================================
if [ "$USE_EXISTING" = "true" ]; then
  echo -e "${BLUE}2️⃣ Usando Usuario 2 existente ($USER2_USERNAME)${NC}"
  USER2_ID="(preexistente)"
else
  echo -e "${BLUE}2️⃣ Registrando Usuario 2 ($USER2_USERNAME)...${NC}"
  REGISTER2=$(curl $CURL_OPTS -X POST "$BASE_URL/api/auth/register" \
    -H "Content-Type: application/json" \
    -d "{\"username\": \"$USER2_USERNAME\", \"email\": \"$USER2_EMAIL\", \"password\": \"$USER2_PASS\"}")

  USER2_ID=$(echo "$REGISTER2" | jq -r '.user.id')
  if [ "$USER2_ID" = "null" ] || [ -z "$USER2_ID" ]; then
    echo -e "   ${RED}❌ Error en registro${NC}"
    echo "$REGISTER2" | jq '.'
    exit 1
  fi
  echo "   ✅ Usuario registrado (ID: $USER2_ID)"
  echo ""
fi

# ==========================================
# 3. LOGIN USUARIO 1
# ==========================================
echo -e "${BLUE}3️⃣ Login Usuario 1 ($USER1_USERNAME)...${NC}"
LOGIN1=$(curl $CURL_OPTS -X POST "$BASE_URL/api/auth/login" \
  -H "Content-Type: application/json" \
  -d "{\"username\": \"$USER1_USERNAME\", \"password\": \"$USER1_PASS\"}")

TOKEN1=$(echo "$LOGIN1" | jq -r '.token')
if [ "$TOKEN1" = "null" ] || [ -z "$TOKEN1" ]; then
  echo -e "   ${RED}❌ Error en login${NC}"
  echo "$LOGIN1" | jq '.'
  exit 1
fi
echo "   ✅ Token obtenido"
echo ""

# ==========================================
# 4. USUARIO 1 GENERA LINK DE INVITACIÓN
# ==========================================
echo -e "${BLUE}4️⃣ $USER1_USERNAME genera link de invitación...${NC}"
SHARE_LINK=$(curl $CURL_OPTS -X GET "$BASE_URL/api/contacts/share-link" \
  -H "Authorization: Bearer $TOKEN1")

INVITE_TOKEN=$(echo "$SHARE_LINK" | jq -r '.token')
INVITE_LINK=$(echo "$SHARE_LINK" | jq -r '.link')

if [ "$INVITE_TOKEN" = "null" ] || [ -z "$INVITE_TOKEN" ]; then
  echo -e "   ${RED}❌ Error generando link${NC}"
  echo "$SHARE_LINK" | jq '.'
  exit 1
fi

echo "   ✅ Link generado: $INVITE_LINK"
echo "   📋 Token: ${INVITE_TOKEN:0:20}..."
echo ""

# ==========================================
# 5. LOGIN USUARIO 2
# ==========================================
echo -e "${BLUE}5️⃣ Login Usuario 2 ($USER2_USERNAME)...${NC}"
LOGIN2=$(curl $CURL_OPTS -X POST "$BASE_URL/api/auth/login" \
  -H "Content-Type: application/json" \
  -d "{\"username\": \"$USER2_USERNAME\", \"password\": \"$USER2_PASS\"}")

TOKEN2=$(echo "$LOGIN2" | jq -r '.token')
USER2_ID=$(echo "$LOGIN2" | jq -r '.user.id')
if [ "$TOKEN2" = "null" ] || [ -z "$TOKEN2" ]; then
  echo -e "   ${RED}❌ Error en login${NC}"
  echo "$LOGIN2" | jq '.'
  exit 1
fi
echo "   ✅ Token obtenido"
echo ""

# ==========================================
# 6. USUARIO 2 USA EL LINK PARA AGREGAR A USUARIO 1
# ==========================================
echo -e "${BLUE}6️⃣ $USER2_USERNAME usa el link para agregar a $USER1_USERNAME como contacto...${NC}"
echo "   DEBUG - Token: ${INVITE_TOKEN:0:30}..."
echo "   DEBUG - USER2_ID: $USER2_ID"
ADD_CONTACT=$(curl $CURL_OPTS -X POST "$BASE_URL/api/contacts/add-from-link" \
  -H "Authorization: Bearer $TOKEN2" \
  -H "Content-Type: application/json" \
  -d "{\"token\": \"$INVITE_TOKEN\"}")

echo "   DEBUG - Respuesta completa:"
echo "$ADD_CONTACT" | jq '.'

if echo "$ADD_CONTACT" | jq -e '.success' > /dev/null 2>&1; then
  echo -e "   ${GREEN}✅ Contacto agregado correctamente${NC}"
else
  echo -e "   ${RED}❌ Error agregando contacto${NC}"
fi
echo ""

# ==========================================
# 5. USUARIO 2 LISTA SUS CONTACTOS
# ==========================================
echo -e "${BLUE}7️⃣ $USER2_USERNAME lista sus contactos...${NC}"
USER2_CONTACTS=$(curl $CURL_OPTS -X GET "$BASE_URL/api/contacts" \
  -H "Authorization: Bearer $TOKEN2")

echo "$USER2_CONTACTS" | jq '.'
echo ""

# ==========================================
# 6. USUARIO 1 LISTA SUS CONTACTOS
# ==========================================
echo -e "${BLUE}8️⃣ $USER1_USERNAME lista sus contactos...${NC}"
USER1_CONTACTS=$(curl $CURL_OPTS -X GET "$BASE_URL/api/contacts" \
  -H "Authorization: Bearer $TOKEN1")

echo "$USER1_CONTACTS" | jq '.'
echo ""

# ==========================================
# 9. USUARIO 2 ELIMINA EL CONTACTO
# ==========================================
echo -e "${BLUE}9️⃣ $USER2_USERNAME elimina a $USER1_USERNAME de sus contactos...${NC}"
echo "   DEBUG - Eliminando contacto con ID: $USER1_ID"
DELETE_CONTACT=$(curl $CURL_OPTS -X DELETE "$BASE_URL/api/contacts/$USER1_ID" \
  -H "Authorization: Bearer $TOKEN2")

echo "   DEBUG - Respuesta completa:"
echo "$DELETE_CONTACT" | jq '.'

if echo "$DELETE_CONTACT" | jq -e '.success' > /dev/null 2>&1; then
  echo -e "   ${GREEN}✅ Contacto eliminado correctamente${NC}"
else
  echo -e "   ${RED}❌ Error eliminando contacto${NC}"
fi
echo ""

# ==========================================
# 10. VERIFICAR QUE SE ELIMINÓ
# ==========================================
echo -e "${BLUE}🔟 Verificando que el contacto fue eliminado...${NC}"
USER2_CONTACTS_AFTER=$(curl $CURL_OPTS -X GET "$BASE_URL/api/contacts" \
  -H "Authorization: Bearer $TOKEN2")

CONTACT_COUNT=$(echo "$USER2_CONTACTS_AFTER" | jq '.contacts | length')
if [ "$CONTACT_COUNT" = "0" ]; then
  echo -e "   ${GREEN}✅ Contacto eliminado correctamente (lista vacía)${NC}"
else
  echo -e "   ${RED}❌ Error: aún hay $CONTACT_COUNT contactos${NC}"
fi
echo ""

echo "========================================"
echo -e "${GREEN}✨ Test completado${NC}"
echo "========================================"
