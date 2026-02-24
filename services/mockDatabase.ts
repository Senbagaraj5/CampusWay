
import { Bus, Location, AttendanceRecord } from '../types';

const CHANNEL_NAME = 'bus_tracking_channel';
const channel = new BroadcastChannel(CHANNEL_NAME);

// Driver credentials
const DRIVER_CREDENTIALS = {
  '41': '123', // Driver ID: 41, Password: 123
};

export const mockDatabase = {
  validateDriverLogin: (driverId: string, password: string): boolean => {
    return DRIVER_CREDENTIALS[driverId as keyof typeof DRIVER_CREDENTIALS] === password;
  },

  getBuses: (): Bus[] => {
    const defaultBuses: Bus[] = [
      { id: '1', busNumber: '41', driverName: 'Sivabalan', route: 'Campus Main Route', status: 'INACTIVE' },
    ];
    const stored = localStorage.getItem('buses');
    return stored ? JSON.parse(stored) : defaultBuses;
  },

  updateBusLocation: (busId: string, location: Location) => {
    const buses = mockDatabase.getBuses();
    const updated = buses.map(b => b.id === busId ? { ...b, lastLocation: location, status: 'ACTIVE' as const } : b);
    localStorage.setItem('buses', JSON.stringify(updated));
    channel.postMessage({ type: 'LOCATION_UPDATE', busId, location });
  },

  saveAttendance: (record: AttendanceRecord) => {
    const records = JSON.parse(localStorage.getItem('attendance') || '[]');
    records.push(record);
    localStorage.setItem('attendance', JSON.stringify(records));
  },

  onLocationUpdate: (callback: (data: { busId: string, location: Location }) => void) => {
    channel.onmessage = (event) => {
      if (event.data.type === 'LOCATION_UPDATE') {
        callback(event.data);
      }
    };
  }
};
