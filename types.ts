
export type UserRole = 'DRIVER' | 'STUDENT';

export interface Location {
  lat: number;
  lng: number;
  timestamp: number;
  speed?: number | null;
  accuracy?: number | null;
}

export interface Bus {
  id: string;
  busNumber: string;
  driverName: string;
  route: string;
  status: 'ACTIVE' | 'INACTIVE' | 'MAINTENANCE';
  lastLocation?: Location;
}

export interface AttendanceRecord {
  id: string;
  driverId: string;
  busId: string;
  timestamp: string;
  location: Location;
  photoUrl: string;
}

export interface ChatMessage {
  role: 'user' | 'model';
  text: string;
}
