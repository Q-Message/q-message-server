# Q-Message Server

Backend del sistema de mensajería segura Q-Message, desarrollado como Trabajo de Fin de Grado del Ciclo Superior de Desarrollo de Aplicaciones Multiplataforma.

## Descripción

Servidor Node.js que proporciona una API REST y comunicación en tiempo real mediante WebSockets para una aplicación de mensajería instantánea con cifrado extremo a extremo. El sistema permite el intercambio de mensajes entre usuarios registrados, gestión de contactos y notificaciones en tiempo real.

## Tecnologías

- **Node.js** 18+ con Express 5
- **Socket.io** 4.8 para comunicación bidireccional en tiempo real
- **PostgreSQL** como sistema de gestión de base de datos
- **JWT** para autenticación stateless
- **Bcrypt** para hashing seguro de contraseñas
- **Helmet.js** para headers de seguridad HTTP
- **Express Rate Limit** para prevención de ataques de fuerza bruta

## Arquitectura

El servidor sigue una arquitectura modular basada en capas:

```
├── src/
│   ├── config/         # Configuración de base de datos
│   ├── middleware/     # Middlewares de autenticación
│   ├── models/         # Modelos de datos y lógica de negocio
│   ├── routes/         # Definición de endpoints REST
│   ├── sockets/        # Handlers de eventos Socket.io
│   └── utils/          # Utilidades (logging, email)
├── scripts/            # Scripts de testing
└── server.js           # Punto de entrada de la aplicación
```

### Flujo de Comunicación

1. **Autenticación**: El cliente se registra/inicia sesión mediante API REST y recibe un JWT.
2. **Conexión WebSocket**: El cliente se conecta al servidor Socket.io usando el JWT como credencial.
3. **Mensajería en Tiempo Real**: Los mensajes se enrutan a través del servidor hacia el destinatario si está conectado.
4. **Persistencia**: Si el destinatario está offline, los mensajes se almacenan en la base de datos para entrega posterior.

## Instalación

### Prerrequisitos

- Node.js 18 o superior
- PostgreSQL 12 o superior
- npm o yarn

### Configuración

1. Clonar el repositorio:
```bash
git clone https://github.com/TFGDAM/q-message-server.git
cd q-message-server
```

2. Instalar dependencias:
```bash
npm install
```

3. Configurar variables de entorno:
```bash
cp .env.example .env
```

Editar `.env` con los valores correspondientes:
```env
JWT_SECRET=tu_clave_secreta_minimo_32_caracteres
DB_USER=postgres
DB_PASSWORD=tu_password
DB_HOST=localhost
DB_PORT=5432
DB_NAME=q_message
CORS_ORIGIN=*
PORT=3000
```

4. Crear la base de datos:
```sql
CREATE DATABASE q_message;
```

Ejecutar las migraciones SQL para crear las tablas necesarias (users, contacts, pending_messages).

5. Iniciar el servidor:
```bash
npm start
```

El servidor estará disponible en `http://localhost:3000`.

## Endpoints API

### Autenticación

- `POST /api/auth/register` - Registro de nuevo usuario
- `POST /api/auth/login` - Inicio de sesión
- `POST /api/auth/verify` - Verificar código de email
- `POST /api/auth/resend` - Reenviar código de verificación

### Contactos

- `GET /api/contacts` - Listar contactos del usuario
- `GET /api/contacts/share-link` - Generar enlace de invitación
- `POST /api/contacts/add-from-link` - Agregar contacto mediante enlace
- `DELETE /api/contacts/:contactId` - Eliminar contacto

### Mensajes

- `GET /api/messages/pending` - Recuperar mensajes pendientes
- `GET /api/messages/:contactId` - Historial con un contacto

### Eventos Socket.io

**Cliente → Servidor:**
- `send-message` - Enviar mensaje a un contacto
- `typing-indicator` - Notificar que se está escribiendo
- `message-read` - Confirmar lectura de mensaje
- `set-status` - Cambiar estado (online/away/offline)
- `get-online-users` - Solicitar lista de usuarios conectados

**Servidor → Cliente:**
- `receive-message` - Mensaje entrante
- `message-delivered` - Confirmación de entrega
- `message-pending` - Mensaje guardado (destinatario offline)
- `user-typing` - Indicador de escritura
- `message-read-receipt` - Confirmación de lectura
- `contact-added` - Nuevo contacto agregado
- `contact-removed` - Contacto eliminado
- `user-status-changed` - Cambio de estado de usuario
- `user-went-offline` - Usuario desconectado

## Seguridad

El servidor implementa múltiples capas de seguridad:

- **Autenticación JWT**: Tokens con expiración de 7 días
- **Hashing de contraseñas**: Bcrypt con 10 rounds de salt
- **Rate Limiting**: 
  - Registro: 10 intentos por IP cada 15 minutos
  - Login: 500 intentos por IP cada 15 minutos
- **Headers HTTP seguros**: Helmet.js configurado
- **Protección SQL Injection**: Prepared statements en todas las consultas
- **Validación de contraseñas**: Mínimo 8 caracteres, mayúsculas, números y caracteres especiales
- **CORS configurable**: Restricción de orígenes permitidos
- **Trust Proxy**: Obtención de IP real detrás de proxy/load balancer

## Despliegue

El servidor está diseñado para funcionar detrás de un proxy reverso (Nginx/Apache) que gestiona:

- Terminación SSL/TLS
- Compresión gzip
- Balanceo de carga
- Certificados HTTPS

Ejemplo de configuración Nginx:
```nginx
upstream q_message_backend {
    server 127.0.0.1:3000;
}

server {
    listen 443 ssl http2;
    server_name api.qmessage.info;

    ssl_certificate /path/to/cert.pem;
    ssl_certificate_key /path/to/key.pem;

    location / {
        proxy_pass http://q_message_backend;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_cache_bypass $http_upgrade;
    }
}
```

## Testing

Se incluyen scripts de testing para verificar los endpoints principales:

```bash
cd scripts
./test_contacts.sh
```

## Estructura de Base de Datos

### Tabla `users`
- `id` (UUID, PK)
- `username` (VARCHAR, UNIQUE)
- `email` (VARCHAR, UNIQUE)
- `password_hash` (TEXT)
- `public_key_quantum` (TEXT, nullable)
- `is_verified` (BOOLEAN)
- `verification_code` (VARCHAR)
- `code_expires_at` (TIMESTAMP)
- `created_at` (TIMESTAMP)

### Tabla `contacts`
- `id` (SERIAL, PK)
- `user_id` (UUID, FK → users)
- `contact_id` (UUID, FK → users)
- `created_at` (TIMESTAMP)

### Tabla `pending_messages`
- `id` (SERIAL, PK)
- `sender_id` (UUID, FK → users)
- `recipient_id` (UUID, FK → users)
- `encrypted_content` (TEXT)
- `initialization_vector` (TEXT, nullable)
- `sent_at` (TIMESTAMP)
- `content` (TEXT, nullable)
- `message_type` (VARCHAR)

## Licencia

Este proyecto ha sido desarrollado como Trabajo de Fin de Grado y está disponible bajo licencia MIT.

## Autor

Desarrollo realizado como TFG del Ciclo Superior de Desarrollo de Aplicaciones Multiplataforma.

## Contacto

Para consultas sobre el proyecto: [tu-email@example.com]
