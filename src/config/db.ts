import { Pool, QueryResult } from 'pg'; // 1. Usamos import en vez de require
import dotenv from 'dotenv';

// Cargar variables de entorno
dotenv.config();

// Validación rápida
if (!process.env.DB_HOST || !process.env.DB_USER) {
  console.error('❌ ERROR CRÍTICO: Variables de entorno de base de datos incompletas.');
  process.exit(1);
}

// Creamos el Pool
const pool = new Pool({
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: process.env.DB_NAME,
  password: process.env.DB_PASSWORD,
  port: parseInt(process.env.DB_PORT || '5432', 10), 
});

pool.on('connect', () => {
  console.log('Conectado a PostgreSQL');
});

pool.on('error', (err) => {
  console.error('Error inesperado en el pool de PostgreSQL', err);
  process.exit(-1);
});

/**
 * 2. EXPORTACIÓN CON NOMBRE (Named Export)
 * Usamos 'export const' para que puedas hacer 'import { query }' en otros archivos.
 * Además, le ponemos tipos a los parámetros.
 */
export const query = (text: string, params?: any[]): Promise<QueryResult> => {
  return pool.query(text, params);
};

/**
 * Opcional: Si alguna vez necesitas acceder al pool directamente
 */
export { pool };