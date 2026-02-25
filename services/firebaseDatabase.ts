import { database } from './firebaseConfig';
import { ref, get, set, push, update, onValue, off } from 'firebase/database';
import { Bus, Location, AttendanceRecord, DriverProfile } from '../types';

const BUS_IDS = ['24', '23', '18', '7', '40', '5', '32', '17', '6', '16', '31', '49', '15', '2', '4', '42', '41', '3'];

const DEFAULT_BUSES: Bus[] = BUS_IDS.map(id => ({
    id,
    busNumber: id,
    driverName: `Driver ${id}`,
    route: `Campus Route ${id}`,
    status: 'INACTIVE',
    updatedAt: Date.now()
}));

export const firebaseDatabase = {
    /**
     * Validate driver login and check if password change is required
     */
    validateDriverLogin: async (username: string, password: string): Promise<{ success: boolean, driver?: DriverProfile }> => {
        try {
            const snapshot = await get(ref(database, 'drivers'));
            if (snapshot.exists()) {
                const drivers: Record<string, DriverProfile> = snapshot.val();
                const driver = Object.values(drivers).find(d => d.username === username && d.password === password);
                if (driver) {
                    return { success: true, driver };
                }
            }
            return { success: false };
        } catch (error) {
            console.error('Firebase login check failed:', error);
            return { success: false };
        }
    },

    /**
     * Update driver password and clear mustChangePassword flag
     */
    updateDriverPassword: async (uid: string, newPassword: string): Promise<void> => {
        try {
            await update(ref(database, `drivers/${uid}`), {
                password: newPassword,
                mustChangePassword: false
            });
        } catch (error) {
            console.error('Failed to update driver password:', error);
            throw error;
        }
    },

    /**
     * Get all buses from Firebase
     */
    getBuses: async (): Promise<Bus[]> => {
        try {
            const snapshot = await get(ref(database, 'buses'));
            if (snapshot.exists()) {
                const data = snapshot.val();
                let buses: Bus[] = Array.isArray(data) ? data.filter(Boolean) : Object.values(data);
                // If new buses added in code, re-seed to include them
                if (buses.length < BUS_IDS.length) {
                    await firebaseDatabase.seedDefaultData();
                    return firebaseDatabase.getBuses();
                }
                return buses;
            }
            await firebaseDatabase.seedDefaultData();
            return DEFAULT_BUSES;
        } catch (error) {
            console.error('Failed to fetch buses from Firebase:', error);
            return DEFAULT_BUSES;
        }
    },

    /**
     * Update bus location with "Live" status logic
     */
    updateBusLocation: async (busId: string, location: Location): Promise<void> => {
        try {
            await update(ref(database, `buses/${busId}`), {
                lastLocation: location,
                status: 'ACTIVE',
                updatedAt: Date.now()
            });
        } catch (error) {
            console.error('Failed to update bus location in Firebase:', error);
        }
    },

    /**
     * Save attendance record
     */
    saveAttendance: async (record: AttendanceRecord): Promise<void> => {
        try {
            await push(ref(database, 'attendance'), record);
        } catch (error) {
            console.error('Failed to save attendance to Firebase:', error);
        }
    },

    /**
     * Subscribe to real-time bus updates
     */
    onBusesUpdate: (callback: (buses: Bus[]) => void): (() => void) => {
        const busesRef = ref(database, 'buses');
        const listener = onValue(busesRef, (snapshot) => {
            if (snapshot.exists()) {
                const data = snapshot.val();
                let buses: Bus[] = Array.isArray(data) ? data.filter(Boolean) : Object.values(data);
                callback(buses);
            }
        });
        return () => off(busesRef, 'value', listener);
    },

    /**
     * Seed driver accounts and buses for the entire fleet
     */
    seedDefaultData: async (): Promise<void> => {
        try {
            const busData: Record<string, Bus> = {};
            const driverData: Record<string, DriverProfile> = {};

            DEFAULT_BUSES.forEach(bus => {
                busData[bus.id] = bus;
                // Generate driver profile
                const uid = `drv_${bus.id}`;
                driverData[uid] = {
                    uid,
                    busId: bus.id,
                    username: `bus_${bus.id}`,
                    password: 'Campus@123',
                    mustChangePassword: true
                };
            });

            await set(ref(database, 'buses'), busData);
            await set(ref(database, 'drivers'), driverData);
            console.log('✅ 17 Bus Accounts and Driver Profiles seeded');
        } catch (error) {
            console.error('Failed to seed default data:', error);
        }
    },

    /**
     * Listen for updates to a specific bus
     */
    onBusUpdate: (busId: string, callback: (bus: Bus) => void) => {
        const busRef = ref(database, `buses/bus_${busId}`);
        const unsubscribe = onValue(busRef, (snapshot) => {
            if (snapshot.exists()) {
                callback(snapshot.val());
            }
        });
        return unsubscribe;
    },
};

export const mockDatabase = firebaseDatabase;
