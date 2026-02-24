
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { UserRole, Bus, Location, AttendanceRecord } from './types';
import { firebaseDatabase } from './services/firebaseDatabase';
import { googleMapsService } from './services/googleMapsService';
import { getSmartETA, getRouteAssistant, getTrafficAnalysis } from './services/geminiService';
import MapComponent from './components/MapComponent';
import AttendanceModule from './components/AttendanceModule';
import ChatModule from './components/ChatModule';

const App: React.FC = () => {
  const [role, setRole] = useState<UserRole | null>(null);
  const [buses, setBuses] = useState<Bus[]>([]);
  const [selectedBus, setSelectedBus] = useState<Bus | null>(null);
  const [isAttendanceOpen, setIsAttendanceOpen] = useState(false);
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [isTracking, setIsTracking] = useState(false);
  const [currentLocation, setCurrentLocation] = useState<Location | null>(null);
  const [studentLocation, setStudentLocation] = useState<Location | null>(null);
  const samplesRef = useRef<{ student: Location[]; driver: Location[] }>({ student: [], driver: [] });
  const [eta, setEta] = useState<number | null>(null);
  const [aiMessage, setAiMessage] = useState<string>("");
  const [isLoading, setIsLoading] = useState(false);

  // Driver login state
  const [showDriverLogin, setShowDriverLogin] = useState(false);
  const [driverId, setDriverId] = useState('');
  const [password, setPassword] = useState('');
  const [loginError, setLoginError] = useState('');

  // Alternative route state
  const [alternativeRoute, setAlternativeRoute] = useState<{ id: number, timeSaved: number } | null>(null);

  useEffect(() => {
    // Initial fetch
    firebaseDatabase.getBuses().then(setBuses);

    // Real-time listener — replaces polling
    const unsubscribe = firebaseDatabase.onBusesUpdate((updatedBuses) => {
      setBuses(updatedBuses);
    });

    return () => unsubscribe();
  }, []);

  // Keep selectedBus in sync with buses state (updated via Firebase listener)
  useEffect(() => {
    if (selectedBus) {
      const updatedBus = buses.find(b => b.id === selectedBus.id);
      if (updatedBus) {
        setSelectedBus(updatedBus);

        // For students: recalculate ETA with fresh data
        if (role === 'STUDENT' && updatedBus.status === 'ACTIVE' && updatedBus.lastLocation && studentLocation) {
          const distance = googleMapsService.calculateDistance(studentLocation, updatedBus.lastLocation);
          const eta = googleMapsService.estimateETA(distance);
          setEta(eta);
        }
      }
    }
  }, [buses, selectedBus?.id, role, studentLocation]);

  useEffect(() => {
    if (role === 'STUDENT') {
      console.log('🎓 Student mode - Starting real-time location tracking');

      // Get initial location immediately
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const initialLoc: Location = {
            lat: pos.coords.latitude,
            lng: pos.coords.longitude,
            timestamp: pos.timestamp || Date.now(),
            accuracy: pos.coords.accuracy || 50,
          };
          console.log('📍 Initial location acquired:', initialLoc);
          setStudentLocation(initialLoc);
        },
        (err) => console.error('❌ Initial location failed:', err)
      );

      // Then start continuous watching
      const watchId = googleMapsService.watchUserLocation(
        (location) => {
          console.log('🔄 Student location updated:', location);

          // Smooth location with weighted average
          const buf = samplesRef.current.student;
          buf.push(location);
          if (buf.length > 6) buf.shift();
          const averaged = averageLocations(buf);
          console.log('📊 Smoothed location:', averaged);
          setStudentLocation(averaged);
        },
        (error) => {
          console.error("❌ Location watch error:", error);
        }
      );

      return () => {
        console.log('🛑 Stopping location watch for student');
        navigator.geolocation.clearWatch(watchId);
      };
    }
  }, [role]);

  // Listen for manual override (map click calibration)
  useEffect(() => {
    const handler = (e: any) => {
      const detail = e?.detail;
      if (!detail) return;
      const corrected: Location = {
        lat: Number(detail.lat),
        lng: Number(detail.lng),
        timestamp: Date.now(),
        accuracy: 5,
      };
      console.log('Manual location override received:', corrected);
      if (role === 'STUDENT') {
        setStudentLocation(corrected);
      }
      if (role === 'DRIVER' && selectedBus) {
        setCurrentLocation(corrected);
        firebaseDatabase.updateBusLocation(selectedBus.id, corrected);
      }
    };

    window.addEventListener('override-location', handler as EventListener);
    return () => window.removeEventListener('override-location', handler as EventListener);
  }, [role, selectedBus]);

  // Driver location watch and traffic checking
  useEffect(() => {
    let watchId: number;
    let trafficInterval: number;

    if (isTracking && role === 'DRIVER' && selectedBus) {
      console.log('🚌 Driver mode - Starting GPS broadcast for bus', selectedBus.busNumber);

      watchId = navigator.geolocation.watchPosition(
        (pos) => {
          const loc: Location = {
            lat: pos.coords.latitude,
            lng: pos.coords.longitude,
            timestamp: pos.timestamp || Date.now(),
            speed: pos.coords.speed || undefined,
            accuracy: pos.coords.accuracy ?? null,
          };

          // Smoothing filter
          const buf = samplesRef.current.driver;
          buf.push(loc);
          if (buf.length > 6) buf.shift();
          const averaged = averageLocations(buf);

          console.log('📍 Driver GPS:', {
            bus: selectedBus.busNumber,
            lat: averaged.lat.toFixed(6),
            lng: averaged.lng.toFixed(6),
            accuracy: loc.accuracy,
            speed: loc.speed,
          });

          setCurrentLocation(averaged);
          firebaseDatabase.updateBusLocation(selectedBus.id, averaged);
        },
        (err) => {
          console.error('🚌 Driver location error:', err);
        },
        { enableHighAccuracy: true, maximumAge: 0, timeout: 8000 }
      );

      // Periodically check traffic
      trafficInterval = window.setInterval(async () => {
        if (currentLocation) {
          const analysis = await getTrafficAnalysis(currentLocation);
          if (analysis.fasterRouteAvailable) {
            setAlternativeRoute({ id: analysis.routeId, timeSaved: analysis.timeSaved });
          } else {
            setAlternativeRoute(null);
          }
        }
      }, 30000);
    }

    return () => {
      if (watchId) navigator.geolocation.clearWatch(watchId);
      if (trafficInterval) clearInterval(trafficInterval);
    };
  }, [isTracking, role, selectedBus, currentLocation]);

  const handleAttendanceSuccess = (photoUrl: string, loc: Location) => {
    if (!selectedBus) {
      console.error('❌ Check-in failed: No bus selected');
      return;
    }

    console.log('✅ Check-in successful!');
    console.log('📸 Photo captured:', photoUrl.substring(0, 50) + '...');
    console.log('📍 Location:', loc);
    console.log('🚌 Bus:', selectedBus.busNumber);

    const record: AttendanceRecord = {
      id: Math.random().toString(36).substr(2, 9),
      driverId: 'driver-123',
      busId: selectedBus.id,
      timestamp: new Date().toISOString(),
      location: loc,
      photoUrl
    };

    firebaseDatabase.saveAttendance(record);
    console.log('📝 Attendance record saved');

    setIsAttendanceOpen(false);
    console.log('🚀 Starting location tracking...');

    setIsTracking(true);
    setCurrentLocation(loc);
    firebaseDatabase.updateBusLocation(selectedBus.id, loc);

    console.log('✨ Driver is now LIVE and broadcasting location');

    // Send check-in to server (MSSQL API) - use network IP so it works from any device
    try {
      const apiUrl = process.env.REACT_APP_API_URL || 'http://192.168.1.100:4000/api/checkin';
      fetch(apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          driverName: selectedBus.driverName || 'Sivabalan',
          busNumber: selectedBus.busNumber || '21',
          registration: (selectedBus as any).registration || 'TN55',
          location: loc,
          timestamp: new Date().toISOString(),
        }),
      }).then((r) => {
        if (!r.ok) console.error('Server check-in failed', r.statusText);
        else console.log('✅ Check-in stored in MSSQL');
      }).catch((err) => console.error('Check-in POST error', err));
    } catch (err) {
      console.error('Check-in error:', err);
    }
  };

  const handleStartBroadcasting = () => {
    if (!selectedBus) {
      console.error('❌ No bus selected');
      return;
    }

    console.log('🚀 Starting broadcast directly for bus:', selectedBus.busNumber);

    // Get current location
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const loc: Location = {
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          timestamp: pos.timestamp || Date.now(),
          accuracy: pos.coords.accuracy || 50,
        };

        console.log('📍 Driver location:', loc);

        // Save quick attendance record (without photo)
        const record: AttendanceRecord = {
          id: Math.random().toString(36).substr(2, 9),
          driverId: 'driver-123',
          busId: selectedBus.id,
          timestamp: new Date().toISOString(),
          location: loc,
          photoUrl: '' // No photo
        };

        firebaseDatabase.saveAttendance(record);
        console.log('📝 Attendance record saved (no photo)');

        // Start tracking
        setIsTracking(true);
        setCurrentLocation(loc);
        firebaseDatabase.updateBusLocation(selectedBus.id, loc);

        console.log('✨ Driver is now LIVE - Broadcasting location');

        // Send check-in to server
        try {
          const apiUrl = process.env.REACT_APP_API_URL || 'http://192.168.1.100:4000/api/checkin';
          fetch(apiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              driverName: selectedBus.driverName || 'Sivabalan',
              busNumber: selectedBus.busNumber || '21',
              registration: (selectedBus as any).registration || 'TN55',
              location: loc,
              timestamp: new Date().toISOString(),
            }),
          }).then((r) => {
            if (!r.ok) console.error('Server check-in failed', r.statusText);
            else console.log('✅ Check-in stored in MSSQL');
          }).catch((err) => console.error('Check-in POST error', err));
        } catch (err) {
          console.error('Check-in error:', err);
        }
      },
      (err) => {
        console.error('❌ Failed to get location:', err);
        alert('Unable to get your location. Please enable GPS and try again.');
      },
      { enableHighAccuracy: true, maximumAge: 0, timeout: 8000 }
    );
  };


  const handleStudentSelectBus = async (bus: Bus) => {
    setSelectedBus(bus);
    setIsChatOpen(false);
    setIsLoading(true);
    if (bus.status === 'MAINTENANCE') {
      setEta(null);
      setAiMessage(`Vehicle ${bus.busNumber} is currently in maintenance. Please check for a replacement bus or contact administration.`);
    } else if (bus.lastLocation && bus.status === 'ACTIVE') {
      try {
        // Calculate distance between student and bus
        const distance = googleMapsService.calculateDistance(studentLocation || { lat: 0, lng: 0, timestamp: 0 }, bus.lastLocation);

        // Get smart ETA from AI
        const newEta = await getSmartETA(bus.lastLocation, bus.route);
        setEta(newEta);

        // Get AI routing assistant message
        const msg = await getRouteAssistant(bus.busNumber, bus.status);

        // If we have student location, add distance info
        const distanceText = studentLocation ? ` (${googleMapsService.formatDistance(distance)} away)` : '';
        setAiMessage(msg + distanceText);
      } catch (error) {
        console.error("Error getting ETA:", error);
        setEta(null);
        setAiMessage("Live tracking activated. Bus location and ETA will update in real-time.");
      }
    } else {
      setEta(null);
      setAiMessage("This bus is currently offline. Contact dispatch for updates.");
    }
    setIsLoading(false);
  };

  const handleAcceptReroute = () => {
    setAlternativeRoute(null);
    setAiMessage("Route updated! Navigating through the faster alternative.");
  };

  const handleDriverLogin = async () => {
    if (!driverId.trim() || !password.trim()) {
      setLoginError('Please enter both Driver ID and Password');
      return;
    }

    const isValid = await firebaseDatabase.validateDriverLogin(driverId, password);
    if (isValid) {
      setLoginError('');
      setRole('DRIVER');
      setShowDriverLogin(false);
      setDriverId('');
      setPassword('');
    } else {
      setLoginError('Invalid Driver ID or Password');
    }
  };

  const getStatusBadge = (status: Bus['status']) => {
    switch (status) {
      case 'ACTIVE':
        return <span className="text-[9px] font-black px-2 py-0.5 bg-green-100 text-green-700 rounded-full border border-green-200">LIVE</span>;
      case 'MAINTENANCE':
        return <span className="text-[9px] font-black px-2 py-0.5 bg-amber-100 text-amber-700 rounded-full border border-amber-200">SERVICE</span>;
      default:
        return <span className="text-[9px] font-black px-2 py-0.5 bg-slate-100 text-slate-500 rounded-full border border-slate-200">OFFLINE</span>;
    }
  };

  // Utility: compute weighted average of last samples (weights inverse to accuracy)
  const averageLocations = (samples: Location[]): Location => {
    if (!samples || samples.length === 0) return { lat: 0, lng: 0, timestamp: Date.now(), speed: null };
    // If any sample lacks accuracy, perform simple average
    const allHaveAccuracy = samples.every(s => s.accuracy != null && !isNaN(Number(s.accuracy)));
    let lat = 0;
    let lng = 0;
    let timestamp = samples[samples.length - 1].timestamp || Date.now();
    let speed = samples[samples.length - 1].speed ?? null;

    if (allHaveAccuracy) {
      let weightSum = 0;
      for (const s of samples) {
        const acc = Number(s.accuracy ?? 1000);
        const w = 1 / (acc + 1); // better accuracy => larger weight
        lat += s.lat * w;
        lng += s.lng * w;
        weightSum += w;
      }
      lat /= weightSum;
      lng /= weightSum;
    } else {
      // fallback: arithmetic mean
      for (const s of samples) {
        lat += s.lat;
        lng += s.lng;
      }
      lat /= samples.length;
      lng /= samples.length;
    }

    return { lat, lng, timestamp, speed };
  };

  if (!role) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-blue-50 flex items-center justify-center p-6">
        <div className="max-w-md w-full space-y-8">
          {!showDriverLogin ? (
            <>
              <div className="text-center">
                {/* College Logo */}
                <div className="mb-8 flex justify-center">
                  <div className="h-40 w-40 bg-gradient-to-br from-blue-600 to-indigo-700 rounded-full flex items-center justify-center shadow-xl drop-shadow-lg">
                    <div className="text-center">
                      <div className="text-white text-lg font-black mb-1">Mount Zion</div>
                      <div className="text-white text-xs font-bold">College of Engineering</div>
                    </div>
                  </div>
                </div>
                <h1 className="text-4xl font-black text-slate-900 tracking-tighter">CampusWay</h1>
                <p className="mt-2 text-slate-500 font-medium">Real-time college transit ecosystem</p>
                <p className="mt-1 text-xs font-semibold text-indigo-600">Mount Zion College of Engineering and Technology</p>
              </div>

              <div className="grid grid-cols-1 gap-4">
                <button onClick={() => setShowDriverLogin(true)} className="group flex items-center p-6 bg-white rounded-[2rem] border-2 border-transparent hover:border-indigo-600 shadow-xl transition-all text-left">
                  <div className="w-14 h-14 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center group-hover:bg-indigo-600 group-hover:text-white transition-all">
                    <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" /></svg>
                  </div>
                  <div className="ml-4">
                    <p className="text-xl font-black text-slate-900">Driver Portal</p>
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Shift Management</p>
                  </div>
                </button>

                <button onClick={() => setRole('STUDENT')} className="group flex items-center p-6 bg-white rounded-[2rem] border-2 border-transparent hover:border-indigo-600 shadow-xl transition-all text-left">
                  <div className="w-14 h-14 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center group-hover:bg-blue-600 group-hover:text-white transition-all">
                    <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" /></svg>
                  </div>
                  <div className="ml-4">
                    <p className="text-xl font-black text-slate-900">Student Portal</p>
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Live Bus Tracking</p>
                  </div>
                </button>
              </div>
            </>
          ) : (
            <>
              <div className="text-center">
                <div className="mb-8 flex justify-center">
                  <div className="h-40 w-40 bg-gradient-to-br from-blue-600 to-indigo-700 rounded-full flex items-center justify-center shadow-xl drop-shadow-lg">
                    <div className="text-center">
                      <div className="text-white text-lg font-black mb-1">Mount Zion</div>
                      <div className="text-white text-xs font-bold">College of Engineering</div>
                    </div>
                  </div>
                </div>
                <h1 className="text-4xl font-black text-slate-900 tracking-tighter">Driver Login</h1>
                <p className="mt-2 text-slate-500 font-medium">Secure access to the dispatch system</p>
              </div>

              <div className="bg-white p-8 rounded-[2rem] shadow-xl border border-slate-100 space-y-6">
                <div>
                  <label className="block text-[11px] font-black text-slate-400 uppercase tracking-widest mb-3">Driver ID</label>
                  <input
                    type="text"
                    value={driverId}
                    onChange={(e) => {
                      setDriverId(e.target.value);
                      setLoginError('');
                    }}
                    placeholder="Enter your Driver ID"
                    className="w-full px-4 py-3 border-2 border-slate-100 rounded-xl focus:border-indigo-600 focus:outline-none transition-all text-slate-900 font-medium"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-black text-slate-400 uppercase tracking-widest mb-3">Password</label>
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => {
                      setPassword(e.target.value);
                      setLoginError('');
                    }}
                    placeholder="Enter your password"
                    onKeyPress={(e) => {
                      if (e.key === 'Enter') handleDriverLogin();
                    }}
                    className="w-full px-4 py-3 border-2 border-slate-100 rounded-xl focus:border-indigo-600 focus:outline-none transition-all text-slate-900 font-medium"
                  />
                </div>

                {loginError && (
                  <div className="bg-red-50 border-2 border-red-200 rounded-xl p-4">
                    <p className="text-sm font-bold text-red-700">❌ {loginError}</p>
                  </div>
                )}

                <button
                  onClick={handleDriverLogin}
                  className="w-full py-4 bg-indigo-600 text-white rounded-2xl font-black text-sm shadow-lg hover:bg-indigo-700 active:scale-95 transition-all uppercase tracking-wider"
                >
                  Sign In
                </button>

                <button
                  onClick={() => {
                    setShowDriverLogin(false);
                    setDriverId('');
                    setPassword('');
                    setLoginError('');
                  }}
                  className="w-full py-3 bg-slate-100 text-slate-600 rounded-xl font-bold text-sm hover:bg-slate-200 transition-all"
                >
                  Back
                </button>

                <div className="bg-blue-50 border border-blue-200 rounded-xl p-3">
                  <p className="text-[11px] text-blue-700 font-medium">
                    <span className="font-black">Demo Credentials:</span><br />
                    Driver ID: 41<br />
                    Password: 123
                  </p>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="w-full bg-slate-50 overflow-y-auto">
      <nav className="bg-white/80 backdrop-blur-md px-4 md:px-8 py-5 border-b border-slate-100 sticky top-0 z-40">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3 cursor-pointer group" onClick={() => setRole(null)}>
            <div className="h-10 w-10 bg-indigo-600 rounded-lg flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform font-black text-white text-xs">
              MZ
            </div>
            <span className="font-black text-lg md:text-2xl tracking-tighter text-indigo-600">CampusWay</span>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 px-3 md:px-4 py-2 bg-slate-100 rounded-2xl">
              <div className="w-2 h-2 bg-indigo-500 rounded-full animate-pulse"></div>
              <span className="text-[8px] md:text-[10px] font-black text-slate-600 uppercase tracking-widest">{role} ACTIVE</span>
            </div>
            <div className="flex items-center gap-1 px-2 md:px-3 py-2 bg-green-50 rounded-xl border border-green-200">
              <svg className="w-4 h-4 text-green-600 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              <span className="text-[8px] md:text-[9px] font-bold text-green-700 uppercase tracking-tighter">3s</span>
            </div>
          </div>
        </div>
      </nav>

      <main className="max-w-6xl mx-auto p-4 md:p-8 space-y-8">
        {role === 'DRIVER' ? (
          <div className="space-y-8">
            {!isTracking ? (
              <div className="bg-white rounded-[3rem] p-12 text-center shadow-2xl border border-slate-100">
                <h2 className="text-3xl font-black mb-2">Dispatch System</h2>
                <p className="text-slate-500 mb-8">Select your assigned bus and start broadcasting your location</p>

                <div className="mb-10 max-w-sm mx-auto text-left">
                  <label className="block text-[11px] font-black text-slate-400 uppercase tracking-widest mb-3 px-2">
                    📍 Select Assigned Vehicle
                  </label>
                  <div className="space-y-2">
                    {buses.length === 0 ? (
                      <div className="p-4 bg-slate-50 rounded-2xl text-center text-slate-500 text-sm">
                        No buses available
                      </div>
                    ) : (
                      buses.map(b => (
                        <button
                          key={b.id}
                          onClick={() => {
                            setSelectedBus(b);
                            console.log('🚌 Bus selected:', b.busNumber, '- Status:', b.status);
                          }}
                          className={`w-full p-4 rounded-2xl border-2 transition-all flex items-center justify-between ${selectedBus?.id === b.id ? 'border-indigo-600 bg-indigo-50 shadow-md' : 'border-slate-100 bg-slate-50 hover:border-slate-200'}`}
                        >
                          <div className="flex items-center gap-3">
                            <span className="font-bold text-slate-900">{b.busNumber}</span>
                            <span className="text-xs text-slate-500">— {b.route}</span>
                          </div>
                          {getStatusBadge(b.status)}
                        </button>
                      ))
                    )}
                  </div>
                </div>

                <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4 mb-8 text-left">
                  <p className="text-xs text-blue-700 font-medium">
                    <span className="font-black">ℹ️ Next Step:</span> Select a bus, then click "START BROADCASTING" to begin your shift.
                    You'll be asked to check in with camera and location.
                  </p>
                </div>

                <button
                  disabled={!selectedBus || selectedBus.status === 'MAINTENANCE'}
                  onClick={() => {
                    if (selectedBus) {
                      console.log('� Starting broadcast for:', selectedBus.busNumber);
                      handleStartBroadcasting();
                    }
                  }}
                  className={`px-12 py-5 rounded-[2rem] font-black text-lg shadow-2xl transition-all ${selectedBus && selectedBus.status !== 'MAINTENANCE'
                      ? 'bg-indigo-600 text-white shadow-indigo-100 hover:bg-indigo-700 active:scale-95 cursor-pointer'
                      : 'bg-slate-100 text-slate-400 cursor-not-allowed opacity-50'
                    }`}
                >
                  {!selectedBus ? (
                    '→ Select a Bus First'
                  ) : selectedBus.status === 'MAINTENANCE' ? (
                    '🔧 VEHICLE IN SHOP'
                  ) : (
                    '🚀 START BROADCASTING'
                  )}
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 md:gap-8">
                <div className="lg:col-span-3 min-h-0">
                  <MapComponent
                    busLocation={currentLocation || undefined}
                    isDriver
                    alternativeRoute={alternativeRoute}
                    onAcceptRoute={handleAcceptReroute}
                  />
                </div>
                <div className="space-y-4 md:space-y-8">
                  <div className="bg-white p-8 rounded-[2.5rem] shadow-xl border border-slate-100">
                    <h3 className="font-black text-slate-900 mb-6 uppercase text-xs tracking-widest">Vehicle Metrics</h3>
                    <div className="space-y-6">
                      <div className="flex justify-between items-center">
                        <span className="text-xs font-bold text-slate-400">SIGNAL</span>
                        <span className="text-[10px] font-black px-3 py-1 bg-green-100 text-green-700 rounded-full">ENCRYPTED</span>
                      </div>
                      <div className="flex justify-between items-center border-t border-slate-50 pt-4">
                        <span className="text-xs font-bold text-slate-400">VEHICLE</span>
                        <span className="text-sm font-black text-slate-900">{selectedBus?.busNumber}</span>
                      </div>
                      <div className="flex justify-between items-center border-t border-slate-50 pt-4">
                        <span className="text-xs font-bold text-slate-400">VELOCITY</span>
                        <span className="text-sm font-black text-slate-900">{currentLocation?.speed ? `${Math.round(currentLocation.speed * 3.6)} km/h` : '0 km/h'}</span>
                      </div>
                    </div>
                  </div>
                  <button
                    onClick={() => {
                      setIsTracking(false);
                      setCurrentLocation(null);
                      if (selectedBus) firebaseDatabase.updateBusLocation(selectedBus.id, { lat: 0, lng: 0, timestamp: Date.now() });
                    }}
                    className="w-full py-6 bg-red-50 text-red-600 rounded-[2rem] font-black border-2 border-red-100 hover:bg-red-100 transition-colors shadow-lg"
                  >
                    DISCONNECT
                  </button>
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-8">
            <div className="bg-white p-8 rounded-[2.5rem] shadow-2xl border border-slate-100">
              <h2 className="text-2xl font-black mb-6 tracking-tighter">Campus Fleet</h2>
              <div className="flex gap-4 overflow-x-auto pb-4 scrollbar-hide">
                {buses.map(bus => (
                  <button
                    key={bus.id}
                    onClick={() => handleStudentSelectBus(bus)}
                    className={`flex-shrink-0 px-8 py-4 rounded-[2rem] font-black transition-all border-2 flex flex-col items-center gap-2 ${selectedBus?.id === bus.id ? 'bg-indigo-600 text-white border-indigo-600 shadow-xl scale-105' : 'bg-white text-slate-500 hover:bg-slate-50 border-slate-100 shadow-sm'}`}
                  >
                    <span className="text-lg">{bus.busNumber}</span>
                    {getStatusBadge(bus.status)}
                  </button>
                ))}
              </div>
            </div>

            {selectedBus && (
              <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 md:gap-8 relative min-h-0">
                <div className="lg:col-span-3 min-h-0">
                  <MapComponent busLocation={selectedBus.lastLocation} userLocation={studentLocation} />
                </div>
                <div className="space-y-4 md:space-y-8">
                  {isLoading ? (
                    <div className="bg-white p-8 rounded-[2.5rem] animate-pulse space-y-4">
                      <div className="h-8 bg-slate-100 rounded w-1/2"></div>
                      <div className="h-32 bg-slate-100 rounded w-full"></div>
                    </div>
                  ) : (
                    <>
                      <div className={`p-8 rounded-[2.5rem] shadow-xl text-white transition-colors duration-500 ${selectedBus.status === 'ACTIVE' ? 'bg-indigo-600 shadow-indigo-200' : 'bg-slate-800 shadow-slate-200'}`}>
                        <p className="text-white/60 text-[10px] font-black uppercase tracking-[0.2em] mb-3">
                          {selectedBus.status === 'ACTIVE' ? 'Est. Arrival' : 'Current Status'}
                        </p>
                        <h4 className="text-5xl font-black mb-2 tracking-tighter">
                          {selectedBus.status === 'ACTIVE' ? (eta !== null ? `${eta}m` : 'Live') : selectedBus.status}
                        </h4>
                        <p className="text-xs font-bold opacity-70 leading-tight">{selectedBus.route}</p>
                      </div>

                      <div className="bg-white p-8 rounded-[2.5rem] shadow-xl border border-slate-100">
                        <div className="flex items-center gap-3 mb-4">
                          <div className="w-8 h-8 bg-indigo-100 rounded-xl flex items-center justify-center">
                            <svg className="w-5 h-5 text-indigo-600" fill="currentColor" viewBox="0 0 20 20"><path d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-11a1 1 0 10-2 0v2H7a1 1 0 100 2h2v2a1 1 0 102 0v-2h2a1 1 0 100-2h-2V7z"></path></svg>
                          </div>
                          <h4 className="font-black text-slate-900 text-xs uppercase tracking-widest">Smart Assistant</h4>
                        </div>
                        <p className="text-sm text-slate-500 font-medium italic leading-relaxed">
                          "{aiMessage}"
                        </p>
                        <button onClick={() => setIsChatOpen(true)} className="mt-6 w-full py-4 bg-slate-900 text-white rounded-2xl font-black text-[10px] tracking-widest uppercase hover:bg-slate-800 transition-all flex items-center justify-center gap-2">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" /></svg>
                          Open Support
                        </button>
                      </div>
                    </>
                  )}
                </div>
                {isChatOpen && <ChatModule bus={selectedBus} onClose={() => setIsChatOpen(false)} />}
              </div>
            )}
          </div>
        )}
      </main>

      {isAttendanceOpen && (
        <AttendanceModule
          onSuccess={handleAttendanceSuccess}
          onCancel={() => setIsAttendanceOpen(false)}
        />
      )}
    </div>
  );
};

export default App;
