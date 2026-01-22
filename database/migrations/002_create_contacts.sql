-- Tabla de contactos
-- Relación bidireccional entre usuarios (contactos mutuos)

CREATE TABLE IF NOT EXISTS contacts (
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    contact_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (user_id, contact_id),
    CHECK (user_id != contact_id)
);

-- Índices para optimizar consultas de contactos
CREATE INDEX IF NOT EXISTS idx_contacts_user_id ON contacts(user_id);
CREATE INDEX IF NOT EXISTS idx_contacts_contact_id ON contacts(contact_id);

-- Función para asegurar relación bidireccional
CREATE OR REPLACE FUNCTION ensure_bidirectional_contact()
RETURNS TRIGGER AS $$
BEGIN
    -- Al añadir un contacto, añadir también la relación inversa
    IF NOT EXISTS (
        SELECT 1 FROM contacts 
        WHERE user_id = NEW.contact_id AND contact_id = NEW.user_id
    ) THEN
        INSERT INTO contacts (user_id, contact_id)
        VALUES (NEW.contact_id, NEW.user_id);
    END IF;
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER trigger_bidirectional_contact AFTER INSERT ON contacts
    FOR EACH ROW EXECUTE FUNCTION ensure_bidirectional_contact();
