import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { getConnection } from './config/database';
import busRoutes from './routes/buses';
import studentRoutes from './routes/students';
import tripRoutes from './routes/trips';

dotenv.config();
const app = express();

app.use(cors({
  origin: [
    'https://campusway-mzcet.web.app',
    'http://localhost:5173'
  ]
}));
app.use(express.json());

app.use('/api/buses', busRoutes);
app.use('/api/students', studentRoutes);
app.use('/api/trips', tripRoutes);

app.post('/api/checkin', async (req, res) => {
  const { driverName, busNumber, location } = req.body;
  try {
    const pool = await getConnection();
    // Logging to LocationHistory if trip exists, or just a general log
    // For now, let's just log it to the console as a success confirmation
    // In a real app, we'd find the active tripId and insert into CampusWay_LocationHistory
    console.log(`📍 Check-in received for ${driverName} (Bus ${busNumber}):`, location);
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.get('/health', async (req, res) => {
  try {
    await getConnection();
    res.json({ 
      status: 'ok',
      database: 'connected',
      server: '103.207.1.87'
    });
  } catch (err) {
    res.status(500).json({ 
      status: 'error',
      database: 'disconnected'
    });
  }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`✅ CampusWay API: port ${PORT}`);
  getConnection(); // test DB connection
});
