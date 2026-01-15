const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const authRoutes = require('./src/routes/authRoutes');

const app = express();
const server = http.createServer(app); // Creamos el servidor físico
const io = new Server(server); // Conectamos Socket.io al servidor

app.use(express.json());

// Aquí conectas tus rutas
app.use('/api/auth', authRoutes);

// Aquí escuchas las conexiones en tiempo real
io.on('connection', (socket) => {
        console.log('Un usuario se ha conectado al chat');
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
        console.log(`🚀 Servidor Q-Message encendido en puerto ${PORT}`);
});