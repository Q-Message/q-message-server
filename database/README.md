# Migraciones de Base de Datos

Este directorio contiene las migraciones SQL para configurar la base de datos PostgreSQL del proyecto Q-Message.

## Orden de Ejecución

Las migraciones deben ejecutarse en orden numérico:

1. **001_create_users.sql** - Crea la tabla de usuarios con autenticación y verificación
2. **002_create_contacts.sql** - Crea la tabla de contactos con relaciones bidireccionales
3. **003_create_pending_messages.sql** - Crea la tabla para mensajes offline

## Cómo Ejecutar

### Opción 1: Usando psql

```bash
psql -h <host> -U <usuario> -d <database> -f database/migrations/001_create_users.sql
psql -h <host> -U <usuario> -d <database> -f database/migrations/002_create_contacts.sql
psql -h <host> -U <usuario> -d <database> -f database/migrations/003_create_pending_messages.sql
```

### Opción 2: Script completo

```bash
for file in database/migrations/*.sql; do
    psql -h <host> -U <usuario> -d <database> -f "$file"
done
```

## Estructura de Tablas

### users
- Almacena información de usuarios registrados
- Incluye campos para autenticación (password_hash), verificación por email y clave pública cuántica
- Trigger automático para actualizar `updated_at`

### contacts
- Relación bidireccional entre usuarios
- Trigger automático que asegura que si A añade a B, B también tiene a A
- Restricción CHECK para evitar auto-contactos

### pending_messages
- Mensajes enviados a usuarios offline
- Se eliminan automáticamente al ser entregados
- Soporte para contenido encriptado y en texto plano

## Notas

- Todas las migraciones usan `IF NOT EXISTS` para evitar errores en re-ejecuciones
- Los índices están optimizados para las consultas más comunes del sistema
- Las claves foráneas incluyen `ON DELETE CASCADE` para mantener integridad referencial
