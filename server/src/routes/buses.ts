import { Router } from 'express';
import sql from 'mssql';
import { getConnection } from '../config/database';

const router = Router();

// GET all buses with routes
router.get('/', async (req, res) => {
  try {
    const pool = await getConnection();
    const result = await pool.request()
      .query(`
        SELECT 
          r.bus_number,
          r.route_name,
          r.start_location,
          r.end_location,
          r.estimated_duration,
          d.name as driver_name,
          d.phone as driver_phone
        FROM CampusWay_Routes r
        LEFT JOIN CampusWay_Drivers d 
          ON r.bus_number = d.bus_number
        ORDER BY r.bus_number
      `);
    res.json({ 
      success: true, 
      data: result.recordset 
    });
  } catch (err: any) {
    res.status(500).json({ 
      success: false, 
      error: err.message 
    });
  }
});

// GET bus stops by bus number
router.get('/:busNumber/stops', async (req, res) => {
  try {
    const pool = await getConnection();
    const result = await pool.request()
      .input('busNumber', sql.NVarChar, 
        req.params.busNumber)
      .query(`
        SELECT s.*
        FROM CampusWay_Stops s
        JOIN CampusWay_Routes r ON s.route_id = r.id
        WHERE r.bus_number = @busNumber
        ORDER BY s.stop_order
      `);
    res.json({ 
      success: true, 
      data: result.recordset 
    });
  } catch (err: any) {
    res.status(500).json({ 
      success: false, 
      error: err.message 
    });
  }
});

export default router;
