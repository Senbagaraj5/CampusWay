const API = import.meta.env.VITE_API_URL || 'https://campusway-server-production.up.railway.app';

export const checkinDriver = async (driverName: string, busNumber: string, location: { lat: number, lng: number, accuracy: number }) => {
  try {
    const response = await fetch(`${API}/api/checkin`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        driverName,
        busNumber,
        location,
        timestamp: new Date().toISOString(),
      }),
    });
    return await response.json();
  } catch (error) {
    console.error('API checkinDriver error:', error);
    return { ok: false, error };
  }
};

export const startTrip = async (busNumber: string, driverName: string) => {
  try {
    // Note: aligning with server expectation of driver_id (using busNumber for now as proxy if ID is missing)
    const response = await fetch(`${API}/api/trips/start`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        bus_number: busNumber,
        driver_id: driverName, // Sending driverName as driver_id for debugging
      }),
    });
    const data = await response.json();
    return { ok: response.ok, ...data };
  } catch (error) {
    console.error('API startTrip error:', error);
    return { ok: false, error };
  }
};

export const endTrip = async (tripId: string) => {
  try {
    const response = await fetch(`${API}/api/trips/end`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ tripId }),
    });
    return await response.json();
  } catch (error) {
    console.error('API endTrip error:', error);
    return { ok: false, error };
  }
};
export const saveLocationHistory = async (data: {
  busId: string;
  busLat: number;
  busLng: number;
  studentLat: number | null;
  studentLng: number | null;
  distanceKm: number;
  durationMin: number;
}) => {
  try {
    const response = await fetch(`${API}/api/location-history`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...data,
        timestamp: new Date().toISOString()
      }),
    });
    return await response.json();
  } catch (error) {
    console.error('API saveLocationHistory error:', error);
    return { ok: false };
  }
};