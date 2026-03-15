import { Location, Bus } from '../types';

/**
 * Validates if a location object has real-world coordinates.
 * Rejects [0,0], null, undefined, and NaN values.
 */
export const isValidLocation = (loc: Location | null | undefined): boolean => {
    if (!loc) return false;
    if (typeof loc.lat !== 'number' || typeof loc.lng !== 'number') return false;
    if (isNaN(loc.lat) || isNaN(loc.lng)) return false;

    // Strict check for [0, 0] which is near Africa and usually indicates uninitialized GPS
    if (Math.abs(loc.lat) < 0.000001 && Math.abs(loc.lng) < 0.000001) return false;

    return true;
};

/**
 * Determines if a bus is actively broadcasting fresh data.
 * Criteria: status === 'online' AND updatedAt is within 15 seconds AND coordinates are valid.
 */
export const isBusActive = (bus: any): boolean => {
    if (!bus) return false;

    const now = Date.now();
    const isOnline = bus.status === 'online';
    const isRecent = bus.updatedAt ? (now - bus.updatedAt) < 15000 : false;

    // Flexible check: use bus.location if it exists (Bus type), 
    // otherwise use bus directly (MapLocation type)
    const locToValidate = bus.location || bus;
    const hasValidLoc = isValidLocation(locToValidate);

    return !!(isOnline && isRecent && hasValidLoc);
};

/**
 * Calculates straight line distance between a bus and a student
 */
export function haversineDistance(lat1: number, lng1: number, lat2: number, lng2: number) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI/180) * 
    Math.cos(lat2 * Math.PI/180) *
    Math.sin(dLng/2) * Math.sin(dLng/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
}
