import React, { useState, useEffect } from 'react';

interface BusItem {
  busNo: number;
  registration: string;
  route: string;
  isSpare: boolean;
  isOnline: boolean;
}

interface Props {
  onDriverLogin: (session: {
    busNo: number;
    registration: string;
    route: string;
  }) => void;
  onCancel: () => void;
}

const FALLBACK_BUSES: BusItem[] = [
  { busNo: 2,  registration: 'TN63AJ8602', route: 'Neivasal',                isSpare: false, isOnline: false },
  { busNo: 3,  registration: 'TN63AK1260', route: 'SS.Kottai',               isSpare: false, isOnline: false },
  { busNo: 4,  registration: 'TN63AK1264', route: 'Illupakudi',              isSpare: false, isOnline: false },
  { busNo: 6,  registration: 'TN63AJ8845', route: 'Senjai',                  isSpare: false, isOnline: false },
  { busNo: 7,  registration: 'TN63AL8220', route: 'Thirupathur Pudhu Theru', isSpare: false, isOnline: false },
  { busNo: 8,  registration: 'TN63AJ8903', route: 'Singampunari',            isSpare: false, isOnline: false },
  { busNo: 9,  registration: 'TN63AL8156', route: 'Spare',                   isSpare: true,  isOnline: false },
  { busNo: 11, registration: 'TN63AL9236', route: 'Spare',                   isSpare: true,  isOnline: false },
  { busNo: 12, registration: 'TN63AJ8611', route: 'Spare',                   isSpare: true,  isOnline: false },
  { busNo: 13, registration: 'TN63AJ8570', route: 'Spare',                   isSpare: true,  isOnline: false },
  { busNo: 14, registration: 'TN63BA0058', route: 'Velangudi',               isSpare: false, isOnline: false },
  { busNo: 15, registration: 'TN63BA0204', route: 'Karaikudi',               isSpare: false, isOnline: false },
  { busNo: 16, registration: 'TN63BA3179', route: 'Eriyur',                  isSpare: false, isOnline: false },
  { busNo: 17, registration: 'TN63BC3589', route: 'Akilmanai Thirupathur',   isSpare: false, isOnline: false },
  { busNo: 18, registration: 'TN63BC3805', route: 'Sembanur',                isSpare: false, isOnline: false },
  { busNo: 19, registration: 'TN63BD8042', route: 'Kotaiyur',                isSpare: false, isOnline: false },
  { busNo: 20, registration: 'TN63BE0936', route: 'Keelasevalpatti',         isSpare: false, isOnline: false },
  { busNo: 34, registration: 'TN55AC5864', route: 'Kallutimedu',             isSpare: false, isOnline: false },
  { busNo: 50, registration: 'TN55BC5526', route: 'Elanthaimangalam',        isSpare: false, isOnline: false },
];

const API_BASE = process.env.REACT_APP_API_URL 
  || 'https://campusway-server-production.up.railway.app';

