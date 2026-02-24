import express from 'express';
import bodyParser from 'body-parser';
import cors from 'cors';
import mssql from 'mssql';
import { v4 as uuidv4 } from 'uuid';

const app = express();
app.use(cors());
app.use(bodyParser.json());

const config = {
  // Default to the provided development MS SQL instance (override with env vars as needed)
  user: process.env.MSSQL_USER || 'facultyschedule',
  password: process.env.MSSQL_PASSWORD || 'Wise@3908',
  server: process.env.MSSQL_SERVER || '103.207.1.87',
  database: process.env.MSSQL_DATABASE || 'facultyschedule',
  port: process.env.MSSQL_PORT ? parseInt(process.env.MSSQL_PORT, 10) : 1433,
  options: {
    encrypt: false, // change to true if using Azure SQL
    trustServerCertificate: true,
  },
  pool: { max: 10, min: 0, idleTimeoutMillis: 30000 },
};

// Ensure connection pool and create table on startup
let pool;
async function initDatabase() {
  try {
    pool = await mssql.connect(config);
    console.log('✅ Connected to MSSQL');

    // Auto-create table if not exists - using string concatenation to avoid backtick issues
    const createTableSql = 'IF NOT EXISTS (SELECT 1 FROM sys.objects WHERE object_id = OBJECT_ID(' + "'dbo.DriverCheckins'" + ') AND type = ' + "'U'" + ') BEGIN CREATE TABLE dbo.DriverCheckins (Id UNIQUEIDENTIFIER NOT NULL PRIMARY KEY, DriverName NVARCHAR(100) NOT NULL, BusNumber NVARCHAR(20) NOT NULL, Registration NVARCHAR(50) NULL, Latitude DECIMAL(9,6) NULL, Longitude DECIMAL(9,6) NULL, AccuracyMeters INT NULL, CheckinTime DATETIMEOFFSET NULL, CreatedAt DATETIMEOFFSET NOT NULL DEFAULT SYSDATETIMEOFFSET()); END;';

    await pool.request().query(createTableSql);
    console.log('✅ Database initialized');
  } catch (err) {
    console.error('❌ MSSQL connection or table creation error:', err);
    // Retry in 5 seconds
    setTimeout(initDatabase, 5000);
  }
}

initDatabase();

// API to accept driver check-in
app.post('/api/checkin', async (req, res) => {
  const payload = req.body;
  if (!payload) return res.status(400).json({ error: 'Missing payload' });

  const {
    driverName = 'Sivabalan',
    busNumber = '21',
    registration = 'TN55',
    location = {},
    timestamp = new Date().toISOString(),
  } = payload;

  const lat = Number(location.lat || 0);
  const lng = Number(location.lng || 0);
  const accuracy = location.accuracy != null ? Number(location.accuracy) : null;

  try {
    if (!pool) pool = await mssql.connect(config);
    const request = pool.request();
    request.input('id', mssql.UniqueIdentifier, uuidv4());
    request.input('driverName', mssql.NVarChar(100), driverName);
    request.input('busNumber', mssql.NVarChar(20), busNumber);
    request.input('registration', mssql.NVarChar(50), registration);
    request.input('latitude', mssql.Decimal(9,6), lat);
    request.input('longitude', mssql.Decimal(9,6), lng);
    request.input('accuracy', mssql.Int, accuracy);
    request.input('checkinTime', mssql.DateTimeOffset, timestamp);
    request.input('createdAt', mssql.DateTimeOffset, new Date().toISOString());

    const insertSql = 'INSERT INTO dbo.DriverCheckins (Id, DriverName, BusNumber, Registration, Latitude, Longitude, AccuracyMeters, CheckinTime, CreatedAt) VALUES (@id, @driverName, @busNumber, @registration, @latitude, @longitude, @accuracy, @checkinTime, @createdAt)';

    await request.query(insertSql);

    return res.json({ ok: true, message: '✅ Check-in stored' });
  } catch (err) {
    console.error('Insert error:', err);
    return res.status(500).json({ error: 'Insert failed', details: String(err) });
  }
});

const port = process.env.PORT || 4000;
app.listen(port, () => console.log(`Server listening on port ${port}`));
