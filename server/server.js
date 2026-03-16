const express = require('express');
const mssql = require('mssql');
const cors = require('cors');
require('dotenv').config();

const app = express();
const port = process.env.PORT || 5000;

// Middleware - MUST be before any routes
app.use(cors());
app.use(express.json());

// MSSQL Configuration
const dbConfig = {
    server: process.env.DB_HOST || '103.207.1.87',
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME || 'CampusWay',
    options: {
        encrypt: false,
        trustServerCertificate: true
    },
    pool: {
        max: 10,
        min: 0,
        idleTimeoutMillis: 30000
    }
};

let pool;

async function getPool() {
    if (!pool) {
        pool = await new mssql.ConnectionPool(dbConfig).connect();
    }
    return pool;
}

/**
 * Initialize Tables and Seed Data
 */
async function initDB() {
    try {
        const db = await getPool();
        const transaction = new mssql.Transaction(db);
        await transaction.begin();
        const request = new mssql.Request(transaction);

        // CW_Drivers
        await request.query(`
            IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'CW_Drivers')
            BEGIN
                CREATE TABLE CW_Drivers (
                    Id INT IDENTITY(1,1) PRIMARY KEY,
                    BusNo INT UNIQUE NOT NULL,
                    Registration NVARCHAR(20) NOT NULL,
                    Route NVARCHAR(100) NOT NULL,
                    IsActive BIT DEFAULT 1,
                    CreatedAt DATETIME DEFAULT GETDATE()
                );
            END
        `);

        // CW_BusLocation
        await request.query(`
            IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'CW_BusLocation')
            BEGIN
                CREATE TABLE CW_BusLocation (
                    Id INT IDENTITY(1,1) PRIMARY KEY,
                    BusNo INT UNIQUE NOT NULL,
                    Latitude FLOAT NOT NULL,
                    Longitude FLOAT NOT NULL,
                    Speed FLOAT DEFAULT 0,
                    IsOnline BIT DEFAULT 1,
                    UpdatedAt DATETIME DEFAULT GETDATE(),
                    CONSTRAINT FK_BusLocation_Drivers FOREIGN KEY (BusNo) REFERENCES CW_Drivers(BusNo) ON DELETE CASCADE
                );
            END
        `);

        // CW_LocationHistory
        await request.query(`
            IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'CW_LocationHistory')
            BEGIN
                CREATE TABLE CW_LocationHistory (
                    Id INT IDENTITY(1,1) PRIMARY KEY,
                    BusNo INT NOT NULL,
                    Latitude FLOAT NOT NULL,
                    Longitude FLOAT NOT NULL,
                    Speed FLOAT NOT NULL,
                    RecordedAt DATETIME DEFAULT GETDATE()
                );
            END
        `);

        const driverCheck = await request.query("SELECT COUNT(*) as count FROM CW_Drivers");
        if (driverCheck.recordset[0].count === 0) {
            console.log("Seeding CW_Drivers table...");
            await request.query(`
                INSERT INTO CW_Drivers (BusNo, Registration, Route, IsActive) VALUES
                (2, 'TN63AJ8602', 'Neivasal', 1),
                (3, 'TN63AK1260', 'SS.Kottai', 1),
                (4, 'TN63AK1264', 'Illupakudi', 1),
                (6, 'TN63AJ8845', 'Senjai', 1),
                (7, 'TN63AL8220', 'Thirupathur Pudhu Theru', 1),
                (8, 'TN63AJ8903', 'Singampunari', 1),
                (9, 'TN63AL8156', 'Spare', 0),
                (11, 'TN63AL9236', 'Spare', 0),
                (12, 'TN63AJ8611', 'Spare', 0),
                (13, 'TN63AJ8570', 'Spare', 0),
                (14, 'TN63BA0058', 'Velangudi', 1),
                (15, 'TN63BA0204', 'Karaikudi', 1),
                (16, 'TN63BA3179', 'Eriyur', 1),
                (17, 'TN63BC3589', 'Akilmanai Thirupathur', 1),
                (18, 'TN63BC3805', 'Sembanur', 1),
                (19, 'TN63BD8042', 'Kotaiyur', 1),
                (20, 'TN63BE0936', 'Keelasevalpatti', 1),
                (34, 'TN55AC5864', 'Kallutimedu', 1),
                (50, 'TN55BC5526', 'Elanthaimangalam', 1)
            `);
        }

        await transaction.commit();
        console.log("✅ Database initialized and seeded.");
    } catch (err) {
        console.error("❌ Database initialization failed:", err);
    }
}

// --- API ENDPOINTS (EXACT ORDER) ---

// 1. Health check
app.get('/health', (req, res) => {
    res.json({ status: 'ok', time: new Date().toISOString() });
});

// 2. Driver login
app.post('/api/driver/login', async (req, res) => {
    const { busNo, password } = req.body;
    try {
        const db = await getPool();
        const result = await db.request()
            .input('busNo', mssql.Int, busNo)
            .input('reg', mssql.NVarChar, password.toUpperCase().trim())
            .query(`
                SELECT BusNo, Registration, Route 
                FROM CW_Drivers 
                WHERE BusNo = @busNo 
                  AND Registration = @reg 
                  AND IsActive = 1
            `);

        if (result.recordset.length > 0) {
            res.json({ success: true, bus: result.recordset[0] });
        } else {
            res.status(401).json({ success: false, error: 'Invalid credentials' });
        }
    } catch (err) {
        console.error('Login error:', err);
        res.status(500).json({ success: false, error: 'Server error' });
    }
});

