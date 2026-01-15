require('dotenv').config();
const express = require('express');
const bcrypt = require('bcrypt');
const pool = require('./db'); // Importa tu conexión a Postgres
const app = express();

app.use(express.json()); // Esto permite que el servidor lea JSON

// RUTA DE REGISTRO
app.post('/register', async (req, res) => {
    const { username, password, publicKey } = req.body;

    try {
        // 1. "Trituramos" la contraseña para que no sea legible
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        // 2. Guardamos en PostgreSQL
        const result = await pool.query(
            'INSERT INTO users (username, password_hash, public_key_quantum) VALUES ($1, $2, $3) RETURNING id',
            [username, hashedPassword, publicKey]
        );

        res.status(201).json({ message: "Usuario creado con éxito", id: result.rows[0].id });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Error al registrar o el usuario ya existe" });
    }
});

app.listen(3000, () => console.log("Servidor corriendo en el puerto 3000"));