export type UserRole = 'STUDENT' | 'DRIVER' | 'ADMIN';

export interface Location {
  lat: number;
  lng: number;
  timestamp: number;
  speed?: number;
  accuracy?: number;
}

export interface AttendanceRecord {
  id: string;
  driverId: string;
  busId: string;
  timestamp: string;
  location: Location;
  photoUrl: string;
}

export interface DriverProfile {
  uid: string;
  busId: string;
  username: string;
  mustChangePassword?: boolean;
}

/**
 * CampusWay System - Core Type Definitions
 */

export interface Bus {
  id: string; // for compatibility with firebase ids like 'bus_16'
  Id?: number;
  BusNo: number;
  Registration: string;
  Route: string;
  IsActive: boolean;
  IsOnline?: boolean;
  CreatedAt?: string;
  UpdatedAt?: string;
  
  // App.tsx compatibility fields
  busNumber: string;
  registrationNumber?: string;
  route?: string;
  status?: 'online' | 'offline' | 'MAINTENANCE';
  location?: Location;
  updatedAt?: number;
  driverName?: string;
}

export interface BusLocation {
  BusNo: number;
  Latitude: number;
  Longitude: number;
  Speed: number;
  UpdatedAt: string;
  Registration?: string;
  Route?: string;
}

export interface LocationHistory {
  BusNo: number;
  Latitude: number;
  Longitude: number;
  Speed: number;
  RecordedAt: string;
}

export interface DriverSession {
  busNo: number;
  registration: string;
  route: string;
  isActive: boolean;
}

export interface LoginPayload {
  busNo: string | number;
  password: string;
}

export interface LoginResponse {
  success: boolean;
  bus?: DriverSession;
  error?: string;
}

export interface LiveBusResponse {
  online: boolean;
  bus?: BusLocation;
}

export interface Coordinates {
  lat: number;
  lng: number;
}

export interface BusUpdatePayload {
  registration?: string;
  route?: string;
  isActive?: boolean;
}
