-- Create database (if not exists)
-- CREATE DATABASE CampusWay;
-- USE CampusWay;

CREATE TABLE IF NOT EXISTS DriverCheckins (
  Id UNIQUEIDENTIFIER PRIMARY KEY,
  DriverName NVARCHAR(100) NOT NULL,
  BusNumber NVARCHAR(20) NOT NULL,
  Registration NVARCHAR(50) NULL,
  Latitude DECIMAL(9,6) NULL,
  Longitude DECIMAL(9,6) NULL,
  AccuracyMeters INT NULL,
  CheckinTime DATETIMEOFFSET NULL,
  CreatedAt DATETIMEOFFSET NOT NULL DEFAULT SYSDATETIMEOFFSET()
);

-- Use the target database
USE facultyschedule;

IF NOT EXISTS (
  SELECT 1 FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[DriverCheckins]') AND type = N'U'
) 
BEGIN
  CREATE TABLE dbo.DriverCheckins (
    Id UNIQUEIDENTIFIER NOT NULL PRIMARY KEY,
    DriverName NVARCHAR(100) NOT NULL,
    BusNumber NVARCHAR(20) NOT NULL,
    Registration NVARCHAR(50) NULL,
    Latitude DECIMAL(9,6) NULL,
    Longitude DECIMAL(9,6) NULL,
    AccuracyMeters INT NULL,
    CheckinTime DATETIMEOFFSET NULL,
    CreatedAt DATETIMEOFFSET NOT NULL DEFAULT SYSDATETIMEOFFSET()
  );
END;

-- Example insert:
-- INSERT INTO DriverCheckins (Id, DriverName, BusNumber, Registration, Latitude, Longitude, AccuracyMeters, CheckinTime)
-- VALUES (NEWID(), 'Sivabalan', '21', 'TN55', 12.9715987, 77.594566, 10, SYSDATETIMEOFFSET());