// 3. Update bus location
app.post('/api/bus/location', async (req, res) => {
    const { busNo, lat, lng, speed } = req.body;
    try {
        const db = await getPool();
        const transaction = new mssql.Transaction(db);
        await transaction.begin();
        const request = new mssql.Request(transaction);

        await request
            .input('busNo', mssql.Int, busNo)
            .input('lat', mssql.Float, lat)
            .input('lng', mssql.Float, lng)
            .input('speed', mssql.Float, speed)
            .query(`
                IF EXISTS (SELECT 1 FROM CW_BusLocation WHERE BusNo = @busNo)
                BEGIN
                    UPDATE CW_BusLocation 
                    SET Latitude = @lat, Longitude = @lng, Speed = @speed, UpdatedAt = GETDATE(), IsOnline = 1
                    WHERE BusNo = @busNo
                END
                ELSE
                BEGIN
                    INSERT INTO CW_BusLocation (BusNo, Latitude, Longitude, Speed, IsOnline)
                    VALUES (@busNo, @lat, @lng, @speed, 1)
                END
            `);

        await request.query(`
            INSERT INTO CW_LocationHistory (BusNo, Latitude, Longitude, Speed)
            VALUES (@busNo, @lat, @lng, @speed)
        `);

        await transaction.commit();
        res.json({ success: true });
    } catch (err) {
        console.error('Location update error:', err);
        res.status(500).json({ success: false, error: err.message });
    }
});

// 4. Driver disconnect
app.post('/api/bus/disconnect', async (req, res) => {
    const { busNo } = req.body;
    try {
        const db = await getPool();
        await db.request()
            .input('busNo', mssql.Int, busNo)
            .query("DELETE FROM CW_BusLocation WHERE BusNo = @busNo");
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// 5. All live buses
app.get('/api/buses/live', async (req, res) => {
    try {
        const db = await getPool();
        const result = await db.request().query(`
            SELECT L.*, D.Registration, D.Route 
            FROM CW_BusLocation L
            INNER JOIN CW_Drivers D ON L.BusNo = D.BusNo
            WHERE D.IsActive = 1
        `);
        res.json({ buses: result.recordset });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// 6. Single bus location
app.get('/api/bus/:busNo/location', async (req, res) => {
    const { busNo } = req.params;
    try {
        const db = await getPool();
        const result = await db.request()
            .input('busNo', mssql.Int, busNo)
            .query(`
                SELECT L.*, D.Registration, D.Route 
                FROM CW_BusLocation L
                INNER JOIN CW_Drivers D ON L.BusNo = D.BusNo
                WHERE L.BusNo = @busNo
            `);

        if (result.recordset.length > 0) {
            res.json({ online: true, bus: result.recordset[0] });
        } else {
            res.json({ online: false });
        }
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// 7. Get All Buses (Admin)
app.get('/api/admin/buses', async (req, res) => {
    try {
        const db = await getPool();
        const result = await db.request().query(`
            SELECT 
                d.Id, d.BusNo, d.Registration, d.Route, d.IsActive,
                CASE WHEN b.BusNo IS NOT NULL THEN 1 ELSE 0 END AS IsOnline
            FROM CW_Drivers d
            LEFT JOIN CW_BusLocation b ON b.BusNo = d.BusNo
            ORDER BY d.BusNo
        `);
        res.json({ buses: result.recordset });
    } catch (err) {
        console.error('Admin buses error:', err);
        res.status(500).json({ error: 'Server error', detail: err.message });
    }
});

// 8. Update bus (admin)
app.put('/api/admin/bus/:busNo', async (req, res) => {
    const { busNo } = req.params;
    const { registration, route, isActive } = req.body;
    try {
        const db = await getPool();
        const request = db.request();
        let query = "UPDATE CW_Drivers SET ";
        let updates = [];

        if (registration !== undefined) {
            request.input('reg', mssql.NVarChar, registration);
            updates.push("Registration = @reg");
        }
        if (route !== undefined) {
            request.input('route', mssql.NVarChar, route);
            updates.push("Route = @route");
        }
        if (isActive !== undefined) {
            request.input('active', mssql.Bit, isActive ? 1 : 0);
            updates.push("IsActive = @active");
        }

        if (updates.length === 0) return res.status(400).json({ error: "No fields to update" });

        query += updates.join(", ") + " WHERE BusNo = @busNo";
        request.input('busNo', mssql.Int, busNo);

        await request.query(query);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 9. Location history
app.get('/api/bus/:busNo/history', async (req, res) => {
    const { busNo } = req.params;
    try {
        const db = await getPool();
        const result = await db.request()
            .input('busNo', mssql.Int, busNo)
            .query("SELECT TOP 100 * FROM CW_LocationHistory WHERE BusNo = @busNo ORDER BY RecordedAt DESC");
        res.json(result.recordset);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// LAST - app.listen
app.listen(port, async () => {
    await initDB();
    console.log(`✅ CampusWay Server running on port ${port}`);
});
