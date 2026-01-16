const express = require('express');
const http = require('http');
const https = require('https');
const fs = require('fs');
const { Server } = require('socket.io');
const authRoutes = require('./src/routes/authRoutes');

const app = express();

// Habilitar CORS vía cabeceras para peticiones HTTP (configurable por env)
const CORS_ORIGIN = process.env.CORS_ORIGIN || '*';
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', CORS_ORIGIN);
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
  res.header('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
  // responde a preflight
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});

app.use(express.json());



// Aquí conectas tus rutas
app.use('/api/auth', authRoutes);

// Crear servidor HTTP o HTTPS según configuración
// Por defecto HTTP en puerto 3000
// Para HTTPS, establece TLS_CERT y TLS_KEY en variables de entorno
const USE_HTTPS = process.env.TLS_CERT && process.env.TLS_KEY;
let server;

if (USE_HTTPS) {
  try {
    const certPath = process.env.TLS_CERT;
    const keyPath = process.env.TLS_KEY;

    if (!fs.existsSync(certPath) || !fs.existsSync(keyPath)) {
      console.error(`❌ Error: Archivos TLS no encontrados`);
      console.error(`   TLS_CERT: ${certPath}`);
      console.error(`   TLS_KEY: ${keyPath}`);
      process.exit(1);
    }

    const options = {
      cert: fs.readFileSync(certPath),
      key: fs.readFileSync(keyPath),
    };

    server = https.createServer(options, app);
    console.log('🔒 HTTPS habilitado');
  } catch (err) {
    console.error('❌ Error al cargar certificados TLS:', err.message);
    process.exit(1);
  }
} else {
  server = http.createServer(app);
  console.log('⚠️  Usando HTTP (no seguro). Para HTTPS, establece TLS_CERT y TLS_KEY');
}

// Conectar Socket.io con CORS permitido (origin configurable)
const io = new Server(server, {
  cors: {
    origin: CORS_ORIGIN,
    methods: ['GET', 'POST'],
  },
});

io.on('connection', (socket) => {
  console.log('Un usuario se ha conectado al chat');
});

const PORT = process.env.PORT || 3000;
// Forzar bind a 0.0.0.0 para aceptar conexiones desde otras máquinas
const HOST = process.env.HOST || '0.0.0.0';
server.listen(PORT, HOST, () => {
  console.log(`🚀 Servidor Q-Message encendido en ${HOST}:${PORT}`);
});
