# Seguridad de Q-Message Server

Este documento explica todas las medidas de seguridad implementadas en el servidor de registro y autenticación.

---

## 1. Validación de Contraseña Fuerte

### Requisitos implementados (función `validatePasswordStrength`):
- **Mínimo 8 caracteres** — evita contraseñas cortas fáciles de romper.
- **Al menos una mayúscula (A-Z)** — aumenta el espacio de caracteres.
- **Al menos un número (0-9)** — añade complejidad.
- **Al menos un carácter especial** — hace que sean resistentes a ataques de diccionario.
  - Caracteres válidos: `!@#$%^&*()_+-=[]{};':"\\|,.<>/?`

### Ejemplo de contraseña válida:
```
MyPassword123!
```

### Respuesta si falla validación (400 Bad Request):
```json
{
  "error": "Password must be at least 8 characters long"
}
```

---

## 2. Rate Limiting (Protección contra Fuerza Bruta)

### Implementación:
- **Límite**: máximo **3 intentos de registro** por IP en **15 minutos**.
- **Middleware**: `express-rate-limit` aplicado al endpoint `/api/auth/register`.

### Cómo funciona:
1. Rastreo por IP del cliente.
2. Si se excede el límite, devuelve **429 Too Many Requests**.
3. Los headers HTTP `RateLimit-*` indican el estado actual de límites.

### Respuesta cuando se excede límite:
```json
{
  "error": "Too many registration attempts, please try again later"
}
```

### Headers devueltos:
```
RateLimit-Limit: 3
RateLimit-Remaining: 0
RateLimit-Reset: 1642000000
```

---

## 3. Validación de Username

### Reglas de username:
- **Longitud**: entre 3 y 50 caracteres.
- **Caracteres permitidos**: solo alfanuméricos, guión (`-`) y guión bajo (`_`).
  - Regex: `^[a-zA-Z0-9_-]+$`
- **Prevención**: evita inyección de SQL y XSS mediante restricción estricta.

### Ejemplos válidos:
- `user123`
- `my-user`
- `my_user`

### Ejemplos inválidos:
- `my user` — contiene espacio (error 400)
- `user@domain` — contiene `@` (error 400)
- `ab` — muy corto (error 400)

---

## 4. Manejo de Username Duplicado (Constraint Unique)

### Implementación:
- Se detecta el código SQL **23505** (unique constraint violation).
- Se devuelve una respuesta **409 Conflict** clara al cliente.

### Respuesta:
```json
{
  "error": "Username already exists"
}
```

### Por qué esto es importante:
- **Previene duplicados** en la base de datos.
- **No expone detalles internos** (error genérico de DB).
- **Guía al usuario** a elegir otro username.

---

## 5. HTTPS / TLS (Cifrado de Tránsito)

### Configuración:
- **Por defecto**: el servidor arranca en HTTP (puerto 3000).
- **HTTPS opcional**: se habilita definiendo variables de entorno:
  - `TLS_CERT` — ruta al archivo de certificado (PEM format).
  - `TLS_KEY` — ruta al archivo de clave privada (PEM format).

### Cómo activar HTTPS:

#### Opción 1: Generar certificado self-signed (desarrollo):
```bash
# Generar una clave privada RSA de 2048 bits
openssl genrsa -out server.key 2048

# Generar un certificado autofirmado válido por 365 días
openssl req -new -x509 -key server.key -out server.crt -days 365 \
  -subj "/C=ES/ST=State/L=City/O=Q-Message/CN=localhost"

# Crear directorio de certs (opcional)
mkdir -p certs
mv server.key server.crt certs/
```

