import React, { useEffect, useState, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Polyline, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { BusLocation, Coordinates } from '../types';

interface StudentMapProps {
  busNo: number;
  studentLocation: Coordinates | null;
}

// Custom Icons
const busIcon = L.divIcon({
  className: 'custom-bus-icon',
  html: `<div style="
    background: #1a56db; 
    width: 40px; 
    height: 40px; 
    border-radius: 50% 50% 50% 0; 
    transform: rotate(-45deg); 
    display: flex; 
    align-items: center; 
    justify-content: center; 
    border: 3px solid white; 
    box-shadow: 0 4px 6px rgba(0,0,0,0.3);
  ">
    <span style="transform: rotate(45deg); font-size: 20px;">🚌</span>
  </div>`,
  iconSize: [40, 40],
  iconAnchor: [20, 40],
});

const studentIcon = L.divIcon({
  className: 'custom-student-icon',
  html: `<div class="pulse-ring"></div>
         <div style="background: #10b981; width: 16px; height: 16px; border-radius: 50%; border: 3px solid white; box-shadow: 0 0 10px rgba(16,185,129,0.5);"></div>`,
  iconSize: [20, 20],
  iconAnchor: [10, 10],
});

// Map Controller for Zoom and Panning
const MapControls = ({ busLocation }: { busLocation: Coordinates | null }) => {
  const map = useMap();
  
  const handleZoomIn = () => map.zoomIn();
  const handleZoomOut = () => map.zoomOut();
  const handleFlyToBus = () => {
    if (busLocation) {
      map.flyTo([busLocation.lat, busLocation.lng], 16, { animate: true, duration: 1.5 });
    }
  };

  return (
    <div className="custom-map-controls" style={{
      position: 'absolute', bottom: '20px', right: '20px', zIndex: 1000,
      display: 'flex', flexDirection: 'column', gap: '10px'
    }}>
      <button onClick={handleZoomIn} style={controlStyle}>+</button>
      <button onClick={handleZoomOut} style={controlStyle}>−</button>
      <button onClick={handleFlyToBus} style={{...controlStyle, background: '#1a56db', color: 'white'}}>🎯</button>
    </div>
  );
};

const controlStyle: React.CSSProperties = {
  width: '44px', height: '44px', background: 'white', border: 'none',
  borderRadius: '12px', fontSize: '20px', fontWeight: 'bold',
  boxShadow: '0 4px 6px rgba(0,0,0,0.1)', cursor: 'pointer',
  display: 'flex', alignItems: 'center', justifyContent: 'center'
};

const StudentMap: React.FC<StudentMapProps> = ({ busNo, studentLocation }) => {
  const [bus, setBus] = useState<BusLocation | null>(null);
  const [route, setRoute] = useState<[number, number][]>([]);
  const [eta, setEta] = useState<number | null>(null);
  const [distance, setDistance] = useState<string | null>(null);
  const [isOnline, setIsOnline] = useState(false);
  const API_URL = process.env.REACT_APP_API_URL || 'https://campusway-server-production.up.railway.app';

  // Poll for location
  useEffect(() => {
    const fetchLocation = async () => {
      try {
        const res = await fetch(`${API_URL}/api/bus/${busNo}/location`);
        const data = await res.json();
        if (data.online) {
          setBus(data.bus);
          setIsOnline(true);
        } else {
          setIsOnline(false);
          setBus(null);
          setRoute([]);
        }
      } catch (err) {
        console.error("Error fetching bus location:", err);
        setIsOnline(false);
      }
    };

    fetchLocation();
    const interval = setInterval(fetchLocation, 5000);
    return () => clearInterval(interval);
  }, [busNo, API_URL]);

  // Fetch OSRM Route
  useEffect(() => {
    if (!bus || !studentLocation) return;

    const fetchRoute = async () => {
      try {
        const url = `https://router.project-osrm.org/route/v1/driving/${bus.Longitude},${bus.Latitude};${studentLocation.lng},${studentLocation.lat}?overview=full&geometries=geojson`;
        const res = await fetch(url);
        const data = await res.json();

        if (data.routes && data.routes[0]) {
          const coords = data.routes[0].geometry.coordinates.map((c: any) => [c[1], c[0]]);
          setRoute(coords);
          
          const distMeters = data.routes[0].distance;
          setDistance(distMeters > 1000 ? `${(distMeters / 1000).toFixed(1)} km` : `${Math.round(distMeters)} m`);
          
          // ETA Calculation
          const speedKph = bus.Speed > 2 ? bus.Speed : 30; // Default 30km/h
          const timeMinutes = Math.round((distMeters / 1000) / (speedKph / 60));
          setEta(timeMinutes);
        } else {
          // Fallback to straight line
          setRoute([[bus.Latitude, bus.Longitude], [studentLocation.lat, studentLocation.lng]]);
        }
      } catch (err) {
        console.error("OSRM Error:", err);
        setRoute([[bus.Latitude, bus.Longitude], [studentLocation.lat, studentLocation.lng]]);
      }
    };

    fetchRoute();
  }, [bus, studentLocation]);

  return (
    <div style={{ width: '100%', height: '100%', position: 'relative' }}>
      {/* Status Bar */}
      <div style={{
        position: 'absolute', top: '20px', left: '20px', zIndex: 1000,
        background: 'rgba(255, 255, 255, 0.95)', padding: '15px', borderRadius: '16px',
        boxShadow: '0 8px 16px rgba(0,0,0,0.1)', backdropFilter: 'blur(8px)',
        minWidth: '220px', border: '1px solid rgba(255,255,255,0.3)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
          <div style={{ 
            width: '10px', height: '10px', borderRadius: '50%', 
            background: isOnline ? '#10b981' : '#ef4444',
            boxShadow: isOnline ? '0 0 10px #10b981' : 'none'
          }}></div>
          <span style={{ fontWeight: 'bold', fontSize: '18px' }}>Bus {busNo}</span>
          <span style={{ fontSize: '12px', color: '#6b7280', marginLeft: 'auto' }}>
            {bus?.Registration}
          </span>
        </div>
        
        {isOnline ? (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', fontSize: '14px' }}>
            <div>
              <div style={{ color: '#6b7280', fontSize: '11px', textTransform: 'uppercase' }}>Route</div>
              <div style={{ fontWeight: '600' }}>{bus?.Route}</div>
            </div>
            <div>
              <div style={{ color: '#6b7280', fontSize: '11px', textTransform: 'uppercase' }}>Speed</div>
              <div style={{ fontWeight: '600' }}>{Math.round(bus?.Speed || 0)} km/h</div>
            </div>
            <div>
              <div style={{ color: '#6b7280', fontSize: '11px', textTransform: 'uppercase' }}>Distance</div>
              <div style={{ fontWeight: '600', color: '#1a56db' }}>{distance || '--'}</div>
            </div>
            <div>
              <div style={{ color: '#6b7280', fontSize: '11px', textTransform: 'uppercase' }}>ETA</div>
              <div style={{ fontWeight: '600', color: '#1a56db' }}>{eta ? `${eta} mins` : '--'}</div>
            </div>
          </div>
        ) : (
          <div style={{ color: '#ef4444', fontWeight: 'bold', fontSize: '14px' }}>
            Bus is currently offline
          </div>
        )}
      </div>

      {/* Offline Banner */}
      {!isOnline && (
        <div style={{
          position: 'absolute', bottom: '80px', left: '50%', transform: 'translateX(-50%)',
          zIndex: 1000, background: '#fee2e2', color: '#ef4444', padding: '10px 20px',
          borderRadius: '30px', fontWeight: 'bold', border: '1px solid #fca5a5',
          boxShadow: '0 4px 12px rgba(239, 68, 68, 0.2)'
        }}>
          ⚠️ Connection lost. Waiting for bus...
        </div>
      )}

      <MapContainer
        center={[10.3159, 78.8242]}
        zoom={14}
        style={{ width: '100%', height: '100%', borderRadius: '24px' }}
        zoomControl={false}
      >
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        />
        
        {isOnline && bus && (
          <Marker position={[bus.Latitude, bus.Longitude]} icon={busIcon} />
        )}
        
        {studentLocation && (
          <Marker position={[studentLocation.lat, studentLocation.lng]} icon={studentIcon} />
        )}

        {route.length > 0 && (
          <Polyline 
            positions={route} 
            pathOptions={{ color: '#1a56db', weight: 5, opacity: 0.8 }} 
          />
        )}

        <MapControls busLocation={bus ? { lat: bus.Latitude, lng: bus.Longitude } : null} />
      </MapContainer>

      <style>{`
        .pulse-ring {
          position: absolute;
          width: 30px;
          height: 30px;
          border: 3px solid #10b981;
          border-radius: 50%;
          animation: pulse 1.5s infinite;
          margin-left: -5px;
          margin-top: -5px;
        }
        @keyframes pulse {
          0% { transform: scale(0.5); opacity: 1; }
          100% { transform: scale(1.5); opacity: 0; }
        }
        .leaflet-container {
          background: #f3f4f6;
        }
      `}</style>
    </div>
  );
};

export default StudentMap;
