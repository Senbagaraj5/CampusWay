import { database } from './firebaseConfig';
import { ref, get, set, push, update, onValue, off } from 'firebase/database';
import { Bus, Location, AttendanceRecord } from '../types';

const DEFAULT_BUSES: Bus[] = [
    { id: '1', busNumber: '41', driverName: 'Sivabalan', route: 'Campus Main Route', status: 'INACTIVE' },
];

// Driver credentials stored in Firebase at /drivers/{driverId}
// Fallback to hardcoded credentials if Firebase read fails
const FALLBACK_CREDENTIALS: Record<string, string> = {
    '41': '123',
};

export const firebaseDatabase = {
    /**
     * Validate driver login against Firebase /drivers/{driverId}
     * Falls back to hardcoded credentials if Firebase is unreachable
     */
    validateDriverLogin: async (driverId: string, password: string): Promise<boolean> => {
        try {
            const snapshot = await get(ref(database, `drivers/${driverId}`));
            if (snapshot.exists()) {
                const data = snapshot.val();
                return data.password === password;
            }
            // If not in Firebase, check fallback
            return FALLBACK_CREDENTIALS[driverId] === password;
        } catch (error) {
            console.error('Firebase login check failed, using fallback:', error);
            return FALLBACK_CREDENTIALS[driverId] === password;
        }
    },

    /**
     * Get all buses from Firebase /buses
     * Seeds default data if the path doesn't exist yet
     */
    getBuses: async (): Promise<Bus[]> => {
        try {
            const snapshot = await get(ref(database, 'buses'));
            if (snapshot.exists()) {
                const data = snapshot.val();
                // Firebase stores as object keyed by ID, convert to array
                if (Array.isArray(data)) {
                    return data.filter(Boolean);
                }
                return Object.values(data);
            }
            // Seed default data if empty
            await firebaseDatabase.seedDefaultData();
            return DEFAULT_BUSES;
        } catch (error) {
            console.error('Failed to fetch buses from Firebase:', error);
            return DEFAULT_BUSES;
        }
    },

    /**
     * Update bus location in Firebase - triggers real-time listeners automatically
     */
    updateBusLocation: async (busId: string, location: Location): Promise<void> => {
        try {
            await update(ref(database, `buses/${busId}`), {
                lastLocation: location,
                status: 'ACTIVE',
            });
        } catch (error) {
            console.error('Failed to update bus location in Firebase:', error);
        }
    },

    /**
     * Save attendance record to Firebase /attendance
     */
    saveAttendance: async (record: AttendanceRecord): Promise<void> => {
        try {
            await push(ref(database, 'attendance'), record);
        } catch (error) {
            console.error('Failed to save attendance to Firebase:', error);
        }
    },

    /**
     * Subscribe to real-time bus updates from Firebase
     * Returns an unsubscribe function
     */
    onBusesUpdate: (callback: (buses: Bus[]) => void): (() => void) => {
        const busesRef = ref(database, 'buses');
        const listener = onValue(busesRef, (snapshot) => {
            if (snapshot.exists()) {
                const data = snapshot.val();
                let buses: Bus[];
                if (Array.isArray(data)) {
                    buses = data.filter(Boolean);
                } else {
                    buses = Object.values(data);
                }
                callback(buses);
            }
        }, (error) => {
            console.error('Firebase real-time listener error:', error);
        });

        // Return unsubscribe function
        return () => off(busesRef, 'value', listener);
    },

    /**
     * Seed default bus and driver data into Firebase
     */
    seedDefaultData: async (): Promise<void> => {
        try {
            // Seed buses
            const busData: Record<string, Bus> = {};
            DEFAULT_BUSES.forEach(bus => {
                busData[bus.id] = bus;
            });
            await set(ref(database, 'buses'), busData);

            // Seed driver credentials
            await set(ref(database, 'drivers/41'), { password: '123' });

            console.log('✅ Default data seeded to Firebase');
        } catch (error) {
            console.error('Failed to seed default data:', error);
        }
    },
};

// Backward-compatible export so existing imports still work
export const mockDatabase = firebaseDatabase;
