import sql from 'mssql';
import dotenv from 'dotenv';
dotenv.config();

export const dbConfig: sql.config = {
  server: process.env.DB_HOST || '103.207.1.87',
  port: parseInt(process.env.DB_PORT || '1433'),
  database: process.env.DB_NAME || 'facultyschedule',
  user: process.env.DB_USER || 'sa',
  password: process.env.DB_PASSWORD || '',
  options: {
    encrypt: false,          // for local server
    trustServerCertificate: true,
    enableArithAbort: true
  },
  pool: {
    max: 10,
    min: 0,
    idleTimeoutMillis: 30000
  }
};

let pool: sql.ConnectionPool;

export async function getConnection() {
  try {
    if (!pool) {
      pool = await sql.connect(dbConfig);
      console.log('✅ SQL Server connected!');
    }
    return pool;
  } catch (err) {
    console.error('❌ DB connection failed:', err);
    throw err;
  }
}
