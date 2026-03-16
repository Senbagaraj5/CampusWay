import { Router } from 'express';
import sql from 'mssql';
import { getConnection } from '../config/database';

const router = Router();

router.post('/start', async (req, res) => {
  const { bus_number, driver_id } = req.body;
  try {
    const pool = await getConnection();
    const result = await pool.request()
      .input('bus', sql.NVarChar, bus_number)
      .input('driver', sql.Int, driver_id)
      .query(`
        INSERT INTO CampusWay_Trips
        (bus_number, driver_id, 
         start_time, status)
        VALUES (@bus, @driver, 
         GETDATE(), 'active');
        SELECT SCOPE_IDENTITY() as tripId;
      `);
    
    const tripId = result.recordset[0].tripId;
    res.json({ 
      success: true, 
      tripId 
    });
  } catch (err: any) {
    res.status(500).json({ 
      success: false, 
      error: err.message 
    });
  }
});

router.post('/end', async (req, res) => {
  const { tripId } = req.body;
  try {
    const pool = await getConnection();
    await pool.request()
      .input('tripId', sql.Int, tripId)
      .query(`
        UPDATE CampusWay_Trips
        SET end_time = GETDATE(),
            status = 'completed'
        WHERE id = @tripId
      `);
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
