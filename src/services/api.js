// src/services/api.js
const API = 'https://campusway-server-production.up.railway.app';


// Driver Check-in with location
export const checkinDriver = async (driverName, busNumber, location) => {
  try {
    const res = await fetch(`${API}/api/checkin`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ driverName, busNumber, location })
    });
    return res.json();
  } catch (err) {
    console.error('Checkin error:', err);
    return { ok: false, error: err.message };
  }
};

// Get all buses
export const getBuses = async () => {
  try {
    const res = await fetch(`${API}/api/buses`);
    return res.json();
  } catch (err) {
    console.error('Get buses error:', err);
    return { ok: false, error: err.message };
  }
};

// Get bus stops
export const getBusStops = async (busNumber) => {
  try {
    const res = await fetch(`${API}/api/buses/${busNumber}/stops`);
    return res.json();
  } catch (err) {
    console.error('Get stops error:', err);
    return { ok: false, error: err.message };
  }
};

// Student login by roll number
export const studentLogin = async (rollNumber) => {
  try {
    const res = await fetch(`${API}/api/students/${rollNumber}`);
    return res.json();
  } catch (err) {
    console.error('Student login error:', err);
    return { ok: false, error: err.message };
  }
};

// Start trip
export const startTrip = async (busNumber, driverName) => {
  try {
    const response = await fetch(`${API}/api/trips/start`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        busNumber,
        driverName,
      }),
    });
    const data = await response.json();
    return { ok: response.ok, tripId: data.tripId, ...data };
  } catch (error) {
    console.error('API startTrip error:', error);
    return { ok: false, error };
  }
};

// End trip
export const endTrip = async (tripId) => {
  try {
    const response = await fetch(`${API}/api/trips/${tripId}/end`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
    });
    return await response.json();
  } catch (error) {
    console.error('API endTrip error:', error);
    return { ok: false, error };
  }
};
// Get trip history
export const getTripHistory = async (busNumber) => {
  try {
    const res = await fetch(
      `${API}/api/trips/history?bus=${busNumber}`
    );
    return res.json();
  } catch (err) {
    console.error('Trip history error:', err);
    return { ok: false, error: err.message };
  }
};

// Save location to SQL (trip history)
export const saveLocation = async (tripId, busNumber, location) => {
  try {
    const res = await fetch(`${API}/api/trips/${tripId}/location`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ busNumber, location })
    });
    return res.json();
  } catch (err) {
    console.error('Save location error:', err);
    return { ok: false, error: err.message };
  }
};

// Health check
export const healthCheck = async () => {
  try {
    const res = await fetch(`${API}/health`);
    return res.json();
  } catch (err) {
    return { status: 'error', error: err.message };
  }
};
