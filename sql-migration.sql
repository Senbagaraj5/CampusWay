
-- CAMPUSWAY MSSQL MIGRATION SCRIPT
-- Updates CW_Drivers and CW_Routes tables with real bus data

BEGIN TRANSACTION;

-- Clean up existing (Optional, use with caution)
-- DELETE FROM dbo.CW_Routes;
-- DELETE FROM dbo.CW_Drivers WHERE BusNumber IN ('2','3','4','6','7','8','9','11','12','13','14','15','16','17','18','19','20','34','50');

-- Insert all drivers
INSERT INTO dbo.CW_Drivers (Id, Name, Phone, LicenseNumber, BusNumber, IsActive)
VALUES
(NEWID(), 'Driver Bus 2',  '', 'TN63AJ8602', '2',  1),
(NEWID(), 'Driver Bus 3',  '', 'TN63AK1260', '3',  1),
(NEWID(), 'Driver Bus 4',  '', 'TN63AK1264', '4',  1),
(NEWID(), 'Driver Bus 6',  '', 'TN63AJ8845', '6',  1),
(NEWID(), 'Driver Bus 7',  '', 'TN63AL8220', '7',  1),
(NEWID(), 'Driver Bus 8',  '', 'TN63AJ8903', '8',  1),
(NEWID(), 'Driver Bus 9',  '', 'TN63AL8156', '9',  1),
(NEWID(), 'Driver Bus 11', '', 'TN63AL9236', '11', 1),
(NEWID(), 'Driver Bus 12', '', 'TN63AJ8611', '12', 1),
(NEWID(), 'Driver Bus 13', '', 'TN63AJ8570', '13', 1),
(NEWID(), 'Driver Bus 14', '', 'TN63BA0058', '14', 1),
(NEWID(), 'Driver Bus 15', '', 'TN63BA0204', '15', 1),
(NEWID(), 'Driver Bus 16', '', 'TN63BA3179', '16', 1),
(NEWID(), 'Driver Bus 17', '', 'TN63BC3589', '17', 1),
(NEWID(), 'Driver Bus 18', '', 'TN63BC3805', '18', 1),
(NEWID(), 'Driver Bus 19', '', 'TN63BD8042', '19', 1),
(NEWID(), 'Driver Bus 20', '', 'TN63BE0936', '20', 1),
(NEWID(), 'Driver Bus 34', '', 'TN55AC5864', '34', 1),
(NEWID(), 'Driver Bus 50', '', 'TN55BC5526', '50', 1);

-- Insert all routes
INSERT INTO dbo.CW_Routes (Id, BusNumber, RouteName, StartLocation, EndLocation)
VALUES
(NEWID(), '2',  'Neivasal Route',              'College', 'Neivasal'),
(NEWID(), '3',  'SS.Kottai Route',             'College', 'SS.Kottai'),
(NEWID(), '4',  'Illupakudi Route',            'College', 'Illupakudi'),
(NEWID(), '6',  'Senjai Route',                'College', 'Senjai'),
(NEWID(), '7',  'Thirupathur Pudhu Theru Route','College', 'Thirupathur Pudhu Theru'),
(NEWID(), '8',  'Singampunari Route',          'College', 'Singampunari'),
(NEWID(), '9',  'Spare',                       'College', 'Spare'),
(NEWID(), '11', 'Spare',                       'College', 'Spare'),
(NEWID(), '12', 'Spare',                       'College', 'Spare'),
(NEWID(), '13', 'Spare',                       'College', 'Spare'),
(NEWID(), '14', 'Velangudi Route',             'College', 'Velangudi'),
(NEWID(), '15', 'Karaikudi Route',             'College', 'Karaikudi'),
(NEWID(), '16', 'Eriyur Route',                'College', 'Eriyur'),
(NEWID(), '17', 'Akilmanai Route',             'College', 'Akilmanai, Thirupathur'),
(NEWID(), '18', 'Sembanur Route',              'College', 'Sembanur'),
(NEWID(), '19', 'Kotaiyur Route',              'College', 'Kotaiyur'),
(NEWID(), '20', 'Keelasevalpatti Route',       'College', 'Keelasevalpatti'),
(NEWID(), '34', 'Kallutimedu Route',           'College', 'Kallutimedu'),
(NEWID(), '50', 'Elanthaimangalam Route',      'College', 'Elanthaimangalam');

COMMIT;

SELECT * FROM CW_Drivers;
SELECT * FROM CW_Routes;
