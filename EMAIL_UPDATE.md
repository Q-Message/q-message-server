# Email en Autenticación - Guía de Actualización

## 📧 Cambios Realizados

La aplicación ahora requiere **email obligatorio en el registro** y permite **login con username O email**.

### Cambios en la Base de Datos

Se añadió la columna `email` a la tabla `users`:
- **Tipo**: VARCHAR(255)
- **Único**: Sí (constraint UNIQUE)
- **Nullable**: No (requerido)

### Cambios en la API

#### 1. Registro (POST /api/auth/register)

**Antes:**
```json
{
  "username": "john_doe",
  "password": "SecurePass123!"
}
```

**Ahora:**
```json
{
  "username": "john_doe",
  "email": "john@example.com",
  "password": "SecurePass123!"
}
```

**Validaciones:**
- `username`: 3-50 caracteres, alfanuméricos + `-` y `_`
- `email`: Formato válido (xxx@yyy.zzz)
- `password`: 8+ caracteres, mayúscula, número, carácter especial

**Respuestas:**
- `201 Created`: Éxito
- `400 Bad Request`: Validación fallida
- `409 Conflict`: Email o username ya existe
- `429 Too Many Requests`: Rate limit (3 intentos/15 min)

#### 2. Login (POST /api/auth/login)

**Cambio:** El campo `username` pasó a llamarse `username_or_email`

**Opción A - Login con username:**
```json
{
  "username_or_email": "john_doe",
  "password": "SecurePass123!"
}
```

**Opción B - Login con email:**
```json
{
  "username_or_email": "john@example.com",
  "password": "SecurePass123!"
}
```

**Respuesta (200 OK):**
```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "username": "john_doe",
    "email": "john@example.com",
    "public_key_quantum": "..."
  }
}
```

## 🚀 Pasos de Instalación

### 1. Ejecutar la migración de BD

```bash
node scripts/migrate-add-email.js
```

Esto:
- Añade la columna `email` a la tabla `users`
- Crea un índice único para el email
- Crea un constraint UNIQUE

### 2. Reiniciar el servidor

```bash
npm start
```

### 3. Probar el nuevo sistema

```bash
bash scripts/test_register_with_email.sh
```

O manualmente con curl:

```bash
# Registro
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "username": "testuser",
    "email": "test@example.com",
    "password": "SecurePass123!"
  }'

# Login con email
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "username_or_email": "test@example.com",
    "password": "SecurePass123!"
  }'

# Login con username
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "username_or_email": "testuser",
    "password": "SecurePass123!"
  }'
```

## 📝 Funciones Nuevas del Modelo

Se añadieron al módulo `models/users.js`:

```javascript
// Buscar usuario por email
async getUserByEmail(email)

// Buscar usuario por username O email (para login flexible)
async getUserByUsernameOrEmail(identifier)

// Validar formato de email
function validateEmailFormat(email)
```

## 🔒 Seguridad

- ✅ Email único (constraint UNIQUE en BD)
- ✅ Validación de formato de email (regex)
- ✅ Contraseñas con bcrypt (10 rounds)
- ✅ Rate limiting (3 reg/15min, 5 login/15min)
- ✅ SQL injection prevention (prepared statements)
- ✅ JWT tokens (24h expiry)
- ✅ Logging de intentos fallidos

## 🔄 Migración de Usuarios Existentes

Si tienes usuarios existentes sin email, tienes dos opciones:

**Opción 1:** Hacer email nullable temporalmente
```sql
ALTER TABLE users ALTER COLUMN email DROP NOT NULL;
```

**Opción 2:** Generar emails automáticos para usuarios existentes
```sql
UPDATE users 
SET email = username || '@local.invalid' 
WHERE email IS NULL;
```

Después hacer email NOT NULL:
```sql
ALTER TABLE users ALTER COLUMN email SET NOT NULL;
```

## 📊 Cambios en la Estructura de Datos

### JWT Token

**Antes:**
```json
{
  "id": "...",
  "username": "..."
}
```

**Ahora:**
```json
{
  "id": "...",
  "username": "...",
  "email": "..."
}
```

### Response de Login

Se añadió el campo `email` en la respuesta del usuario.

## ❓ FAQ

**P: ¿Puedo tener dos usuarios con el mismo email?**  
R: No, hay un constraint UNIQUE en la columna email.

**P: ¿Puedo cambiar el email después del registro?**  
R: Aún no, eso se implementará en una futura versión.

**P: ¿Qué pasa si intento registrar sin email?**  
R: Recibirás un error 400: "username, email and password required"

**P: ¿Funcionan los tokens JWT antiguos?**  
R: Los tokens anteriores seguirán siendo válidos hasta que expiren (24h). Los tokens nuevos incluirán el email.

## 📞 Soporte

Si encuentras problemas:
1. Verifica que la migración se ejecutó correctamente: `node scripts/migrate-add-email.js`
2. Revisa los logs: `cat src/logs/error.log`
3. Prueba con el script: `bash scripts/test_register_with_email.sh`
