require('dotenv').config();
const express = require('express');
const http = require('http');
const helmet = require('helmet');
const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');
const authRoutes = require('./src/routes/authRoutes');

// ============ VALIDACIONES DE SEGURIDAD EN STARTUP ============
if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) {
  console.error('❌ ERROR: JWT_SECRET no configurado o muy débil (mín 32 caracteres)');
  process.exit(1);
}
if (!process.env.CORS_ORIGIN) {
  console.error('❌ ERROR: CORS_ORIGIN no configurado en .env');
  process.exit(1);
}
console.log('✅ Configuración de seguridad validada');

const app = express();

// ============ SEGURIDAD: Headers HTTP con Helmet ============
app.use(helmet({
  contentSecurityPolicy: false, // Desabilitar CSP si causa problemas con Socket.io
  crossOriginResourcePolicy: { policy: 'cross-origin' },
}));
console.log('✅ Helmet.js activado (headers de seguridad HTTP)');

// Configuración de CORS
const CORS_ORIGIN = process.env.CORS_ORIGIN || '*';
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', CORS_ORIGIN);
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
  res.header('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});

// Confía en el Proxy (Cloudflare/Nginx) para obtener la IP real del usuario
app.set('trust proxy', true);

app.use(express.json());

// Rutas de la API
app.use('/api/auth', authRoutes);

// --- CAMBIO PRINCIPAL ---
// Ya no necesitamos lógica de HTTPS aquí. Nginx hace el "Offloading".
const server = http.createServer(app);
console.log('✅ Servidor funcionando en modo HTTP (detrás de Proxy Nginx)');

// Conectar Socket.io
const io = new Server(server, {
  cors: {
    origin: CORS_ORIGIN,
    methods: ['GET', 'POST'],
  },
});

io.on('connection', (socket) => {
  console.log('Un usuario se ha conectado vía Socket.io');
});

const PORT = process.env.PORT || 3000;
const HOST = '127.0.0.1'; // Seguridad: Solo acepta peticiones internas de Nginx

server.listen(PORT, HOST, () => {
  console.log(`🚀 Servidor Q-Message encendido internamente en ${HOST}:${PORT}`);
  console.log(`🌍 Acceso público vía: https://api.tu-dominio.es`);
});