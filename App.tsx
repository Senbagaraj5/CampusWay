
import React, { useState, useEffect, useRef } from 'react';
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
import { isBusActive } from './services/locationUtils';


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

  const prevDriverLocRef = useRef<{ loc: Location; ts: number } | null>(null);
  const lastBroadcastRef = useRef<number>(0);
  const watchIdRef = useRef<number | null>(null);

  // LOGIN FIX: track the latest login attempt ID to prevent race conditions
  const loginAttemptRef = useRef<number>(0);

  // Driver login state
  const [showDriverLogin, setShowDriverLogin] = useState(false);
  const [terminalId, setTerminalId] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loginError, setLoginError] = useState('');
  const [currentDriver, setCurrentDriver] = useState<DriverProfile | null>(null);
  const [showPasswordChange, setShowPasswordChange] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [loginTimestamp, setLoginTimestamp] = useState<number | null>(null);

  // Alternative route state
  const [alternativeRoute, setAlternativeRoute] = useState<{ id: number, timeSaved: number } | null>(null);

  useEffect(() => {
    // Initial fetch
    firebaseDatabase.getBuses().then(setBuses);

    // Real-time listener for all buses (Fleet Status)
    const unsubscribe = firebaseDatabase.subscribeFleetsStatus((updatedBuses) => {
      setBuses(updatedBuses);
    });

    return () => unsubscribe();
  }, []);

  // SESSION SECURITY: Listen for single fleet updates if one is selected
  useEffect(() => {
    if (role === 'STUDENT' && selectedBus && isTracking) {
      const unsubscribe = firebaseDatabase.subscribeFleetLocation(selectedBus.id, (updatedBus) => {
        setSelectedBus(updatedBus);
      });
      return () => unsubscribe();
    }
  }, [selectedBus?.id, role, isTracking]);

  // SESSION SECURITY: Memory-only authentication (no auto-restore on refresh)
  useEffect(() => {
    // We intentionally do NOT read from localStorage here.
    // Every refresh returns the driver to the login screen.
    console.log('🛡️ Session security active: Memory-only mode');
  }, []);

  // SESSION SECURITY: 30-minute session expiry check
  useEffect(() => {
    if (!loginTimestamp || role !== 'DRIVER') return;

    const interval = setInterval(() => {
      const now = Date.now();
      const elapsed = now - loginTimestamp;
      const thirtyMinutes = 30 * 60 * 1000;

      if (elapsed > thirtyMinutes) {
        console.warn('🕒 Session expired (30 mins). Logging out...');
        handleLogout();
        setToastMessage('Session expired. Please login again.');
      }
    }, 60000); // Check every minute

    return () => clearInterval(interval);
  }, [loginTimestamp, role]);

  const handleLogout = async () => {
    if (role === 'DRIVER' && selectedBus) {
      // Mark offline in Firebase before clearing state
      await firebaseDatabase.setDriverOnline(selectedBus.id, false);
      setCurrentLocation(null);
      setIsTracking(false);
    }

    setRole(null);
    setCurrentDriver(null);
    setSelectedBus(null);
    setIsTracking(false);
    setCurrentLocation(null);
    setLoginTimestamp(null);
    prevDriverLocRef.current = null;
    setShowDriverLogin(false);
  };

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
        // Only update if something changed (avoid unnecessary state cycles)
        if (JSON.stringify(updatedBus) !== JSON.stringify(selectedBus)) {
          setSelectedBus(updatedBus);
        }

        // For students: recalculate ETA with fresh data
        if (role === 'STUDENT' && studentLocation) {
          if (isBusActive(updatedBus)) {
            const distance = googleMapsService.calculateDistance(studentLocation, updatedBus.lastLocation!, {
              lastUpdateTs: updatedBus.updatedAt,
              driverOnline: updatedBus.isOnline
            });
            if (distance !== null) {
              const eta = googleMapsService.estimateETA(distance);
              setEta(eta);
            }
          } else {
            // FIX 13: Clear ETA and message if bus goes inactive
            setEta(null);
            setAiMessage("This bus is currently offline. Tracking will resume once the driver is back online.");
          }
        }
      }
    }
    // FIX 7: do NOT auto-select any bus on buses list update
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
    let trafficInterval: number;

    if (isTracking && role === 'DRIVER' && selectedBus) {
      // FIX 21: Strictly prevent duplicate watchers
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }

      console.log('🚌 Driver mode - Starting hyper-fast GPS broadcast for bus', selectedBus.busNumber);

      watchIdRef.current = navigator.geolocation.watchPosition(
        (pos) => {
          const loc: Location = {
            lat: pos.coords.latitude,
            lng: pos.coords.longitude,
            timestamp: pos.timestamp || Date.now(),
            // speed set below after Haversine fallback
            speed: undefined,
            accuracy: pos.coords.accuracy ?? null,
          };

          // FIX 6: Use GPS speed if available; else Haversine fallback with noise clamp
          let computedSpeed: number | null = null;
          if (pos.coords.speed != null && pos.coords.speed >= 0) {
            computedSpeed = pos.coords.speed; // already m/s
          } else if (prevDriverLocRef.current) {
            const prev = prevDriverLocRef.current;
            const dist = googleMapsService.calculateDistance(prev.loc, loc);
            const dt = (loc.timestamp - prev.ts) / 1000; // seconds
            if (dt > 0 && dist !== null) {
              const raw = dist / dt; // m/s
              // Clamp: ignore tiny jitter (<0.5 m/s ~1.8 km/h) and impossible spikes (>55 m/s ~200 km/h)
              computedSpeed = raw < 0.5 ? 0 : raw > 55 ? (computedSpeed ?? 0) : raw;
            }
          }
          loc.speed = computedSpeed ?? 0;

          // Smoothing filter
          const buf = samplesRef.current.driver;
          buf.push(loc);
          if (buf.length > 6) buf.shift();
          const averaged = averageLocations(buf);

          // Update prev location reference for next Haversine cycle
          prevDriverLocRef.current = { loc: averaged, ts: averaged.timestamp };

          console.log('📍 Driver GPS:', {
            bus: selectedBus.busNumber,
            lat: averaged.lat.toFixed(6),
            lng: averaged.lng.toFixed(6),
            accuracy: loc.accuracy,
            speed_kmh: averaged.speed != null ? Math.round(averaged.speed * 3.6) : 'n/a',
          });

          setCurrentLocation(averaged);

          // FIX 21: Hyper-fast 600ms broadcast throttle
          const now = Date.now();
          if (now - lastBroadcastRef.current >= 600) {
            firebaseDatabase.updateBusLocation(selectedBus.id, averaged);
            lastBroadcastRef.current = now;
          }
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
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
      if (trafficInterval) clearInterval(trafficInterval);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isTracking, role, selectedBus?.id]);

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

  const handleStartBroadcasting = (targetBus?: Bus) => {
    const bus = targetBus || selectedBus;
    if (!bus) {
      console.error('❌ No bus selected');
      return;
    }

    console.log('🚀 Starting broadcast directly for bus:', bus.busNumber);

    // FIX 17: Immediate UI switch and Firebase status update
    setIsTracking(true);
    firebaseDatabase.setDriverOnline(bus.id, true);
    firebaseDatabase.setupOnDisconnect(bus.id);

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const loc: Location = {
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          timestamp: pos.timestamp || Date.now(),
          accuracy: pos.coords.accuracy || 50,
          speed: pos.coords.speed ?? 0,
        };

        console.log('📍 Initial driver location:', loc);

        const record: AttendanceRecord = {
          id: Math.random().toString(36).substr(2, 9),
          driverId: currentDriver?.uid || 'unknown', // FIX 6: Use actual session UID
          busId: bus.id,
          timestamp: new Date().toISOString(),
          location: loc,
          photoUrl: ''
        };

        firebaseDatabase.saveAttendance(record);

        setCurrentLocation(loc);
        prevDriverLocRef.current = { loc, ts: loc.timestamp };
        firebaseDatabase.updateBusLocation(bus.id, loc);

        console.log('✨ Driver is now LIVE - Initial location saved');

        // Optional API check-in (non-critical; uses env var, not hardcoded IP)
        const apiUrl = import.meta.env.VITE_API_URL;
        if (apiUrl) {
          fetch(`${apiUrl}/api/checkin`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              driverName: bus.driverName,
              busNumber: bus.busNumber,
              location: loc,
              timestamp: new Date().toISOString(),
            }),
          }).catch((err) => console.warn('Check-in POST skipped:', err));
        }
      },
      (err) => {
        console.error('❌ Failed to get initial location:', err);
        // We still keep isTracking(true) so the driver is on the metrics page
        // but they might see "0 km/h" or a stale map until permissions are granted.
        alert('Unable to get your initial location. Please enable GPS.');
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
    } else if (isBusActive(bus)) {
      setIsTracking(true); // Enable tracking view
      try {
        // FIX 12: Use robust distance calculation with debug logs
        const distance = googleMapsService.calculateDistance(studentLocation, bus.lastLocation!, {
          lastUpdateTs: bus.updatedAt,
          driverOnline: bus.isOnline
        });

        let newEta: number | null = null;
        let msg = "";

        if (distance !== null) {
          try {
            // Try Gemini for smart ETA
            newEta = await getSmartETA(bus.lastLocation!, bus.route);
            msg = await getRouteAssistant(bus.busNumber, bus.status);
          } catch (geminiError) {
            console.warn("⚠️ Gemini API Error - Falling back to manual calculation:", geminiError);
            // FIX 12: Manual ETA fallback (35 km/h avg speed)
            newEta = Math.round(distance / 583) || 1;
            msg = "Live tracking activated. ETA calculated via distance fallback.";
          }

          setEta(newEta);
          const distanceText = studentLocation ? ` (${googleMapsService.formatDistance(distance)} away)` : '';
          setAiMessage(msg + distanceText);
        } else {
          // Case where distance is null (invalid coords or > 200km)
          setEta(null);
          setAiMessage("Live tracking activated. Bus location will update in real-time once a valid GPS fix is acquired.");
        }
      } catch (error) {
        console.error("Selection logic error:", error);
        setEta(null);
        setAiMessage("Live tracking activated. Awaiting real-time updates.");
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
    const id = terminalId.trim();
    const pass = password.trim();
    const driverIdTrimmed = id.toLowerCase();

    // FIX 6: Mandatory debug logs as requested
    console.log("🛠️ Login Process Started");
    console.log("🔹 Typed ID:", terminalId);
    console.log("🔹 Using ID:", id);
    console.log("🔹 Stored driverUid:", localStorage.getItem("driverUid"));

    if (!driverIdTrimmed || !pass) {
      setLoginError('Please enter both Terminal ID and Password');
      return;
    }

    if (isLoading) return; // Block concurrent clicks

    // LOGIN FIX: start a new attempt and clear previous errors
    const currentAttemptId = ++loginAttemptRef.current;
    setLoginError('');
    setIsLoading(true);

    try {
      const result = await firebaseDatabase.validateDriverLogin(driverIdTrimmed, password);

      // LOGIN FIX: check if this attempt is still the current one
      if (currentAttemptId !== loginAttemptRef.current) return;

      if (result.ok && result.driver) {
        const driver = result.driver;
        const driverKey = result.driverKey || driver.uid;

        // FIX 11: Store the actual DB key (drv_42) NOT the typed username
        console.log("✅ Authenticated successfully. Storing driverKey:", driverKey);
        setCurrentDriver({ ...driver, uid: driverKey });

        if (driver.mustChangePassword) {
          setShowPasswordChange(true);
        } else {
          // SESSION SECURITY: Purely memory-based state (no localStorage)
          setLoginTimestamp(Date.now());
          setRole('DRIVER');
          setShowDriverLogin(false);
          const bus = buses.find(b => b.id === driver.busId);
          if (bus) {
            setSelectedBus(bus);
            // FIX 17: Auto-start broadcasting immediately to skip dispatch hub
            handleStartBroadcasting(bus);
          }
        }

        setTerminalId('');
        setPassword('');
      } else {
        // FIX 11: Granular error messaging based on result.reason
        switch (result.reason) {
          case 'NOT_FOUND':
            setLoginError('Terminal ID not found. Contact admin.');
            break;
          case 'WRONG_PASSWORD':
            setLoginError('Invalid access key.');
            break;
          case 'NETWORK':
            setLoginError('Network issue. Please try again.');
            break;
          default:
            setLoginError('Authentication failed. Please try again.');
        }
      }
    } catch (error) {
      if (currentAttemptId === loginAttemptRef.current) {
        setLoginError('Network issue. Please try again.');
      }
    } finally {
      if (currentAttemptId === loginAttemptRef.current) {
        setIsLoading(false);
      }
    }
  };

  const handlePasswordUpdate = async () => {
    if (newPassword.length < 6) {
      setLoginError('Password must be at least 6 characters');
      return;
    }
    if (!currentDriver) return;
    try {
      // FIX 1: Actually write the new password to Firebase (was missing before)
      await firebaseDatabase.updateDriverPassword(currentDriver.uid, newPassword);

      // SESSION SECURITY: Transition to logged-in state without localStorage
      setLoginTimestamp(Date.now());
      setRole('DRIVER');
      setShowPasswordChange(false);
      setShowDriverLogin(false);
      const bus = buses.find(b => b.id === currentDriver.busId);
      if (bus) {
        setSelectedBus(bus);
        // FIX 17: Auto-start broadcasting immediately to skip dispatch hub
        handleStartBroadcasting(bus);
      }
      setNewPassword('');
    } catch {
      setLoginError('Failed to save new password. Please try again.');
    }
  };

  const getStatusBadge = (bus: Bus) => {
    if (isBusActive(bus)) {
      return <span className="text-[9px] font-black px-2 py-0.5 bg-green-100 text-green-700 rounded-full border border-green-200">LIVE</span>;
    }
    if (bus.status === 'MAINTENANCE') {
      return <span className="text-[9px] font-black px-2 py-0.5 bg-amber-100 text-amber-700 rounded-full border border-amber-200">SERVICE</span>;
    }
    return <span className="text-[9px] font-black px-2 py-0.5 bg-slate-100 text-slate-500 rounded-full border border-slate-200">OFFLINE</span>;
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
                  onClick={() => {
                    // FIX 6: (B) Clear old session/state when opening Driver Portal
                    localStorage.removeItem("driverUid");
                    localStorage.removeItem("driverBusId");
                    setCurrentDriver(null);
                    setShowDriverLogin(true);
                  }}
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
                  onClick={() => {
                    // FIX 8: Reset selection & tracking when entering Student Portal
                    setSelectedBus(null);
                    setIsTracking(false);
                    setRole('STUDENT');
                  }}
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
                    <input
                      type="text"
                      value={terminalId}
                      onChange={(e) => {
                        setTerminalId(e.target.value);
                        setLoginError('');
                      }}
                      placeholder="e.g. drv_01"
                      className="w-full px-5 py-4 bg-slate-50 border-2 border-transparent focus:border-indigo-600 focus:bg-white rounded-2xl outline-none transition-all text-sm font-bold text-slate-900 placeholder:text-slate-300"
                    />
                  </div>

                  <div className="relative">
                    <div className="relative">
                      <input
                        type={showPassword ? "text" : "password"}
                        value={password}
                        onChange={(e) => {
                          setPassword(e.target.value);
                          setLoginError('');
                        }}
                        placeholder="••••••••"
                        onKeyPress={(e) => {
                          if (e.key === 'Enter') handleDriverLogin();
                        }}
                        className="w-full px-5 py-4 bg-slate-50 border-2 border-transparent focus:border-indigo-600 focus:bg-white rounded-2xl outline-none transition-all text-sm font-bold text-slate-900 placeholder:text-slate-300 pr-14"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-4 top-1/2 -translate-y-1/2 p-2 text-slate-400 hover:text-indigo-600 transition-colors"
                        aria-label={showPassword ? "Hide password" : "Show password"}
                      >
                        {showPassword ? (
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l18 18" />
                          </svg>
                        ) : (
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                          </svg>
                        )}
                      </button>
                    </div>
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
                      // FIX 6: Clear persistence on cancel
                      localStorage.removeItem("driverUid");
                      localStorage.removeItem("driverBusId");
                      setShowDriverLogin(false);
                      setTerminalId('');
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
              // FIX 8: Total clean wipe when returning to Home
              setRole(null);
              setSelectedBus(null);
              setIsTracking(false);
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
                    busLocation={currentLocation ? {
                      ...currentLocation,
                      isOnline: true,
                      busNumber: selectedBus?.busNumber
                    } : undefined}
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
                        {/* FIX 6: speed stored as m/s, display as km/h; clamp negatives */}
                        <span className="text-sm font-black text-slate-900">
                          {currentLocation?.speed != null && currentLocation.speed > 0
                            ? `${Math.round(currentLocation.speed * 3.6)} km/h`
                            : '0 km/h'}
                        </span>
                      </div>
                    </div>
                  </div>
                  <button
                    onClick={handleLogout}
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
                isActive={isBusActive(selectedBus)}
                studentLocation={studentLocation}
                onBack={() => {
                  setSelectedBus(null);
                  setIsTracking(false);
                }}
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
