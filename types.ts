
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
  status: 'online' | 'offline' | 'MAINTENANCE';
  location?: Location;
  updatedAt?: number;
}

export interface DriverProfile {
  uid: string;
  busId: string;
  username: string;
  password?: string; // Only for seed/initial
  mustChangePassword: boolean;
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
