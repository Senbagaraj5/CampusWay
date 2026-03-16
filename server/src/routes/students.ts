import { Router } from 'express';
import sql from 'mssql';
import { getConnection } from '../config/database';

const router = Router();

// GET student by roll number
router.get('/roll/:rollNumber', async (req, res) => {
  try {
    const pool = await getConnection();
    const result = await pool.request()
      .input('roll', sql.NVarChar, 
        req.params.rollNumber)
      .query(`
        SELECT * FROM CampusWay_Students
        WHERE roll_number = @roll
      `);
    
    if (result.recordset.length === 0) {
      return res.status(404).json({ 
        success: false, 
        message: 'Student not found' 
      });
    }
    
    res.json({ 
      success: true, 
      data: result.recordset[0] 
    });
  } catch (err: any) {
    res.status(500).json({ 
      success: false, 
      error: err.message 
    });
  }
});

// POST add new student
router.post('/', async (req, res) => {
  const { name, email, phone, 
    roll_number, department, bus_number } = req.body;
  try {
    const pool = await getConnection();
    await pool.request()
      .input('name', sql.NVarChar, name)
      .input('email', sql.NVarChar, email)
      .input('phone', sql.NVarChar, phone)
      .input('roll', sql.NVarChar, roll_number)
      .input('dept', sql.NVarChar, department)
      .input('bus', sql.NVarChar, bus_number)
      .query(`
        INSERT INTO CampusWay_Students
        (name, email, phone, roll_number, 
         department, bus_number)
        VALUES 
        (@name, @email, @phone, @roll, 
         @dept, @bus)
      `);
    res.json({ 
      success: true, 
      message: 'Student added!' 
    });
  } catch (err: any) {
    res.status(500).json({ 
      success: false, 
      error: err.message 
    });
  }
});

export default router;
