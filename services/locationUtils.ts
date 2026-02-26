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
 * Criteria: isOnline=true AND updatedAt is within 15 seconds AND coordinates are valid.
 */
export const isBusActive = (bus: any): boolean => {
    if (!bus) return false;

    const now = Date.now();
    const isOnline = bus.isOnline === true;
    const isRecent = bus.updatedAt ? (now - bus.updatedAt) < 15000 : false;

    // Flexible check: use bus.lastLocation if it exists (Bus type), 
    // otherwise use bus directly (MapLocation type)
    const locToValidate = bus.lastLocation || bus;
    const hasValidLoc = isValidLocation(locToValidate);

    return !!(isOnline && isRecent && hasValidLoc);
};