#### Opción 2: Usar certificado válido (producción):
- Obtén un certificado de una Autoridad Certificadora (Let's Encrypt, DigiCert, etc.).
- Coloca los archivos en una ruta segura (permisos 600).

#### Arrancar el servidor con HTTPS:
```bash
TLS_CERT=certs/server.crt TLS_KEY=certs/server.key node server.js
```

#### Verificar HTTPS está activo:
```bash
curl -i -k https://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"username":"testuser","password":"TestPass1!"}'
```

**Nota**: El flag `-k` ignora validación de certificado self-signed (desarrollo). En producción, no uses `-k`.

---

## 6. No Exponerse sin Autenticación

### Endpoints sensibles (recomendación):
- `/api/auth/register` — actualmente público (como se desea para permitir nuevos usuarios).
- Endpoints futuros (obtener perfil, actualizar datos, listar usuarios) **deben requerir JWT**.

### Cómo proteger endpoints con JWT:
```javascript
const verifyJWT = (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Unauthorized' });
  
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(403).json({ error: 'Invalid token' });
  }
};

// Aplicar middleware a rutas sensibles
app.get('/api/user/profile', verifyJWT, (req, res) => { ... });
```

---

## 7. Resumen de Códigos HTTP (Seguridad)

| Código | Significado | Motivo |
|--------|-------------|--------|
| 201 | Created | Usuario creado exitosamente |
| 400 | Bad Request | Validación fallida (contraseña débil, username inválido) |
| 409 | Conflict | Username ya existe (constraint unique) |
| 429 | Too Many Requests | Rate limit excedido (3 intentos en 15 min) |
| 500 | Internal Server Error | Error en DB u otro error interno |

---

## 8. Variables de Entorno Recomendadas

```bash
# Seguridad
NODE_ENV=production
JWT_SECRET=tu_secreto_muy_largo_y_aleatorio

# Red
HOST=0.0.0.0          # Escucha en todas las interfaces
PORT=3000             # Puerto HTTP
CORS_ORIGIN=https://mi-app.example  # Restringir CORS (producción)

# TLS/HTTPS (producción)
TLS_CERT=certs/server.crt
TLS_KEY=certs/server.key

# Base de datos
DB_USER=postgres
DB_HOST=localhost
DB_NAME=q_message
DB_PASSWORD=tu_password
DB_PORT=5432
```

---

## 9. Checklist de Seguridad para Producción

- [ ] Generar certificado TLS válido (Let's Encrypt / CA).
- [ ] Activar HTTPS (TLS_CERT, TLS_KEY).
- [ ] Restringir CORS_ORIGIN a dominio concreto (no `*`).
- [ ] Implementar login con JWT (no solo registro público).
- [ ] Proteger endpoints con middleware JWT.
- [ ] Configurar firewall para permitir solo puertos 80/443 (HTTP/HTTPS).
- [ ] Habilitar HTTPS redirect (HTTP → HTTPS).
- [ ] Usar contrasena fuerte en DB_PASSWORD.
- [ ] Habilitar logging y monitoring.
- [ ] Considerar fail2ban para rate limiting global (además del local).
- [ ] Implementar CAPTCHA si sospechas bots.
- [ ] Validar email en registro (confirmación).

---

## 10. Pruebas de Seguridad

### Test 1: Contraseña débil (debe fallar)
```bash
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"username":"testuser","password":"weak"}'
# Respuesta: 400 (password too short)
```

### Test 2: Rate limiting (debe bloquear después de 3 intentos)
```bash
for i in {1..4}; do
  curl -X POST http://localhost:3000/api/auth/register \
    -H "Content-Type: application/json" \
    -d '{"username":"user'$i'","password":"BadPass"}'
done
# Los primeros 3 fallarán por validación, el 4º por rate limit (429)
```

### Test 3: Username duplicado (debe devolver 409)
```bash
# Primer registro (éxito)
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"username":"testuser","password":"ValidPass123!"}'

# Segundo registro con mismo username (debe fallar)
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"username":"testuser","password":"OtherPass456!"}'
# Respuesta: 409 (Username already exists)
```

---

## 11. Próximas mejoras recomendadas

- [ ] 2FA (Two-Factor Authentication) con TOTP.
- [ ] Email verification en registro.
- [ ] Password reset flow seguro.
- [ ] Audit logging de intentos fallidos.
- [ ] IP whitelisting (si es aplicable).
- [ ] Protección contra CSRF en formularios.
- [ ] CSP (Content Security Policy) headers.

---

**Última actualización**: 15/01/2026
**Autor**: GitHub Copilot + Q-Message Team
