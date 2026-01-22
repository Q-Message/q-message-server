-- Tabla de mensajes pendientes
-- Almacena mensajes enviados a usuarios offline hasta que se conecten

CREATE TABLE IF NOT EXISTS pending_messages (
    id SERIAL PRIMARY KEY,
    sender_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    recipient_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    encrypted_content TEXT,
    content TEXT,
    message_type VARCHAR(20) DEFAULT 'text',
    initialization_vector TEXT,
    sent_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CHECK (sender_id != recipient_id)
);

-- Índices para consultas eficientes de mensajes pendientes
CREATE INDEX IF NOT EXISTS idx_pending_messages_recipient ON pending_messages(recipient_id);
CREATE INDEX IF NOT EXISTS idx_pending_messages_sender ON pending_messages(sender_id);
CREATE INDEX IF NOT EXISTS idx_pending_messages_sent_at ON pending_messages(sent_at);

-- Índice compuesto para consultas de mensajes entre dos usuarios
CREATE INDEX IF NOT EXISTS idx_pending_messages_sender_recipient 
    ON pending_messages(sender_id, recipient_id);
