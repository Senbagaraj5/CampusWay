import React, { useState, useEffect } from 'react';
import { Bus, BusUpdatePayload } from '../types';

const AdminPanel: React.FC = () => {
  const [buses, setBuses] = useState<Bus[]>([]);
  const [search, setSearch] = useState('');
  const [editingBus, setEditingBus] = useState<number | null>(null);
  const [editData, setEditData] = useState<BusUpdatePayload>({});
  const [toasts, setToasts] = useState<{id: number, msg: string, type: 'success' | 'error'}[]>([]);
  
  const API_URL = process.env.REACT_APP_API_URL || 'https://campusway-server-production.up.railway.app';

  const fetchBuses = async () => {
    try {
      const res = await fetch(`${API_URL}/api/admin/buses`);
      const data = await res.json();
      setBuses(data.buses);
    } catch (err) {
      showToast("Failed to fetch buses", 'error');
    }
  };

  useEffect(() => {
    fetchBuses();
    const interval = setInterval(fetchBuses, 10000);
    return () => clearInterval(interval);
  }, []);

  const showToast = (msg: string, type: 'success' | 'error') => {
    const id = Date.now();
    setToasts(prev => [...prev, { id, msg, type }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 3000);
  };

  const startEdit = (bus: Bus) => {
    setEditingBus(bus.BusNo);
    setEditData({
      registration: bus.Registration,
      route: bus.Route,
      isActive: bus.IsActive
    });
  };

  const saveEdit = async (busNo: number) => {
    try {
      const res = await fetch(`${API_URL}/api/admin/bus/${busNo}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editData)
      });
      if (res.ok) {
        showToast(`Bus ${busNo} updated successfully`, 'success');
        setEditingBus(null);
        fetchBuses();
      } else {
        throw new Error();
      }
    } catch (err) {
      showToast("Failed to update bus", 'error');
    }
  };

  const filteredBuses = buses.filter(b => 
    b.BusNo.toString().includes(search) ||
    b.Registration.toLowerCase().includes(search.toLowerCase()) ||
    b.Route.toLowerCase().includes(search.toLowerCase())
  );

  const stats = {
    total: buses.length,
    active: buses.filter(b => b.IsActive).length,
    online: buses.filter(b => b.IsOnline).length
  };

  return (
    <div style={{
      minHeight: '100vh',
      background: '#f8fafc',
      padding: '40px 20px',
      fontFamily: "'Inter', sans-serif",
      color: '#1e293b'
    }}>
      <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
        {/* Header */}
        <div style={{ marginBottom: '32px' }}>
          <h1 style={{ fontSize: '32px', fontWeight: '800', color: '#1a56db', margin: '0 0 8px 0' }}>
            Admin Fleet Manager
          </h1>
          <p style={{ color: '#64748b', fontSize: '16px' }}>Manage and monitor CampusWay tracking system</p>
        </div>

        {/* Stats Row */}
        <div style={{ display: 'flex', gap: '20px', marginBottom: '32px' }}>
          <StatCard label="Live Now" value={stats.online} color="#10b981" pulse />
          <StatCard label="Active Buses" value={stats.active} color="#1a56db" />
          <StatCard label="Total Fleet" value={stats.total} color="#64748b" />
        </div>

        {/* Table Container */}
        <div style={{ 
          background: 'white', 
          borderRadius: '24px', 
          boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)',
          overflow: 'hidden',
          border: '1px solid #e2e8f0'
        }}>
          {/* Toolbar */}
          <div style={{ padding: '24px', borderBottom: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ position: 'relative', width: '320px' }}>
              <input 
                type="text" 
                placeholder="Search bus, registration or route..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                style={{
                  width: '100%',
                  padding: '12px 16px',
                  borderRadius: '12px',
                  border: '1px solid #cbd5e1',
                  fontSize: '14px',
                  outline: 'none',
                  transition: 'border-color 0.2s'
                }}
              />
            </div>
            <div style={{ fontSize: '13px', color: '#94a3b8' }}>
              Refreshing every 10 seconds
            </div>
          </div>

          {/* Table */}
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
              <thead>
                <tr style={{ background: '#f8fafc', borderBottom: '1px solid #f1f5f9' }}>
                  <th style={thStyle}>Bus No</th>
                  <th style={thStyle}>Registration</th>
                  <th style={thStyle}>Route</th>
                  <th style={thStyle}>Status</th>
                  <th style={thStyle}>Live</th>
                  <th style={thStyle}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredBuses.map(bus => (
                  <tr key={bus.BusNo} style={trStyle}>
                    <td style={tdStyle}>
                      <span style={{ 
                        background: '#eff6ff', color: '#1a56db', 
                        padding: '4px 12px', borderRadius: '8px', fontWeight: '700' 
                      }}>
                        {bus.BusNo}
                      </span>
                    </td>
                    <td style={tdStyle}>
                      {editingBus === bus.BusNo ? (
                        <input 
                          type="text" 
                          value={editData.registration}
                          onChange={(e) => setEditData({...editData, registration: e.target.value})}
                          style={inputStyle}
                        />
                      ) : (
                        <span style={{ fontFamily: 'monospace', fontWeight: '500' }}>{bus.Registration}</span>
                      )}
                    </td>
                    <td style={tdStyle}>
                      {editingBus === bus.BusNo ? (
                        <input 
                          type="text" 
                          value={editData.route}
                          onChange={(e) => setEditData({...editData, route: e.target.value})}
                          style={inputStyle}
                        />
                      ) : (
                        bus.Route
                      )}
                    </td>
                    <td style={tdStyle}>
                      {editingBus === bus.BusNo ? (
                        <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                          <input 
                            type="checkbox" 
                            checked={editData.isActive}
                            onChange={(e) => setEditData({...editData, isActive: e.target.checked})}
                          />
                          Active
                        </label>
                      ) : (
                        <Badge label={bus.IsActive ? 'Active' : 'Spare'} color={bus.IsActive ? '#10b981' : '#94a3b8'} />
                      )}
                    </td>
                    <td style={tdStyle}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <div style={{ 
                          width: '10px', height: '10px', borderRadius: '50%', 
                          background: bus.IsOnline ? '#10b981' : '#cbd5e1',
                          boxShadow: bus.IsOnline ? '0 0 8px #10b981' : 'none'
                        }}></div>
                        <span style={{ fontSize: '12px', color: bus.IsOnline ? '#10b981' : '#94a3b8', fontWeight: '600' }}>
                          {bus.IsOnline ? 'ONLINE' : 'OFFLINE'}
                        </span>
                      </div>
                    </td>
                    <td style={tdStyle}>
                      {editingBus === bus.BusNo ? (
                        <div style={{ display: 'flex', gap: '8px' }}>
                          <button onClick={() => saveEdit(bus.BusNo)} style={saveBtnStyle}>Save</button>
                          <button onClick={() => setEditingBus(null)} style={cancelBtnStyle}>Cancel</button>
                        </div>
                      ) : (
                        <button onClick={() => startEdit(bus)} style={editBtnStyle}>Edit</button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Toast Notifications */}
      <div style={{ position: 'fixed', bottom: '24px', right: '24px', display: 'flex', flexDirection: 'column', gap: '12px', zIndex: 10000 }}>
        {toasts.map(t => (
          <div key={t.id} style={{
            background: t.type === 'success' ? '#10b981' : '#ef4444',
            color: 'white', padding: '12px 24px', borderRadius: '12px',
            boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.2)',
            animation: 'slideUp 0.3s ease-out'
          }}>
            {t.msg}
          </div>
        ))}
      </div>

      <style>{`
        @keyframes slideUp { from { transform: translateY(100%); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
        tr:hover { background-color: #f8fafc; scale: 1.002; }
      `}</style>
    </div>
  );
};

// Components
const StatCard = ({ label, value, color, pulse }: any) => (
  <div style={{
    background: 'white', padding: '20px', borderRadius: '20px', flex: 1,
    border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)'
  }}>
    <div style={{ fontSize: '13px', color: '#64748b', fontWeight: '600', textTransform: 'uppercase', marginBottom: '8px' }}>{label}</div>
    <div style={{ fontSize: '32px', fontWeight: '800', color, display: 'flex', alignItems: 'center', gap: '10px' }}>
      {value}
      {pulse && <div style={{ width: '12px', height: '12px', background: color, borderRadius: '50%', animation: 'ping 1s cubic-bezier(0, 0, 0.2, 1) infinite' }}></div>}
    </div>
  </div>
);

const Badge = ({ label, color }: any) => (
  <span style={{
    fontSize: '11px', fontWeight: '700', textTransform: 'uppercase',
    padding: '4px 10px', borderRadius: '20px', 
    background: `${color}15`, color: color,
    border: `1px solid ${color}30`
  }}>
    {label}
  </span>
);

// Styles
const thStyle: React.CSSProperties = { padding: '16px 24px', fontSize: '13px', color: '#64748b', fontWeight: '600' };
const tdStyle: React.CSSProperties = { padding: '16px 24px', fontSize: '14px', borderBottom: '1px solid #f1f5f9', transition: 'all 0.2s' };
const trStyle: React.CSSProperties = { transition: 'background-color 0.2s, transform 0.2s' };
const inputStyle: React.CSSProperties = { padding: '8px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '14px', width: '100%' };
const editBtnStyle: React.CSSProperties = { 
  background: 'white', border: '1px solid #cbd5e1', padding: '6px 16px', borderRadius: '8px', 
  fontSize: '13px', fontWeight: '600', cursor: 'pointer', transition: 'all 0.2s' 
};
const saveBtnStyle: React.CSSProperties = { 
  background: '#1a56db', color: 'white', border: 'none', padding: '6px 16px', borderRadius: '8px', 
  fontSize: '13px', fontWeight: '600', cursor: 'pointer' 
};
const cancelBtnStyle: React.CSSProperties = { 
  background: '#f1f5f9', color: '#64748b', border: 'none', padding: '6px 16px', borderRadius: '8px', 
  fontSize: '13px', fontWeight: '600', cursor: 'pointer' 
};

export default AdminPanel;
