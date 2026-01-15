const fs = require('fs');
const path = require('path');

// Directorio de logs
const logsDir = path.join(__dirname, '../logs');
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

/**
 * Logger simple que guarda en archivos:
 * - logs/auth.log — eventos de autenticación
 * - logs/error.log — errores del sistema
 */

function getTimestamp() {
  return new Date().toISOString();
}

function writeLog(filename, message) {
  const logPath = path.join(logsDir, filename);
  const logEntry = `[${getTimestamp()}] ${message}\n`;
  fs.appendFileSync(logPath, logEntry, 'utf8');
}

/**
 * Log de autenticación (registro, login exitoso/fallido)
 */
function logAuth(event, username, ip, details = '') {
  const message = `${event} | username: ${username} | ip: ${ip} ${details ? `| ${details}` : ''}`;
  writeLog('auth.log', message);
  console.log(`[AUTH] ${message}`);
}

/**
 * Log de error (excepciones, errores de BD, etc)
 */
function logError(context, error) {
  const message = `${context} | error: ${error.message || error} | code: ${error.code || 'N/A'}`;
  writeLog('error.log', message);
  console.error(`[ERROR] ${message}`);
}

/**
 * Log de intentos fallidos (para detectar ataques)
 */
function logFailedAttempt(username, ip, reason) {
  const message = `FAILED_LOGIN | username: ${username} | ip: ${ip} | reason: ${reason}`;
  writeLog('auth.log', message);
  console.warn(`[WARN] ${message}`);
}

/**
 * Log de acceso a recursos protegidos
 */
function logAccess(username, endpoint, ip, method = 'GET') {
  const message = `${method} ${endpoint} | username: ${username} | ip: ${ip}`;
  writeLog('auth.log', message);
}

module.exports = {
  logAuth,
  logError,
  logFailedAttempt,
  logAccess,
};
