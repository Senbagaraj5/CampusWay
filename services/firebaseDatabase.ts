import { database } from './firebaseConfig';
import { ref, get, set, push, update, onValue, off, onDisconnect } from 'firebase/database';
import { Bus, Location, AttendanceRecord, DriverProfile } from '../types';

const BUS_IDS = ['24', '23', '18', '7', '40', '5', '32', '17', '6', '16', '31', '49', '15', '2', '4', '42', '41', '3'];

const DEFAULT_BUSES: Bus[] = BUS_IDS.map(id => ({
    id,
    busNumber: id,
    driverName: `Driver ${id}`,
    route: `Campus Route ${id}`,
    status: 'INACTIVE',
    isOnline: false,       // FIX 2: explicit offline flag
    updatedAt: Date.now()
}));

export const firebaseDatabase = {
    /**
     * FIX 11: Validate driver login using username field lookup.
     * The user types a 'terminalId' (e.g. bus_42) but the DB key is 'drv_42'.
     * We fetch the drivers node and find the entry where driver.username === terminalId.
     */
    validateDriverLogin: async (username: string, password: string): Promise<{ ok: boolean, driver?: DriverProfile, driverKey?: string, reason?: 'NOT_FOUND' | 'WRONG_PASSWORD' | 'NETWORK' }> => {
        const typedUsername = username.trim().toLowerCase();
        const inputPass = String(password).trim();

        const performLogin = async (): Promise<{ ok: boolean, driver?: DriverProfile, driverKey?: string, reason?: 'NOT_FOUND' | 'WRONG_PASSWORD' | 'NETWORK' }> => {
            const timeoutPromise = new Promise((_, reject) =>
                setTimeout(() => reject(new Error('TIMEOUT')), 4000)
            );

            try {
                // Fetch all drivers to find by username field
                const driversRef = ref(database, 'drivers');
                console.log("🔹 Fetching drivers node for username lookup:", typedUsername);

                const fetchPromise = get(driversRef);
                const snapshot = (await Promise.race([fetchPromise, timeoutPromise])) as any;

                if (!snapshot.exists()) {
                    console.error("❌ Drivers node is empty or missing.");
                    return { ok: false, reason: 'NOT_FOUND' };
                }

                const driversData = snapshot.val();
                let foundDriver: DriverProfile | null = null;
                let foundKey: string | null = null;

                // Iterate through drivers to find matching username
                for (const [key, data] of Object.entries(driversData)) {
                    const driver = data as DriverProfile;
                    if (driver.username && driver.username.toLowerCase() === typedUsername) {
                        foundDriver = driver;
                        foundKey = key;
                        break;
                    }
                }

                if (!foundDriver || !foundKey) {
                    console.log(`❌ No driver found with username: ${typedUsername}`);
                    return { ok: false, reason: 'NOT_FOUND' };
                }

                console.log(`✅ Found driver at key: ${foundKey}`);

                // Normalize and compare password
                const dbPass = String(foundDriver.password || (foundDriver as any).newPassword || (foundDriver as any).accessKey || '').trim();

                if (dbPass === inputPass && inputPass !== '') {
                    return { ok: true, driver: foundDriver, driverKey: foundKey };
                } else {
                    console.log("❌ Password mismatch");
                    return { ok: false, reason: 'WRONG_PASSWORD' };
                }
            } catch (error: any) {
                console.error("Login lookup failed:", error);
                throw error;
            }
        };

        try {
            return await performLogin();
        } catch (error) {
            console.warn('Login attempt 1 failed, retrying...', error);
            try {
                return await performLogin();
            } catch (retryError) {
                console.error('Final login failure:', retryError);
                return { ok: false, reason: 'NETWORK' };
            }
        }
    },

    /**
     * SESSION SECURITY: Validate if a driver session (UID) is still valid in DB.
     * Useful for checking if an account was deleted or disabled while app is open.
     */
    validateDriverSession: async (uid: string): Promise<boolean> => {
        try {
            const snapshot = await get(ref(database, `drivers/${uid}`));
            return snapshot.exists();
        } catch (error) {
            console.error('Session validation failed:', error);
            return false;
        }
    },

    /**
     * FIX 1: Update driver password in Firebase and clear mustChangePassword.
     * Must be awaited before proceeding with login.
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
     * FIX 12: Mark driver/bus as online or offline.
     * Sets `isOnline` flag and `status` in the bus record.
     */
    setDriverOnline: async (busId: string, online: boolean): Promise<void> => {
        try {
            await update(ref(database, `buses/${busId}`), {
                isOnline: online,
                status: online ? 'ACTIVE' : 'INACTIVE',
                updatedAt: Date.now(),
            });
        } catch (error) {
            console.error('Failed to set driver online status:', error);
        }
    },

    /**
     * FIX 12: Register Firebase onDisconnect so that if the client drops
     * unexpectedly (network loss, app close), the bus is marked offline.
     * Call this once when driver starts broadcasting.
     */
    setupOnDisconnect: (busId: string): void => {
        const busRef = ref(database, `buses/${busId}`);
        onDisconnect(busRef).update({
            isOnline: false,
            status: 'INACTIVE',
            updatedAt: Date.now(),
        });
    },

    /**
     * FIX 12: Update bus location with "Live" status logic.
     * Always ensures isOnline is true and updatedAt is fresh.
     */
    updateBusLocation: async (busId: string, location: Location): Promise<void> => {
        // Validation: Ignore invalid or zero locations
        if (!location || (location.lat === 0 && location.lng === 0) || isNaN(location.lat) || isNaN(location.lng)) {
            console.warn('⚠️ updateBusLocation - Skipped invalid coordinates:', location);
            return;
        }

        try {
            await update(ref(database, `buses/${busId}`), {
                lastLocation: location,
                status: 'ACTIVE',
                isOnline: true,
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
     * FIX 2: Subscribe to real-time bus updates.
     * Passes the raw bus list including isOnline flag so callers can filter.
     */
    onBusesUpdate: (callback: (buses: Bus[]) => void): (() => void) => {
        const busesRef = ref(database, 'buses');
        const listener = onValue(busesRef, (snapshot) => {
            if (snapshot.exists()) {
                const data = snapshot.val();
                const buses: Bus[] = Array.isArray(data) ? data.filter(Boolean) : Object.values(data);
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
            console.log('✅ Bus Accounts and Driver Profiles seeded');
        } catch (error) {
            console.error('Failed to seed default data:', error);
        }
    },

    /**
     * Listen for updates to a specific bus (Location focus)
     */
    onBusUpdate: (busId: string, callback: (bus: Bus) => void) => {
        const busRef = ref(database, `buses/${busId}`);
        const unsubscribe = onValue(busRef, (snapshot) => {
            if (snapshot.exists()) {
                callback(snapshot.val());
            }
        });
        return unsubscribe;
    },

    /**
     * FIX 5: Explicitly named aliases for clarity in Student Portal
     */
    subscribeFleetsStatus: (callback: (buses: Bus[]) => void) => {
        return firebaseDatabase.onBusesUpdate(callback);
    },

    subscribeFleetLocation: (busId: string, callback: (bus: Bus) => void) => {
        return firebaseDatabase.onBusUpdate(busId, callback);
    },
};

export const mockDatabase = firebaseDatabase;
