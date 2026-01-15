const jwt = require('jsonwebtoken');

/**
 * Middleware de autenticación
 * Verifica que la solicitud tenga un JWT válido en el header Authorization
 * 
 * Uso: router.get('/ruta-protegida', authenticateToken, (req, res) => { ... })
 * 
 * Header esperado: Authorization: Bearer <token>
 * 
 * Si el token es válido, agrega req.user con los datos del usuario
 * Si no es válido o no existe, devuelve 401 Unauthorized
 */
function authenticateToken(req, res, next) {
  // Obtener el header Authorization
  const authHeader = req.headers['authorization'];
  
  // El token viene en formato: "Bearer <token>"
  const token = authHeader && authHeader.split(' ')[1];

  // Si no hay token, denegar acceso
  if (!token) {
    return res.status(401).json({ error: 'Access token required' });
  }

  // Verificar que el token es válido
  jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
    if (err) {
      // Token inválido o expirado
      if (err.name === 'TokenExpiredError') {
        return res.status(401).json({ error: 'Token expired' });
      }
      if (err.name === 'JsonWebTokenError') {
        return res.status(401).json({ error: 'Invalid token' });
      }
      return res.status(401).json({ error: 'Token verification failed' });
    }

    // Token válido, agregar datos del usuario a la solicitud
    req.user = user;
    next();
  });
}

module.exports = { authenticateToken };
