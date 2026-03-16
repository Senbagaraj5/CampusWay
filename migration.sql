-- CampusWay MSSQL Migration Script
-- Database: CampusWay

-- 1. Create CW_Drivers Table
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

-- 2. Create CW_BusLocation Table (LIVE location only)
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

-- 3. Create CW_LocationHistory Table (GPS archive)
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
    CREATE INDEX IX_CW_LocationHistory_BusNo_Date ON CW_LocationHistory (BusNo, RecordedAt DESC);
END

-- 4. Seed/Reset CW_Drivers
DELETE FROM CW_Drivers;

INSERT INTO CW_Drivers (BusNo, Registration, Route, IsActive) VALUES
(2, 'TN63AJ8602', 'Neivasal', 1),
(3, 'TN63AK1260', 'SS.Kottai', 1),
(4, 'TN63AK1264', 'Illupakudi', 1),
(6, 'TN63AJ8845', 'Senjai', 1),
(7, 'TN63AL8220', 'Thirupathur Pudhu Theru', 1),
(8, 'TN63AJ8903', 'Singampunari', 1),
(9, 'TN63AL8156', 'Spare (inactive)', 0),
(11, 'TN63AL9236', 'Spare (inactive)', 0),
(12, 'TN63AJ8611', 'Spare (inactive)', 0),
(13, 'TN63AJ8570', 'Spare (inactive)', 0),
(14, 'TN63BA0058', 'Velangudi', 1),
(15, 'TN63BA0204', 'Karaikudi', 1),
(16, 'TN63BA3179', 'Eriyur', 1),
(17, 'TN63BC3589', 'Akilmanai Thirupathur', 1),
(18, 'TN63BC3805', 'Sembanur', 1),
(19, 'TN63BD8042', 'Kotaiyur', 1),
(20, 'TN63BE0936', 'Keelasevalpatti', 1),
(34, 'TN55AC5864', 'Kallutimedu', 1),
(50, 'TN55BC5526', 'Elanthaimangalam', 1);

SELECT 'Seeded ' + CAST(COUNT(*) AS VARCHAR) + ' buses' AS Confirmation FROM CW_Drivers;
