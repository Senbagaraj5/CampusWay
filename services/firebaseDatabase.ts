import { database } from './firebaseConfig';
import { ref, get, set, push, update, onValue, off, onDisconnect, goOnline, goOffline } from 'firebase/database';
import { Bus, Location, AttendanceRecord, DriverProfile } from '../types';

const BUS_IDS = ['24', '23', '18', '7', '40', '5', '32', '17', '6', '16', '31', '49', '15', '2', '4', '42', '41', '3'];

const DEFAULT_BUSES: Bus[] = BUS_IDS.map(id => ({
    id,
    busNumber: id,
    driverName: `Driver ${id}`,
    route: `Campus Route ${id}`,
    status: 'offline',
    updatedAt: Date.now()
}));

export const firebaseDatabase = {
    validateDriverLogin: async (busId: string, password: string): Promise<{ ok: boolean, reason?: 'NOT_FOUND' | 'WRONG_PASSWORD' | 'NETWORK', isDefault?: boolean }> => {
        const inputPass = String(password).trim();

        try {
            const busRef = ref(database, `buses/${busId}`);
            console.log("Checking path:", `buses/${busId}`);
            
            const snapshot = await get(busRef);

            if (!snapshot.exists()) {
                console.error("❌ Bus profile not found for id:", busId);
                return { ok: false, reason: 'NOT_FOUND' };
            }

            const busData = snapshot.val();
            // Try to gently grab the password (support old accessKey or new password field)
            const dbPass = String(busData.password || busData.accessKey || '').trim();
            const isDefault = busData.isDefaultPassword === true || dbPass === '123456';

            console.log("Entered:", inputPass);
            console.log("Stored:", busData.password || busData.accessKey ? "Exists" : "Empty");

            if (dbPass === inputPass && inputPass !== '') {
                return { ok: true, isDefault };
            } else {
                console.log("❌ Password mismatch");
                return { ok: false, reason: 'WRONG_PASSWORD' };
            }
        } catch (error: any) {
            console.error("Login lookup failed:", error);
            return { ok: false, reason: 'NETWORK' };
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

    updateDriverPassword: async (busId: string, newPassword: string): Promise<void> => {
        try {
            // Update the bus record directly as expected by the fleet login system
            await update(ref(database, `buses/${busId}`), {
                password: newPassword,
                isDefaultPassword: false
            });
            console.log(`✅ Password updated for bus: ${busId}`);
        } catch (error) {
            console.error('Failed to update bus password:', error);
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
                const busList: Bus[] = Object.entries(data).map(([key, val]: [string, any]) => {
                    const number = key.includes('_') ? key.split("_")[1] : key;
                    return {
                        id: key,
                        busNumber: number,
                        driverName: val.driverName || val.name || `Driver ${number}`,
                        route: val.route || `Campus Route ${number}`,
                        status: val.status || 'offline',
                        location: val.location,
                        updatedAt: val.updatedAt
                    };
                });
                return busList;
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
     * Sets `status` in the bus record.
     */
    setDriverOnline: async (busId: string, online: boolean): Promise<void> => {
        try {
            await update(ref(database, `buses/${busId}`), {
                status: online ? 'online' : 'offline',
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
            status: 'offline',
            updatedAt: Date.now(),
        });
    },

    /**
     * FIX 12: Update bus location with "Live" status logic.
     * FIX 1: Send low-latency granular object updates targeting location & status directly.
     */
    updateBusLocation: async (busId: string, location: Location): Promise<void> => {
        // Validation: Ignore invalid or zero locations
        if (!location || (location.lat === 0 && location.lng === 0) || isNaN(location.lat) || isNaN(location.lng)) {
            console.warn('⚠️ updateBusLocation - Skipped invalid coordinates:', location);
            return;
        }

        try {
            // Atomic update specifically to location nodes rather than re-sending the whole bus object structure
            await set(ref(database, `buses/${busId}/location`), location);
            // Non-blocking status push
            set(ref(database, `buses/${busId}/status`), 'online');
            set(ref(database, `buses/${busId}/updatedAt`), Date.now());
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
                const busList: Bus[] = Object.entries(data).map(([key, val]: [string, any]) => {
                    const number = key.includes('_') ? key.split("_")[1] : key;
                    return {
                        id: key,
                        busNumber: number,
                        driverName: val.driverName || val.name || `Driver ${number}`,
                        route: val.route || `Campus Route ${number}`,
                        status: val.status || 'offline',
                        location: val.location,
                        updatedAt: val.updatedAt
                    };
                });
                callback(busList);
            }
        });
        return () => off(busesRef, 'value', listener);
    },

    /**
     * Seed driver accounts and buses for the entire fleet
     */
    seedDefaultData: async (): Promise<void> => {
        try {
            const busData: Record<string, any> = {};

            DEFAULT_BUSES.forEach(bus => {
                const key = `bus_${bus.busNumber}`;
                busData[key] = {
                    ...bus,
                    id: key,
                    name: `Bus ${bus.busNumber}`,
                    password: 'Campus@123'
                };
            });

            await set(ref(database, 'buses'), busData);
            console.log('✅ Bus Accounts and Driver Profiles seeded');
        } catch (error) {
            console.error('Failed to seed default data:', error);
        }
    },

    /**
     * FIX 1: Low Latency Firebase Listener
     * Listen directly to the location node only (not whole bus) to reduce data payload.
     */
    onBusUpdate: (busId: string, callback: (bus: Partial<Bus>) => void) => {
        const locationRef = ref(database, `buses/${busId}/location`);
        
        const unsubscribe = onValue(locationRef, (snapshot) => {
            if (snapshot.exists()) {
                const location = snapshot.val();
                if (location && location.lat) {
                    // Reconstruct into bus shape solely for the MapComponent backward compatibility shim
                    callback({ id: busId, location, status: 'online', updatedAt: location.timestamp || Date.now() });
                }
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

    /**
     * Reconnect/Disconnect Firebase
     */
    goOnline: () => {
        goOnline(database);
    },

    goOffline: () => {
        goOffline(database);
    }
};

export const mockDatabase = firebaseDatabase;
