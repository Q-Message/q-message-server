import fs from 'fs';
import path from 'path';

// Directorio de logs
const logsDir = path.join(__dirname, '../logs');
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}


// Logger simple que guarda en archivos:

function getTimestamp(): string {
  return new Date().toISOString();
}

function writeLog(filename: string, message: string): void {
  const logPath = path.join(logsDir, filename);
  const logEntry = `[${getTimestamp()}] ${message}\n`;
  fs.appendFileSync(logPath, logEntry, 'utf8');
}

//Log de autenticación (registro, login, logout, etc)
export function logAuth(event: string, username: string, ip: string, details = ''): void {
  const message = `${event} | username: ${username} | ip: ${ip} ${details ? `| ${details}` : ''}`;
  writeLog('auth.log', message);
  console.log(`[AUTH] ${message}`);
}

//Log de errores generales
export function logError(context: string, error: any): void {
  const message = `${context} | error: ${error.message || error} | code: ${error.code || 'N/A'}`;
  writeLog('error.log', message);
  console.error(`[ERROR] ${message}`);
}

//Log de intentos fallidos de login
export function logFailedAttempt(username: string, ip: string, reason: string): void {
  const message = `FAILED_LOGIN | username: ${username} | ip: ${ip} | reason: ${reason}`;
  writeLog('auth.log', message);
  console.warn(`[WARN] ${message}`);
}

//Log de accesos a endpoints
export function logAccess(username: string, endpoint: string, ip: string, method = 'GET'): void {
  const message = `${method} ${endpoint} | username: ${username} | ip: ${ip}`;
  writeLog('auth.log', message);
}
