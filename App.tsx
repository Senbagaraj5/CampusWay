
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { UserRole, Bus, Location, AttendanceRecord } from './types';
import { firebaseDatabase } from './services/firebaseDatabase';
import { Capacitor } from '@capacitor/core';
import { googleMapsService } from './services/googleMapsService';
import { getSmartETA, getRouteAssistant, getTrafficAnalysis } from './services/geminiService';
import MapComponent from './components/MapComponent';
import AttendanceModule from './components/AttendanceModule';
import ChatModule from './components/ChatModule';
import StudentTrackingPage from './components/StudentTrackingPage';
import StudentBusList from './components/StudentBusList';
import { DriverProfile } from './types';
import collegeLogo from './college_logo.png';

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
  const [currentDriver, setCurrentDriver] = useState<DriverProfile | null>(null);
  const [showPasswordChange, setShowPasswordChange] = useState(false);
  const [newPassword, setNewPassword] = useState('');

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

  // Back button and exit logic
  const backPressTime = useRef<number>(0);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  useEffect(() => {
    let backListener: any;
    if (Capacitor.isNativePlatform()) {
      import('@capacitor/app').then(({ App: CapApp }) => {
        backListener = CapApp.addListener('backButton', () => {
          // 1. If map is open, let StudentTrackingPage handle it
          if (selectedBus) return;

          // 2. Clear other states if open
          if (role) {
            setRole(null);
            return;
          }

          // 3. Home Screen -> Exit safety
          const now = Date.now();
          if (now - backPressTime.current < 2000) {
            CapApp.exitApp();
          } else {
            backPressTime.current = now;
            setToastMessage('Press back again to exit');
            setTimeout(() => setToastMessage(null), 2000);
          }
        });
      });
    }
    return () => {
      if (backListener) backListener.then((l: any) => l.remove());
    };
  }, [role, selectedBus]);

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

    const result = await firebaseDatabase.validateDriverLogin(driverId, password);
    if (result.success && result.driver) {
      setLoginError('');
      const driver = result.driver;
      setCurrentDriver(driver);

      if (driver.mustChangePassword) {
        setShowPasswordChange(true);
      } else {
        localStorage.setItem("driverUid", driver.uid);
        localStorage.setItem("driverBusId", driver.busId);
        setRole('DRIVER');
        setShowDriverLogin(false);
        // Auto-select the bus assigned to this driver
        const bus = buses.find(b => b.id === driver.busId);
        if (bus) setSelectedBus(bus);
      }

      setDriverId('');
      setPassword('');
    } else {
      setLoginError('Invalid Driver ID or Password');
    }
  };

  const handlePasswordUpdate = async () => {
    if (newPassword.length < 6) {
      setLoginError('Password must be at least 6 characters');
      return;
    }
    if (currentDriver) {
      localStorage.setItem("driverUid", currentDriver.uid);
      localStorage.setItem("driverBusId", currentDriver.busId);
      setRole('DRIVER');
      setShowPasswordChange(false);
      setShowDriverLogin(false);
      const bus = buses.find(b => b.id === currentDriver.busId);
      if (bus) setSelectedBus(bus);
      setNewPassword('');
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
      <div className="min-h-[100dvh] bg-slate-50 flex items-center justify-center p-4">
        <div className="max-w-[420px] w-full flex flex-col space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
          {!showDriverLogin ? (
            <>
              <div className="text-center">
                <div className="mb-8 flex justify-center">
                  <div className="h-28 w-28 flex items-center justify-center active:scale-95 transition-all">
                    <img src={collegeLogo} alt="College Logo" className="w-full h-full object-contain" />
                  </div>
                </div>
                <h1 className="text-4xl font-black text-slate-900 tracking-tighter mb-1">
                  Campus<span className="text-indigo-500">Way</span>
                </h1>
                <p className="text-[11px] font-bold text-slate-400 uppercase tracking-[0.2em] mb-8">Fleet Tracking System</p>
              </div>

              <div className="space-y-4">
                <button
                  onClick={() => setShowDriverLogin(true)}
                  className="group w-full flex items-center p-5 bg-white rounded-[2rem] border-2 border-slate-100 hover:border-indigo-600 shadow-sm active:scale-[0.98] transition-all text-left"
                >
                  <div className="flex-shrink-0 w-12 h-12 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center group-hover:bg-indigo-600 group-hover:text-white transition-all">
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" /></svg>
                  </div>
                  <div className="ml-4">
                    <p className="text-lg font-black text-slate-900 leading-tight">Driver Portal</p>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-0.5">Shift Management</p>
                  </div>
                </button>

                <button
                  onClick={() => setRole('STUDENT')}
                  className="group w-full flex items-center p-5 bg-white rounded-[2rem] border-2 border-slate-100 hover:border-blue-600 shadow-sm active:scale-[0.98] transition-all text-left"
                >
                  <div className="flex-shrink-0 w-12 h-12 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center group-hover:bg-blue-600 group-hover:text-white transition-all">
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" /></svg>
                  </div>
                  <div className="ml-4">
                    <p className="text-lg font-black text-slate-900 leading-tight">Student Portal</p>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-0.5">Live Bus Tracking</p>
                  </div>
                </button>
              </div>

              <div className="pt-8 text-center text-[10px] font-bold text-slate-300 uppercase tracking-widest">
                Version 2.4.0 • Secured by Firebase
              </div>
            </>

          ) : (
            <div className="space-y-6 w-full animate-in fade-in zoom-in-95 duration-300">
              <div className="text-center">
                <div className="mb-6 flex justify-center">
                  <div
                    className="h-20 w-20 flex items-center justify-center cursor-pointer active:scale-90 transition-all"
                    onClick={() => setShowDriverLogin(false)}
                  >
                    <img src={collegeLogo} alt="Logo" className="w-full h-full object-contain" />
                  </div>
                </div>
                <h2 className="text-2xl font-black text-slate-900 tracking-tighter">Driver Authentication</h2>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">Access Secure Dispatch</p>
              </div>

              <div className="bg-white p-6 rounded-[2.5rem] shadow-xl border border-slate-100 space-y-4">
                <div className="space-y-3">
                  <div>
                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 ml-1">Terminal ID</label>
                    <input
                      type="text"
                      value={driverId}
                      onChange={(e) => {
                        setDriverId(e.target.value);
                        setLoginError('');
                      }}
                      placeholder="e.g. drv_01"
                      className="w-full px-5 py-4 bg-slate-50 border-2 border-transparent focus:border-indigo-600 focus:bg-white rounded-2xl outline-none transition-all text-sm font-bold text-slate-900 placeholder:text-slate-300"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 ml-1">Access Key</label>
                    <input
                      type="password"
                      value={password}
                      onChange={(e) => {
                        setPassword(e.target.value);
                        setLoginError('');
                      }}
                      placeholder="••••••••"
                      onKeyPress={(e) => {
                        if (e.key === 'Enter') handleDriverLogin();
                      }}
                      className="w-full px-5 py-4 bg-slate-50 border-2 border-transparent focus:border-indigo-600 focus:bg-white rounded-2xl outline-none transition-all text-sm font-bold text-slate-900 placeholder:text-slate-300"
                    />
                  </div>
                </div>

                {loginError && (
                  <div className="bg-red-50 border border-red-100 rounded-2xl p-3 animate-in fade-in slide-in-from-top-2">
                    <p className="text-[10px] font-black text-red-600 flex items-center gap-2 uppercase tracking-wide">
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                      {loginError}
                    </p>
                  </div>
                )}

                <div className="pt-2 space-y-2">
                  <button
                    onClick={handleDriverLogin}
                    className="w-full py-5 bg-indigo-600 text-white rounded-[1.5rem] font-black text-xs shadow-lg shadow-indigo-200 hover:bg-indigo-700 active:scale-95 transition-all uppercase tracking-[0.2em] flex items-center justify-center gap-3"
                  >
                    <span>Authenticate</span>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M14 5l7 7m0 0l-7 7m7-7H3" /></svg>
                  </button>

                  <button
                    onClick={() => {
                      setShowDriverLogin(false);
                      setDriverId('');
                      setPassword('');
                      setLoginError('');
                    }}
                    className="w-full py-4 text-slate-400 font-black text-[10px] uppercase tracking-widest hover:text-slate-600 transition-colors"
                  >
                    Cancel & Return
                  </button>
                </div>
              </div>


            </div>
          )}

          {/* Forced Password Change Modal */}
          {showPasswordChange && (
            <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[60] flex items-center justify-center p-6 animate-in fade-in duration-300">
              <div className="bg-white max-w-sm w-full p-8 rounded-[2.5rem] shadow-2xl space-y-6">
                <div className="text-center">
                  <div className="w-16 h-16 bg-amber-50 text-amber-500 rounded-2xl flex items-center justify-center mx-auto mb-4">
                    <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
                  </div>
                  <h2 className="text-2xl font-black text-slate-900 tracking-tighter">Security Update</h2>
                  <p className="text-slate-500 text-sm font-medium">Please set a new password for your account</p>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="block text-[11px] font-black text-slate-400 uppercase tracking-widest mb-3">New Password</label>
                    <input
                      type="password"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="Minimum 6 characters"
                      className="w-full px-4 py-3 border-2 border-slate-100 rounded-xl focus:border-indigo-600 focus:outline-none transition-all"
                    />
                  </div>

                  {loginError && <p className="text-xs font-bold text-red-500">{loginError}</p>}

                  <button
                    onClick={handlePasswordUpdate}
                    className="w-full py-4 bg-indigo-600 text-white rounded-2xl font-black text-sm shadow-lg hover:bg-indigo-700 active:scale-95 transition-all uppercase tracking-wider"
                  >
                    Update & Continue
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="w-full h-[100dvh] flex flex-col bg-slate-50 overflow-hidden">
      <nav className="flex-shrink-0 bg-white/90 backdrop-blur-xl px-4 pt-[calc(env(safe-area-inset-top)+10px)] pb-4 border-b border-slate-100 z-50">
        <div className="max-w-[420px] lg:max-w-6xl mx-auto flex items-center justify-between">
          <div
            className="flex items-center gap-3 cursor-pointer active:scale-95 transition-all group"
            onClick={() => {
              setRole(null);
              localStorage.removeItem("driverBusId");
              localStorage.removeItem("driverUid");
            }}
          >
            <div className="h-10 flex items-center justify-center transition-transform group-hover:scale-105">
              <img src={collegeLogo} alt="College Logo" className="h-full w-auto object-contain" />
            </div>
            <div className="flex flex-col">
              <span className="font-black text-lg tracking-tighter text-slate-900 leading-none">
                Campus<span className="text-indigo-500">Way</span>
              </span>
              <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest leading-none mt-1">Fleet Tracker</span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="px-2.5 py-1.5 bg-indigo-50 border border-indigo-100 rounded-lg">
              <span className="text-[9px] font-black text-indigo-600 uppercase tracking-widest">{role}</span>
            </div>
            <button
              onClick={() => setRole(null)}
              className="p-2 text-slate-400 hover:text-slate-600 active:scale-90 transition-all"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>
            </button>
          </div>
        </div>
      </nav>

      <main className="flex-grow overflow-y-auto p-4">
        {role === 'DRIVER' ? (
          <div className="max-w-[420px] mx-auto w-full space-y-6 lg:max-w-6xl animate-in fade-in duration-500">
            {!isTracking ? (
              <div className="bg-white rounded-[2.5rem] p-6 text-center shadow-2xl border border-slate-100">
                <div className="flex flex-col items-center mb-6">
                  <div className="w-16 h-16 bg-indigo-50 text-indigo-600 rounded-full flex items-center justify-center mb-3 text-2xl animate-bounce duration-[2000ms]">🚌</div>
                  <h2 className="text-2xl font-black text-slate-900 tracking-tighter leading-none">Dispatch Hub</h2>
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">Vehicle Assignment</p>
                </div>

                <div className="mb-8 text-left">
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 ml-2">Active Unit</label>
                  <div className="space-y-3">
                    {(() => {
                      const driverBusId = localStorage.getItem("driverBusId");
                      const assignedBuses = buses.filter(b => b.id === driverBusId);

                      if (assignedBuses.length === 0) {
                        return (
                          <div className="p-8 bg-slate-50 rounded-[2rem] text-center border-2 border-dashed border-slate-200">
                            <p className="text-slate-500 font-bold mb-1">No Unit Assigned</p>
                            <p className="text-[9px] text-slate-400 uppercase tracking-widest">Contact Dispatch Control</p>
                          </div>
                        );
                      }

                      return assignedBuses.map(b => (
                        <button
                          key={b.id}
                          onClick={() => {
                            setSelectedBus(b);
                            console.log('🚌 Bus selected:', b.busNumber);
                          }}
                          className={`w-full p-5 rounded-[1.8rem] border-2 transition-all flex items-center justify-between ${selectedBus?.id === b.id ? 'border-indigo-600 bg-indigo-50 shadow-md ring-4 ring-indigo-500/10' : 'border-slate-50 bg-slate-50'}`}
                        >
                          <div className="flex items-center gap-4">
                            <div className={`w-12 h-12 rounded-2xl flex items-center justify-center text-xl font-bold ${selectedBus?.id === b.id ? 'bg-indigo-600 text-white' : 'bg-white text-slate-400'}`}>
                              {b.busNumber}
                            </div>
                            <div className="flex flex-col">
                              <span className="font-black text-slate-900 text-base tracking-tight leading-none mb-1">Bus {b.busNumber}</span>
                              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wide truncate max-w-[150px]">{b.route}</span>
                            </div>
                          </div>
                          {getStatusBadge(b.status)}
                        </button>
                      ))
                    })()}
                  </div>
                </div>

                <button
                  disabled={!selectedBus || selectedBus.status === 'MAINTENANCE'}
                  onClick={() => {
                    if (selectedBus) {
                      console.log('🚀 Starting broadcast:', selectedBus.busNumber);
                      handleStartBroadcasting();
                    }
                  }}
                  className={`w-full py-5 rounded-[1.8rem] font-black text-base shadow-xl transition-all ${selectedBus && selectedBus.status !== 'MAINTENANCE'
                    ? 'bg-indigo-600 text-white shadow-indigo-200 active:scale-95'
                    : 'bg-slate-100 text-slate-400 cursor-not-allowed'
                    }`}
                >
                  {!selectedBus ? (
                    'SELECT UNIT TO BROADCAST'
                  ) : selectedBus.status === 'MAINTENANCE' ? (
                    '🔧 VEHICLE IN MAINTENANCE'
                  ) : (
                    'START BROADCASTING NOW'
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
            {!selectedBus ? (
              <StudentBusList
                buses={buses}
                onSelectBus={handleStudentSelectBus}
              />
            ) : (
              <StudentTrackingPage
                selectedBus={selectedBus}
                studentLocation={studentLocation}
                onBack={() => setSelectedBus(null)}
                eta={eta}
              />
            )}
          </div>
        )}
      </main >

      {isAttendanceOpen && (
        <AttendanceModule
          onSuccess={handleAttendanceSuccess}
          onCancel={() => setIsAttendanceOpen(false)}
        />
      )}

      {/* Local Toast Notification */}
      {
        toastMessage && (
          <div className="fixed bottom-10 left-1/2 -translate-x-1/2 bg-slate-900/90 backdrop-blur-md text-white px-6 py-3 rounded-full text-xs font-black shadow-2xl z-[100] animate-in slide-in-from-bottom duration-300">
            {toastMessage}
          </div>
        )
      }
    </div >
  );
};

export default App;
