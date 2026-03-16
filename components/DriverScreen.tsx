import React, { useState, useEffect, useRef } from 'react';
import { Coordinates } from '../types';

interface DriverScreenProps {
  busNo: number;
  registration: string;
  route: string;
  onLogout: () => void;
}

const DriverScreen: React.FC<DriverScreenProps> = ({ busNo, registration, route, onLogout }) => {
  const [isSharing, setIsSharing] = useState(false);
  const [coords, setCoords] = useState<Coordinates | null>(null);
  const [speed, setSpeed] = useState(0);
  const [sendCount, setSendCount] = useState(0);
  const [lastSent, setLastSent] = useState<string | null>(null);
  
  const latestCoords = useRef<Coordinates | null>(null);
  const latestSpeed = useRef(0);
  const watchId = useRef<number | null>(null);
  const intervalId = useRef<NodeJS.Timeout | null>(null);
  const API_URL = process.env.REACT_APP_API_URL || 'https://campusway-server-production.up.railway.app';

  const stopSharing = async () => {
    // 1. Clear Watch
    if (watchId.current !== null) {
      navigator.geolocation.clearWatch(watchId.current);
      watchId.current = null;
    }
    // 2. Clear Interval
    if (intervalId.current !== null) {
      clearInterval(intervalId.current);
      intervalId.current = null;
    }
    // 3. Disconnect from Server
    try {
      await fetch(`${API_URL}/api/bus/disconnect`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ busNo })
      });
    } catch (err) {
      console.error("Disconnect failed:", err);
    }
    
    // 4. Reset State
    setIsSharing(false);
    setCoords(null);
    setSpeed(0);
    latestCoords.current = null;
    latestSpeed.current = 0;
  };

  const startSharing = () => {
    if (!navigator.geolocation) {
      alert("Geolocation is not supported by your browser.");
      return;
    }

    setIsSharing(true);

    // Watch Position
    watchId.current = navigator.geolocation.watchPosition(
      (pos) => {
        const { latitude, longitude, speed: mps } = pos.coords;
        const newCoords = { lat: latitude, lng: longitude };
        const newSpeed = mps ? Math.round(mps * 3.6) : 0;
        
        setCoords(newCoords);
        setSpeed(newSpeed);
        
        latestCoords.current = newCoords;
        latestSpeed.current = newSpeed;
      },
      (err) => console.error("GPS Error:", err),
      { enableHighAccuracy: true, maximumAge: 0 }
    );

    // Auto-send every 4 seconds
    intervalId.current = setInterval(async () => {
      if (latestCoords.current) {
        try {
          await fetch(`${API_URL}/api/bus/location`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
              busNo, 
              lat: latestCoords.current.lat, 
              lng: latestCoords.current.lng, 
              speed: latestSpeed.current 
            })
          });
          setSendCount(prev => prev + 1);
          setLastSent(new Date().toLocaleTimeString());
        } catch (err) {
          console.error("Send failed:", err);
        }
      }
    }, 4000);
  };


  useEffect(() => {
    return () => {
      stopSharing();
    };
  }, []);

  const handleLogout = async () => {
    await stopSharing();
    onLogout();
  };

  return (
    <div style={{
      minHeight: '100vh',
      background: '#f8fafc',
      color: '#1e293b',
      padding: '24px',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      fontFamily: "'Inter', sans-serif"
    }}>
      {/* Header */}
      <div style={{ textAlign: 'center', marginBottom: '40px' }}>
        <h1 style={{ fontSize: '48px', margin: '0', fontWeight: '800', letterSpacing: '-2px', color: '#0f172a' }}>
          BUS {busNo}
        </h1>
        <div style={{
          display: 'inline-block',
          padding: '4px 12px',
          background: 'white',
          borderRadius: '20px',
          fontSize: '14px',
          marginTop: '8px',
          border: '1px solid #e2e8f0',
          color: '#64748b'
        }}>
          {registration}
        </div>
        <p style={{ color: '#2563eb', marginTop: '12px', fontSize: '18px', fontWeight: '500' }}>
          {route}
        </p>
      </div>

      {/* Stats Cards */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(3, 1fr)',
        gap: '12px',
        width: '100%',
        maxWidth: '400px',
        marginBottom: '32px'
      }}>
        <StatCard label="Speed" value={`${speed}`} unit="km/h" />
        <StatCard label="Sent" value={`${sendCount}`} unit="times" />
        <StatCard label="Last" value={lastSent || '--:--'} unit="" />
      </div>

      {/* Action Buttons */}
      <div style={{ position: 'relative', marginBottom: '40px' }}>
        {!isSharing ? (
          <button 
            onClick={startSharing}
            style={{
              ...buttonStyle,
              background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
              boxShadow: '0 10px 25px rgba(16, 185, 129, 0.4)'
            }}
          >
            START SHARING
          </button>
        ) : (
          <>
            <div className="pulse-button-ring"></div>
            <button 
              onClick={stopSharing}
              style={{
                ...buttonStyle,
                background: 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)',
                boxShadow: '0 10px 25px rgba(239, 68, 68, 0.4)',
                position: 'relative',
                zIndex: 2
              }}
            >
              STOP SHARING
            </button>
          </>
        )}
      </div>

      {/* Status Info */}
      {isSharing && (
        <div style={{ textAlign: 'center', animation: 'fadeIn 0.5s ease' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#10b981', fontWeight: '600' }}>
            <div className="dot-blink"></div>
            Live — Students can see your location
          </div>
          <div style={{ marginTop: '12px', fontSize: '13px', color: '#94a3b8' }}>
            Lat: {coords?.lat.toFixed(6)} | Lng: {coords?.lng.toFixed(6)}
          </div>
        </div>
      )}

      {/* Logout */}
      <button 
        onClick={handleLogout}
        style={{
          marginTop: 'auto',
          background: 'transparent',
          color: '#64748b',
          border: '1px solid #e2e8f0',
          padding: '10px 24px',
          borderRadius: '12px',
          cursor: 'pointer',
          transition: 'all 0.2s',
          fontWeight: '600'
        }}
        onMouseOver={(e) => { e.currentTarget.style.color = '#0f172a'; e.currentTarget.style.borderColor = '#0f172a'; }}
        onMouseOut={(e) => { e.currentTarget.style.color = '#64748b'; e.currentTarget.style.borderColor = '#e2e8f0'; }}
      >
        Logout
      </button>

      <style>{`
        @keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
        .dot-blink { width: 8px; height: 8px; background: #10b981; border-radius: 50%; animation: blink 1s infinite; }
        @keyframes blink { 0% { opacity: 1; } 50% { opacity: 0.3; } 100% { opacity: 1; } }
        .pulse-button-ring {
          position: absolute;
          top: 0; left: 0; right: 0; bottom: 0;
          border-radius: 40px;
          border: 4px solid #ef4444;
          animation: pulse-ring 1.5s infinite;
        }
        @keyframes pulse-ring { 
          0% { transform: scale(1); opacity: 0.8; }
          100% { transform: scale(1.3); opacity: 0; }
        }
      `}</style>
    </div>
  );
};

const StatCard = ({ label, value, unit }: { label: string, value: string, unit: string }) => (
  <div style={{
    background: 'white',
    padding: '16px 8px',
    borderRadius: '20px',
    textAlign: 'center',
    border: '1px solid #e2e8f0',
    boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)'
  }}>
    <div style={{ fontSize: '11px', color: '#94a3b8', textTransform: 'uppercase', marginBottom: '4px' }}>{label}</div>
    <div style={{ fontSize: '24px', fontWeight: '700' }}>{value}</div>
    <div style={{ fontSize: '10px', color: '#64748b' }}>{unit}</div>
  </div>
);

const buttonStyle: React.CSSProperties = {
  padding: '18px 48px',
  borderRadius: '40px',
  fontSize: '18px',
  fontWeight: '800',
  color: 'white',
  border: 'none',
  cursor: 'pointer',
  transition: 'transform 0.2s active',
  letterSpacing: '1px'
};

export default DriverScreen;