const DriverLogin: React.FC<Props> = ({ onDriverLogin, onCancel }) => {
  const [loading, setLoading] = useState(true);
  const [buses, setBuses] = useState<BusItem[]>([]);
  const [selectedBus, setSelectedBus] = useState<BusItem | null>(null);
  const [password, setPassword] = useState('');
  const [loginLoading, setLoginLoading] = useState(false);
  const [loginError, setLoginError] = useState('');
  const [isShaking, setIsShaking] = useState(false);

  useEffect(() => {
    const fetchBuses = async () => {
      try {
        setLoading(true);
        const res = await fetch(`${API_BASE}/api/admin/buses`);
        const data = await res.json();
        const list = data.buses || [];
        setBuses(list.map((b: any) => ({
          busNo: b.BusNo,
          registration: b.Registration,
          route: b.Route,
          isSpare: b.IsActive === 0,
          isOnline: b.IsOnline === 1,
        })));
      } catch (err) {
        console.error('Failed to fetch buses:', err);
        setBuses(FALLBACK_BUSES);
      } finally {
        setLoading(false);
      }
    };
    fetchBuses();
  }, []);

  const handleBusClick = (bus: BusItem) => {
    if (bus.isSpare) return;
    setSelectedBus(bus);
    setLoginError('');
    setPassword('');
  };

  const handleLogin = async () => {
    if (!selectedBus || !password.trim()) return;
    
    setLoginLoading(true);
    setLoginError('');
    
    try {
      const res = await fetch(`${API_BASE}/api/driver/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          busNo: selectedBus.busNo, 
          password: password.trim() 
        })
      });
      
      const data = await res.json();
      
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Login failed');
      }
      
      onDriverLogin({
        busNo: data.bus.BusNo,
        registration: data.bus.Registration,
        route: data.bus.Route
      });
    } catch (err: any) {
      triggerShake();
      if (err.message === 'Failed to fetch') {
        setLoginError('Cannot reach server. Check internet connection.');
      } else {
        setLoginError('Invalid registration number. Try again.');
      }
    } finally {
      setLoginLoading(false);
    }
  };

  const triggerShake = () => {
    setIsShaking(true);
    setTimeout(() => setIsShaking(false), 500);
  };

  if (loading) return <LoadingSpinner />;
  if (buses.length === 0) return <EmptyState />;

  return (
    <div style={{
      height: '100vh',
      backgroundColor: '#f8fafc',
      color: '#1e293b',
      overflowY: 'auto',
      WebkitOverflowScrolling: 'touch',
      fontFamily: "'Inter', sans-serif",
      width: '100%',
      boxSizing: 'border-box',
      paddingBottom: '80px'
    }}>
      <div style={{ padding: '16px', maxWidth: '480px', margin: '0 auto' }}>
        {/* Header - Reduced Height */}
        <div style={{ textAlign: 'center', padding: '12px 0', marginBottom: '12px' }}>
          <div style={{ fontSize: '32px', marginBottom: '8px', height: '48px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>🎓</div>
          <h1 style={{ fontSize: '20px', fontWeight: '800', margin: '0', color: '#0f172a' }}>Driver Authentication</h1>
          <p style={{ color: '#2563eb', fontSize: '10px', fontWeight: 'bold', letterSpacing: '2px', textTransform: 'uppercase', marginTop: '4px' }}>
            DRIVER LOGIN
          </p>
        </div>

        <BusGrid buses={[...buses].sort((a, b) => a.busNo - b.busNo)} onBusClick={handleBusClick} />
      </div>

      {/* Fixed Cancel Button */}
      <div style={{ 
        position: 'fixed', 
        bottom: 0, 
        left: 0, 
        right: 0, 
        backgroundColor: 'white', 
        padding: '16px', 
        textAlign: 'center',
        borderTop: '1px solid #e2e8f0',
        zIndex: 100
      }}>
        <button 
          onClick={onCancel}
          style={{
            background: 'none',
            border: 'none',
            color: '#64748b',
            fontSize: '14px',
            textDecoration: 'underline',
            cursor: 'pointer'
          }}
        >
          CANCEL & RETURN
        </button>
      </div>

      {/* Password Modal */}
      {selectedBus && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.4)',
          backdropFilter: 'blur(8px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 1000, padding: '20px'
        }}>
          <div style={{
            backgroundColor: 'white',
            borderRadius: '24px',
            width: '100%', maxWidth: '360px',
            padding: '32px',
            color: '#1e293b',
            boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)',
            animation: 'modalOpen 0.3s ease-out'
          }}>
            <h2 style={{ fontSize: '24px', fontWeight: '800', margin: '0 0 8px 0' }}>Bus {selectedBus.busNo}</h2>
            <p style={{ fontSize: '14px', color: '#64748b', margin: '0 0 24px 0' }}>
              Enter registration number for {selectedBus.registration.substring(0, 4)}...
            </p>

            <div style={{ marginBottom: '24px' }}>
              <input 
                type="password"
                placeholder="Enter registration number"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoFocus
                style={{
                  width: '100%',
                  padding: '16px',
                  borderRadius: '12px',
                  border: `2px solid ${loginError ? '#ef4444' : '#e2e8f0'}`,
                  fontSize: '16px',
                  outline: 'none',
                  transition: 'all 0.2s',
                  boxSizing: 'border-box'
                }}
                className={isShaking ? 'shake' : ''}
              />
              {loginError && (
                <p style={{ color: '#ef4444', fontSize: '12px', marginTop: '8px', fontWeight: '600' }}>
                  {loginError}
                </p>
              )}
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <button 
                onClick={handleLogin}
                disabled={loginLoading}
                style={{
                  width: '100%',
                  padding: '16px',
                  borderRadius: '12px',
                  backgroundColor: '#2563eb',
                  color: 'white',
                  fontSize: '16px',
                  fontWeight: '700',
                  border: 'none',
                  cursor: 'pointer',
                  boxShadow: '0 10px 15px -3px rgba(37, 99, 235, 0.3)'
                }}
              >
                {loginLoading ? 'Authenticating...' : 'CONFIRM'}
              </button>
              <button 
                onClick={() => setSelectedBus(null)}
                style={{
                  width: '100%',
                  padding: '12px',
                  borderRadius: '12px',
                  backgroundColor: 'transparent',
                  color: '#64748b',
                  fontSize: '14px',
                  fontWeight: '600',
                  border: 'none',
                  cursor: 'pointer'
                }}
              >
                CANCEL
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Global CSS for Animations */}
      <style>{`
        @keyframes modalOpen {
          from { opacity: 0; transform: scale(0.9) translateY(20px); }
          to { opacity: 1; transform: scale(1) translateY(0); }
        }
        .bus-card-active:hover {
          transform: translateY(-4px);
          border-color: #2563eb !important;
          box-shadow: 0 10px 20px rgba(0,0,0,0.05) !important;
        }
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          20%, 60% { transform: translateX(-6px); }
          40%, 80% { transform: translateX(6px); }
        }
        .shake { animation: shake 0.4s ease-in-out; }
      `}</style>
    </div>
  );
};

const BusGrid: React.FC<{ buses: BusItem[], onBusClick: (bus: BusItem) => void }> = ({ buses, onBusClick }) => (
  <div style={{ 
    display: 'grid', 
    gridTemplateColumns: '1fr 1fr', 
    gap: '10px', 
    width: '100%'
  }}>
    {buses.map(bus => (
      <div 
        key={bus.busNo}
        onClick={() => onBusClick(bus)}
        style={{
          backgroundColor: !bus.isSpare ? 'white' : '#f1f5f9',
          border: `1.5px solid ${!bus.isSpare ? '#e2e8f0' : '#e2e8f0'}`,
          borderRadius: '12px',
          padding: '14px',
          cursor: !bus.isSpare ? 'pointer' : 'default',
          opacity: !bus.isSpare ? 1 : 0.4,
          pointerEvents: !bus.isSpare ? 'auto' : 'none',
          transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
          position: 'relative',
          boxSizing: 'border-box'
        }}
        className={!bus.isSpare ? 'bus-card-active' : ''}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <span style={{ 
            fontSize: '24px', 
            fontWeight: '800', 
            color: !bus.isSpare ? '#111827' : '#94a3b8' 
          }}>
            {bus.busNo}
          </span>
          <div style={{ 
            display: 'flex', 
            alignItems: 'center', 
            gap: '4px',
            background: bus.isOnline ? '#10b98115' : '#94a3b815',
            padding: '2px 6px',
            borderRadius: '4px'
          }}>
            <div style={{ 
              width: '6px', height: '6px', borderRadius: '50%', 
              backgroundColor: bus.isOnline ? '#10b981' : '#94a3b8'
            }}></div>
            <span style={{ fontSize: '9px', fontWeight: '700', color: bus.isOnline ? '#10b981' : '#94a3b8' }}>
              {bus.isOnline ? 'ONLINE' : 'OFFLINE'}
            </span>
          </div>
        </div>

        <div style={{ marginTop: '8px' }}>
          <div style={{ fontSize: '9px', color: '#6b7280', textTransform: 'uppercase', fontWeight: '600' }}>
            ROUTE
          </div>
          <div style={{ fontSize: '12px', fontWeight: '800', color: !bus.isSpare ? '#374151' : '#94a3b8', marginTop: '1px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {bus.route}
          </div>
        </div>
        
        <div style={{ fontSize: '10px', color: '#9ca3af', marginTop: '6px', fontFamily: 'monospace' }}>
          {bus.registration}
        </div>
      </div>
    ))}
  </div>
);

const LoadingSpinner = () => (
  <div style={{ 
    height: '100vh', display: 'flex', flexWrap: 'wrap', 
    gap: '20px', padding: '40px 20px', backgroundColor: '#f8fafc',
    justifyContent: 'center', alignItems: 'flex-start'
  }}>
    <div style={{ width: '100%', maxWidth: '480px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
      {[1, 2, 3, 4, 5, 6].map(i => (
        <div key={i} style={{ 
          height: '140px', backgroundColor: '#e2e8f0', borderRadius: '16px',
          animation: 'pulse-bg 1.5s infinite ease-in-out'
        }}></div>
      ))}
    </div>
    <style>{`
      @keyframes pulse-bg { 
        0% { background-color: #f1f5f9; } 
        50% { background-color: #e2e8f0; } 
        100% { background-color: #f1f5f9; } 
      }
    `}</style>
  </div>
);

const EmptyState = () => (
  <div style={{ 
    height: '100vh', display: 'flex', flexDirection: 'column',
    justifyContent: 'center', alignItems: 'center', backgroundColor: '#f8fafc',
    color: '#64748b', fontFamily: "'Inter', sans-serif"
  }}>
    <div style={{ fontSize: '48px', marginBottom: '16px' }}>📭</div>
    <h3 style={{ fontSize: '18px', fontWeight: '700', color: '#1e293b' }}>No Buses Found</h3>
    <p style={{ fontSize: '14px', marginTop: '4px' }}>Please check your internet connection.</p>
    <button 
      onClick={() => window.location.reload()}
      style={{
        marginTop: '24px', padding: '10px 24px', borderRadius: '8px',
        backgroundColor: '#2563eb', color: 'white', border: 'none',
        fontWeight: '600', cursor: 'pointer'
      }}
    >
      Retry
    </button>
  </div>
);

export default DriverLogin;
