
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { UserRole, Bus, Location, AttendanceRecord } from './types';
import { firebaseDatabase } from './services/firebaseDatabase';
import { Capacitor, registerPlugin } from '@capacitor/core';
import { Geolocation } from '@capacitor/geolocation';
import { googleMapsService } from './services/googleMapsService';
import { getSmartETA, getRouteAssistant, getTrafficAnalysis } from './services/geminiService';
import MapComponent from './components/MapComponent';
import AttendanceModule from './components/AttendanceModule';
import ChatModule from './components/ChatModule';
import StudentTrackingPage from './components/StudentTrackingPage';
import StudentBusList, { StudentBusCard } from './components/StudentBusList';
import { DriverProfile } from './types';
import collegeLogo from './college_logo.png';
import { isBusActive } from './services/locationUtils';
import { requestBatteryOptimization, showBrandSpecificInstructions } from './components/BackgroundOptimizationPrompts';
import { checkinDriver, startTrip, endTrip } from './services/api';
import DriverLogin from './components/DriverLogin';


// Register Native Plugins
const BackgroundGPS = registerPlugin<any>('BackgroundGPS');


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
  const heartbeatRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const wakeLockRef = useRef<any>(null);

  // LOGIN FIX: track the latest login attempt ID to prevent race conditions
  const loginAttemptRef = useRef<number>(0);

  // Driver login state
  const [showDriverLogin, setShowDriverLogin] = useState(false);
  const [selectedLoginBus, setSelectedLoginBus] = useState<Bus | null>(null);
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loginError, setLoginError] = useState('');
  const [currentDriver, setCurrentDriver] = useState<DriverProfile | null>(null);
  const [showPasswordChange, setShowPasswordChange] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loginTimestamp, setLoginTimestamp] = useState<number | null>(null);

  // Alternative route state
  const [alternativeRoute, setAlternativeRoute] = useState<{ id: number, timeSaved: number } | null>(null);

  // FEATURE 2: Back button & Disconnect confirm
  const [showDisconnectConfirm, setShowDisconnectConfirm] = useState(false);
  
  // FEATURE 3: PWA Install banner
  const [showInstallBanner, setShowInstallBanner] = useState(false);
  const deferredPromptRef = useRef<any>(null);

  // Background GPS states
  const [locationPermission, setLocationPermission] = useState<'granted' | 'denied' | 'prompt' | 'limited'>('prompt');
  const [gpsEnabled, setGpsEnabled] = useState(true);
  const [accuracy, setAccuracy] = useState<number | null>(null);
  const [speed, setSpeed] = useState<number | null>(null);

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

  // Polling for location permissions and GPS status
  useEffect(() => {
    if (role !== 'DRIVER') return;

    const checkStatus = async () => {
      if (!Capacitor.isNativePlatform()) return;

      try {
        const perm = await Geolocation.checkPermissions();
        setLocationPermission(perm.location);

        // Check if GPS is actually on (try to get a quick position)
        try {
          await Geolocation.getCurrentPosition({
            enableHighAccuracy: true,
            timeout: 5000,
            maximumAge: 0
          });
          setGpsEnabled(true);
        } catch (e: any) {
          if (e.code === 3 || e.message?.toLowerCase().includes('location') || e.message?.toLowerCase().includes('gps')) {
            setGpsEnabled(false);
          }
        }
      } catch (err) {
        console.error('Error checking permissions:', err);
      }
    };

    checkStatus();
    const interval = setInterval(checkStatus, 3000);
    return () => clearInterval(interval);
  }, [role]);

  const handleLogout = useCallback(async () => {
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
    setShowDisconnectConfirm(false);
  }, [role, selectedBus]);

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

  // FEATURE 2: Handle hardware back button and modal states
  useEffect(() => {
    // Push state so back button is interceptable
    window.history.pushState(null, '', window.location.href);

    const handlePopState = (e: PopStateEvent) => {
      e.preventDefault();

      if (role === 'DRIVER' && isTracking) {
        // Show confirm before leaving
        setShowDisconnectConfirm(true);
        // Push state again to prevent navigation
        window.history.pushState(null, '', window.location.href);
      } else if (role === 'STUDENT' && selectedBus) {
        // Just deselect if student has a bus
        setSelectedBus(null);
        setIsTracking(false);
        window.history.pushState(null, '', window.location.href);
      } else if (showDriverLogin || role) {
        // Go back to role selection
        setRole(null);
        setShowDriverLogin(false);
        window.history.pushState(null, '', window.location.href);
      } else {
        // Actually go back if we are on the landing page
        // (This might trigger exit if Capacitor is used)
      }
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [role, isTracking, selectedBus, showDriverLogin]);

  // FEATURE 3: Wake Lock and PART 4: Visibility Change
  useEffect(() => {
    const requestLock = async () => {
      if (isTracking && role === 'DRIVER' && 'wakeLock' in navigator) {
        try {
          wakeLockRef.current = await (navigator as any).wakeLock.request('screen');
          console.log('✅ Wake Lock Active');
        } catch (err) {
          console.error('❌ Wake Lock failed:', err);
        }
      }
    };

    const handleVisibilityChange = () => {
      // Feature 3: Wake Lock for Driver
      if (document.visibilityState === 'visible' && isTracking && role === 'DRIVER') {
        requestLock();
      }
      
      // Part 4: Reconnect Firebase for Student (or any role when app foregrounded)
      if (document.visibilityState === 'visible') {
        console.log('App foregrounded - reconnecting...');
        firebaseDatabase.goOffline();
        setTimeout(() => {
          firebaseDatabase.goOnline();
          console.log('Firebase reconnected ✅');
        }, 1000);

        // Refresh map if open - dispatch event for MapComponent
        window.dispatchEvent(new Event('resize'));
      }
    };

    if (isTracking && role === 'DRIVER') {
      requestLock();
    }
    
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      if (wakeLockRef.current) {
        wakeLockRef.current.release().then(() => {
          wakeLockRef.current = null;
          console.log('🔓 Wake Lock Released');
        }).catch(() => {});
      }
    };
  }, [isTracking, role]);

  // FEATURE 3: PWA Install Prompt
  useEffect(() => {
    const handler = (e: any) => {
      e.preventDefault();
      deferredPromptRef.current = e;
      setShowInstallBanner(true);
    };

    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  // Sync selectedBus with buses list (for live updates) and calculate ETA
  useEffect(() => {
    if (selectedBus) {
      const updatedBus = buses.find(b => b.id === selectedBus.id);
      if (updatedBus) {
        if (JSON.stringify(updatedBus) !== JSON.stringify(selectedBus)) {
          setSelectedBus(updatedBus);
        }

        if (role === 'STUDENT' && studentLocation) {
          if (isBusActive(updatedBus)) {
            const distance = googleMapsService.calculateDistance(studentLocation, updatedBus.location!, {
              lastUpdateTs: updatedBus.updatedAt,
              driverOnline: updatedBus.status === 'online'
            });
            if (distance !== null) {
              const currentEta = googleMapsService.estimateETA(distance);
              setEta(currentEta);
            }
          } else {
            setEta(null);
            setAiMessage("This bus is currently offline. Tracking will resume once the driver is back online.");
          }
        }
      }
    }
  }, [buses, selectedBus?.id, role, studentLocation]);

  useEffect(() => {
    if (role === 'STUDENT') {
      console.log('🎓 Student mode - Starting real-time location tracking');

      // FIX 6: Get student location once explicitly to bootstrap the map centering 
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
        (err) => {
          console.error('❌ Initial location failed:', err);
          if (err.code === 3) {
            console.log("Retrying student initial location with lower accuracy...");
            navigator.geolocation.getCurrentPosition(
              (pos) => {
                const retryLoc: Location = {
                  lat: pos.coords.latitude,
                  lng: pos.coords.longitude,
                  timestamp: pos.timestamp || Date.now(),
                  accuracy: pos.coords.accuracy || 100,
                };
                setStudentLocation(retryLoc);
              },
              null,
              { enableHighAccuracy: false, timeout: 30000, maximumAge: 10000 }
            );
          }
        },
        { enableHighAccuracy: true, timeout: 30000, maximumAge: 0 }
      );

      // FIX 6: Then start continuous watching with 30s timeout
      const watchId = navigator.geolocation.watchPosition(
        (position) => {
          const location: Location = {
            lat: position.coords.latitude,
            lng: position.coords.longitude,
            timestamp: position.timestamp || Date.now(),
            speed: position.coords.speed || undefined,
            accuracy: Math.round((position.coords.accuracy || 50) * 100) / 100,
          };
          
          console.log('🔄 Student location updated:', location);

          // Smooth location with weighted average
          const buf = samplesRef.current.student;
          buf.push(location);
          if (buf.length > 6) buf.shift();
          const averaged = averageLocations(buf);
          setStudentLocation(averaged);
        },
        (err) => {
          console.error("Student watch GPS Error:", err.code, err.message);
          if (err.code === 3) {
            console.log("Retrying student watch with lower accuracy...");
            navigator.geolocation.getCurrentPosition(
              (pos) => {
                const retryLoc: Location = {
                  lat: pos.coords.latitude,
                  lng: pos.coords.longitude,
                  timestamp: pos.timestamp || Date.now(),
                  accuracy: pos.coords.accuracy || 100,
                };
                setStudentLocation(retryLoc);
              },
              null,
              { enableHighAccuracy: false, timeout: 30000, maximumAge: 10000 }
            );
          }
        },
        { enableHighAccuracy: true, timeout: 30000, maximumAge: 0 }
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

      let lastLat = 0;
      let lastLng = 0;

      watchIdRef.current = navigator.geolocation.watchPosition(
        (pos) => {
          const { latitude: lat, longitude: lng } = pos.coords;

          // Only update if moved more than 3 meters
          const distMoved = googleMapsService.calculateDistance(
             { lat: lastLat, lng: lastLng, timestamp: 0, accuracy: 0 },
             { lat, lng, timestamp: 0, accuracy: 0 }
          );

          if (distMoved !== null && distMoved < 3) return; // skip if not moved > 3m

          lastLat = lat;
          lastLng = lng;

          const loc: Location = {
            lat,
            lng,
            timestamp: Date.now(),
            speed: pos.coords.speed || 0,
            accuracy: pos.coords.accuracy ?? 50,
          };
          
          console.log('📍 Driver GPS:', {
            bus: selectedBus.busNumber,
            lat: lat.toFixed(6),
            lng: lng.toFixed(6),
            accuracy: loc.accuracy,
            speed_m_s: loc.speed
          });

          setCurrentLocation(loc);

          // Update Firebase Location with 1-second manual throttle
          const now = Date.now();
          if (now - lastBroadcastRef.current >= 1000) {
            firebaseDatabase.updateBusLocation(selectedBus.id, loc);
            lastBroadcastRef.current = now;
          }
        },
        (err) => {
          console.error('🚌 Driver location error:', err);
        },
        { enableHighAccuracy: true, maximumAge: 1000, timeout: 15000 }
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

    // Send check-in to server (MSSQL API)
    checkinDriver(selectedBus.driverName || 'Sivabalan', selectedBus.busNumber || '21', {
      lat: loc.lat,
      lng: loc.lng,
      accuracy: loc.accuracy || 0
    });
  };

  const handleStartBroadcasting = async (targetBus?: Bus) => {
    const bus = targetBus || selectedBus;
    if (!bus) {
      console.error('❌ No bus selected');
      return;
    }

    // REQUEST WAKE LOCK (Web)
    if ('screen' in navigator && (navigator as any).wakeLock) {
      try {
        if (!wakeLockRef.current) {
          wakeLockRef.current = await (navigator as any).wakeLock.request('screen');
          console.log("✅ Wake Lock Active");
          
          wakeLockRef.current.addEventListener('release', () => {
            console.log("ℹ️ Wake Lock Released");
            wakeLockRef.current = null;
          });
        }
      } catch (err) {
        console.error('❌ WakeLock Error:', err);
      }
    }

    console.log('🚀 Starting Persistent Native GPS for bus:', bus.busNumber);

    try {
      if (Capacitor.isNativePlatform()) {
        // 1. Check & Request Location Permissions
        const permStatus = await BackgroundGPS.checkPermissions();
        if (permStatus.location !== 'granted') {
           const request = await BackgroundGPS.requestPermissions();
           if (request.location !== 'granted') {
             setLoginError('Background Location permission is mandatory');
             return;
           }
        }

        // 2. Check if GPS is enabled
        const gpsStatus = await BackgroundGPS.isGPSEnabled();
        if (!gpsStatus.enabled) {
          alert('Please turn on GPS/Location in your system settings');
          await BackgroundGPS.openLocationSettings();
          return;
        }

        // 3. Request Battery Optimization (Unrestricted)
        await BackgroundGPS.requestBatteryOptimization();

        // 4. Show Brand-Specific Guide if first time
        await showBrandSpecificInstructions();

        // 5. Start the Native Foreground Service
        await BackgroundGPS.startService({ busId: bus.id });
        console.log('✅ Native Background GPS service STARTED');
      }
      
      // Update UI state and Firebase status
      setIsTracking(true);
      firebaseDatabase.setDriverOnline(bus.id, true);
      firebaseDatabase.setupOnDisconnect(bus.id);
      
    } catch (e) {
      console.error('❌ Failed to start Native GPS:', e);
      setToastMessage('Failed to start GPS service');
    }
  };


  const handleDriverLogout = useCallback(() => {
    if (selectedBus) {
      firebaseDatabase.setDriverOnline(selectedBus.id, false);
      
      // Stop native background service if on Android
      if (Capacitor.isNativePlatform()) {
        BackgroundGPS.stopService().catch((err: any) => console.error('Failed to stop Background GPS service', err));
      }
    }
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
    if (heartbeatRef.current !== null) {
      clearInterval(heartbeatRef.current);
      heartbeatRef.current = null;
    }
    if (wakeLockRef.current !== null) {
      wakeLockRef.current.release().catch(console.error);
      wakeLockRef.current = null;
    }
    setIsTracking(false);
    setSelectedBus(null);
    setShowDisconnectConfirm(false);

    // Trip end (on disconnect)
    const tripId = localStorage.getItem('currentTripId');
    if (tripId) {
      endTrip(tripId).then(() => {
        localStorage.removeItem('currentTripId');
        console.log('✅ Trip ended:', tripId);
      });
    }
  }, [selectedBus]);



  const handleStudentSelectBus = useCallback(async (bus: Bus) => {
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
        const distance = googleMapsService.calculateDistance(studentLocation, bus.location!, {
          lastUpdateTs: bus.updatedAt,
          driverOnline: bus.status === 'online'
        });

        let newEta: number | null = null;
        let msg = "";

        if (distance !== null) {
          try {
            // Try Gemini for smart ETA
            newEta = await getSmartETA(bus.location!, bus.route);
            msg = await getRouteAssistant(bus.busNumber, bus.status);
          } catch (geminiError) {
            console.warn("⚠️ Gemini API Error - Falling back to manual calculation:", geminiError);
            // FIX 12: Manual ETA fallback via service
            newEta = googleMapsService.estimateETA(distance);
            msg = "Live tracking activated. ETA calculated via distance fallback.";
          }

          setEta(newEta);
          const dStr = googleMapsService.formatDistance(distance);
          const distanceText = dStr !== '--' ? ` (${dStr} away)` : '';
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
  }, [studentLocation]);
  const handleAcceptReroute = () => {
    setAlternativeRoute(null);
    setAiMessage("Route updated! Navigating through the faster alternative.");
  };

  const handleDriverLogin = async () => {
    if (!selectedLoginBus) {
      setLoginError('Please select a bus first');
      return;
    }

    const busId = selectedLoginBus.id; // e.g., "bus_16"
    const pass = password.trim();

    console.log("🛠️ Login Process Started");
    console.log("🔹 Selected Bus:", selectedLoginBus.busNumber);
    console.log("🔹 Using busId:", busId);

    if (!pass) {
      setLoginError('Please enter your PIN');
      return;
    }

    if (isLoading) return; // Block concurrent clicks

    const currentAttemptId = ++loginAttemptRef.current;
    setLoginError('');
    setIsLoading(true);

    try {
      const result = await firebaseDatabase.validateDriverLogin(busId, pass);

      if (currentAttemptId !== loginAttemptRef.current) return;

      if (result.ok) {
        console.log("✅ Authenticated successfully for bus:", busId);
        
        const dummyDriver: DriverProfile = {
          uid: busId,
          busId: busId,
          username: busId,
          mustChangePassword: result.isDefault || false
        };

        setCurrentDriver(dummyDriver);

        if (result.isDefault) {
           console.log("→ Show change password screen");
           setShowPasswordChange(true);
           // We do not set role to DRIVER yet or start broadcasting.
           // They must finish the reset password flow first.
        } else {
           console.log("→ Start GPS sharing");
           setLoginTimestamp(Date.now());
           setRole('DRIVER');
           setSelectedBus(selectedLoginBus); // Fix bus number display
           setShowDriverLogin(false);
           handleStartBroadcasting(selectedLoginBus);

           // SQL Trip Start
           startTrip(selectedLoginBus.busNumber, selectedLoginBus.driverName).then(tripResult => {
             if (tripResult.success) {
               localStorage.setItem('currentTripId', tripResult.tripId);
               console.log('✅ Trip started:', tripResult.tripId);
             }
           });
        }

        setSelectedLoginBus(null);
        setPassword('');
      } else {
        switch (result.reason) {
          case 'NOT_FOUND':
            setLoginError('Bus profile not found. Contact admin.');
            break;
          case 'WRONG_PASSWORD':
            setLoginError('Invalid PIN.');
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
    // Debug logs as requested
    console.log("=== PASSWORD UPDATE ===");
    console.log("currentDriver:", currentDriver);
    console.log("newPassword length:", newPassword.length);
    
    if (newPassword.length < 6) {
      setLoginError('PIN must be at least 6 characters');
      return;
    }
    if (newPassword !== confirmPassword) {
      setLoginError('PINs do not match!');
      return;
    }
    if (newPassword === '123456') {
      setLoginError('Cannot use default password!');
      return;
    }

    if (!currentDriver?.busId) {
      alert("Bus connection lost! ID missing!");
      return;
    }

    try {
      setIsLoading(true);
      console.log("Attempting Firebase write to:", `buses/${currentDriver.busId}/password`);
      
      await firebaseDatabase.updateDriverPassword(currentDriver.busId, newPassword);
      
      console.log("✅ Password and flag updated successfully!");
      alert("Password updated! ✅");

      setLoginTimestamp(Date.now());
      setRole('DRIVER');
      setShowPasswordChange(false);
      setShowDriverLogin(false);

      // Now grab the bus definition directly from state or the parent bus reference
      const bus = buses.find(b => b.id === currentDriver.busId);
      if (bus) {
        setSelectedBus(bus); // Ensure bus is set after password update
        handleStartBroadcasting(bus);

        // SQL Trip Start after password update
        startTrip(bus.busNumber, bus.driverName).then(tripResult => {
           if (tripResult.success) {
             localStorage.setItem('currentTripId', tripResult.tripId);
             console.log('✅ Trip started:', tripResult.tripId);
           }
        });
      }
      setNewPassword('');
      setConfirmPassword('');
    } catch (err: any) {
      console.error("❌ Firebase update error:", err);
      setLoginError('Failed to save new password: ' + (err.message || 'Unknown error'));
    } finally {
      setIsLoading(false);
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
             <DriverLogin 
               onDriverLogin={(session) => {
                 setLoginTimestamp(Date.now());
                 setRole('DRIVER');
                 // Create a partial Bus object for compatibility
                 const selectedBusObj: any = {
                    id: `bus_${session.busNo}`,
                    busNumber: session.busNo.toString(),
                    registrationNumber: session.registration,
                    route: session.route,
                    status: 'online'
                 };
                 setSelectedBus(selectedBusObj);
                 setShowDriverLogin(false);
                 handleStartBroadcasting(selectedBusObj);

                 // SQL Trip Start
                 startTrip(session.busNo.toString(), 'Driver').then(tripResult => {
                   if (tripResult.success) {
                     localStorage.setItem('currentTripId', tripResult.tripId);
                   }
                 });
               }}
               onCancel={() => {
                 setShowDriverLogin(false);
                 setLoginError('');
               }}
             />
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
                  <div className="relative">
                    <label className="block text-[11px] font-black text-slate-400 uppercase tracking-widest mb-3">New Password</label>
                    <div className="relative">
                      <input
                        type={showNewPassword ? 'text' : 'password'}
                        value={newPassword}
                        onChange={(e) => {
                          const val = e.target.value.replace(/[^0-9]/g, '');
                          if (val.length <= 6) setNewPassword(val);
                        }}
                        placeholder="Enter new 6-digit PIN"
                        maxLength={6}
                        inputMode="numeric"
                        className="w-full px-4 py-3 pr-12 border-2 border-slate-100 rounded-xl focus:border-indigo-600 focus:outline-none transition-all text-lg tracking-[0.3em]"
                      />
                      <button
                        onClick={() => setShowNewPassword(!showNewPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 p-2 text-slate-400 hover:text-indigo-600 transition-colors"
                      >
                        {showNewPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                      </button>
                    </div>
                  </div>

                  <div className="relative">
                    <label className="block text-[11px] font-black text-slate-400 uppercase tracking-widest mb-3">Confirm New Password</label>
                    <div className="relative">
                      <input
                        type={showConfirmPassword ? 'text' : 'password'}
                        value={confirmPassword}
                        onChange={(e) => {
                          const val = e.target.value.replace(/[^0-9]/g, '');
                          if (val.length <= 6) setConfirmPassword(val);
                        }}
                        placeholder="Confirm new 6-digit PIN"
                        maxLength={6}
                        inputMode="numeric"
                        className="w-full px-4 py-3 pr-12 border-2 border-slate-100 rounded-xl focus:border-indigo-600 focus:outline-none transition-all text-lg tracking-[0.3em]"
                      />
                      <button
                        onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 p-2 text-slate-400 hover:text-indigo-600 transition-colors"
                      >
                        {showConfirmPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                      </button>
                    </div>
                  </div>

                  {confirmPassword.length > 0 && (
                    <div className={`flex items-center gap-2 text-xs font-bold ${newPassword === confirmPassword ? 'text-emerald-500' : 'text-red-500'} animate-in slide-in-from-top-1 duration-200`}>
                      {newPassword === confirmPassword ? (
                        <><span>✅</span> PINs match!</>
                      ) : (
                        <><span>❌</span> PINs do not match</>
                      )}
                    </div>
                  )}

                  {loginError && <p className="text-xs font-bold text-red-500">{loginError}</p>}

                  <button
                    onClick={() => {
                      if (newPassword !== confirmPassword) {
                        setLoginError('Passwords do not match');
                        return;
                      }
                      handlePasswordUpdate();
                    }}
                    disabled={newPassword.length < 6 || confirmPassword.length < 6}
                    className="w-full py-4 bg-indigo-600 text-white rounded-2xl font-black text-sm shadow-lg hover:bg-indigo-700 active:scale-95 transition-all uppercase tracking-wider disabled:opacity-50 disabled:active:scale-100"
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
            {Capacitor.isNativePlatform() && (locationPermission !== 'granted' || !gpsEnabled) ? (
              <div className="fixed inset-0 bg-white z-[9999] flex flex-col items-center justify-center p-8 text-center animate-in fade-in duration-300">
                <div className="w-24 h-24 bg-red-50 text-red-500 rounded-3xl flex items-center justify-center mb-6">
                  <svg className="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                </div>
                <h2 className="text-2xl font-black text-slate-900 tracking-tighter mb-2">
                  {locationPermission !== 'granted' ? 'Location Permission Required' : 'Please turn on Location/GPS'}
                </h2>
                <p className="text-slate-500 font-medium leading-relaxed mb-8 max-w-xs">
                  {locationPermission !== 'granted' 
                    ? 'CampusWay needs "Allow all the time" access to share your bus position with students even when the app is minimized.'
                    : 'Your GPS appears to be off. Go to Settings > Location and turn it on.'}
                </p>
                
                <div className="w-full space-y-3">
                  {locationPermission !== 'granted' ? (
                    <>
                      <button
                        onClick={async () => {
                          const perm = await Geolocation.requestPermissions();
                          setLocationPermission(perm.location);
                        }}
                        className="w-full py-4 bg-indigo-600 text-white rounded-2xl font-black text-sm shadow-xl active:scale-95 transition-all uppercase tracking-wider"
                      >
                        Grant Permission
                      </button>
                    </>
                  ) : null}
                  <button
                    onClick={async () => {
                        window.alert("Please go to device settings to enable location permissions manually.");
                    }}
                    className="w-full py-4 bg-slate-100 text-slate-600 rounded-2xl font-black text-sm active:scale-95 transition-all uppercase tracking-wider"
                  >
                    Check Settings
                  </button>
                </div>
              </div>
            ) : null}

            {!isTracking ? (
              // FIX: When not tracking, we shouldn't even be in the 'DRIVER' view 
              // unless we are in the driverPortal (controlled by showDriverLogin).
              // Disconnect now unsets the role.
              null
            ) : (
              <div className="w-full max-w-sm mx-auto flex items-center justify-center min-h-[70vh]">
                {/* NEW SIMPLE GPS ACTIVE SCREEN */}
                <div className="bg-white w-full rounded-[2rem] p-8 shadow-xl border border-slate-100 flex flex-col items-center text-center animate-in zoom-in-95 duration-300">
                  <div className="h-20 w-20 flex items-center justify-center mb-6">
                    <img src={collegeLogo} alt="CampusWay" className="w-full h-full object-contain" />
                  </div>
                  
                  <div className="text-5xl mb-4">🚌</div>
                  <h2 className="text-3xl font-bold text-slate-900 tracking-tighter mb-1">Bus {selectedBus?.busNumber}</h2>
                  <p className="text-slate-700 font-black text-xs uppercase tracking-widest mb-1">{selectedBus?.registrationNumber}</p>
                  <p className="text-slate-500 font-medium text-sm mb-6">{selectedBus?.route} Route</p>
                  
                  <div className="flex items-center gap-2 px-4 py-2 bg-green-50 rounded-full border border-green-200 mb-6">
                    <div className="w-2.5 h-2.5 rounded-full bg-green-500 animate-pulse"></div>
                    <span className="text-green-700 font-bold text-sm tracking-wide">Sharing Live</span>
                  </div>

                  <div className="grid grid-cols-2 gap-3 w-full mb-6">
                    <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Accuracy</p>
                      <div className="flex items-center justify-center gap-1.5">
                        <div className={`w-2.5 h-2.5 rounded-full ${!selectedBus?.location?.accuracy || selectedBus.location.accuracy < 15 ? 'bg-emerald-500' : selectedBus.location.accuracy < 50 ? 'bg-amber-500' : 'bg-red-500'}`}></div>
                        <p className={`font-black text-sm ${!selectedBus?.location?.accuracy || selectedBus.location.accuracy < 15 ? 'text-emerald-600' : selectedBus.location.accuracy < 50 ? 'text-amber-600' : 'text-red-600'}`}>
                          {!selectedBus?.location?.accuracy || selectedBus.location.accuracy < 15 ? 'Excellent' : selectedBus.location.accuracy < 50 ? 'Good' : 'Poor'}
                        </p>
                      </div>
                      <p className="text-[9px] text-slate-400 font-bold mt-1">{selectedBus?.location?.accuracy ? `${Math.round(selectedBus.location.accuracy)}m` : '--'}</p>
                    </div>
                    <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Speed</p>
                      <p className="font-black text-xl text-slate-900">{Math.round(selectedBus?.location?.speed || 0)} <span className="text-[10px] font-bold text-slate-400">km/h</span></p>
                      <p className="text-[8px] text-slate-400 font-medium mt-1 truncate">
                        {currentLocation ? `${currentLocation.lat.toFixed(4)}, ${currentLocation.lng.toFixed(4)}` : 'Wait for fix...'}
                      </p>
                    </div>
                  </div>
                  
                  <div className="bg-indigo-50 border border-indigo-100 p-4 rounded-xl text-indigo-800 text-[11px] font-bold w-full mb-8">
                    <p className="flex items-center justify-center gap-2 mb-1 uppercase tracking-wider">
                      <span>⚡</span> Background tracking active
                    </p>
                    <p className="opacity-70 font-medium">You can minimize the app but don't close it</p>
                  </div>

                  <button
                    onClick={() => {
                      // Disconnect completely and go back to Bus Selection
                      handleDriverLogout();
                      setIsTracking(false);
                      setSelectedBus(null);
                      setRole(null);
                      setShowDriverLogin(true); // Return immediately to the bus selection wrapper
                    }}
                    className="w-full py-[14px] bg-red-600 hover:bg-red-700 text-white rounded-xl font-semibold text-[15px] shadow-md transition-all active:scale-[0.98]"
                  >
                    Disconnect
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
                studentLocation={currentLocation}
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

      {/* FEATURE 2: Disconnect Confirmation Modal */}
      {showDisconnectConfirm && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-[200] flex items-end sm:items-center justify-center p-4 animate-in fade-in duration-300">
          <div className="bg-white w-full max-w-sm rounded-[2.5rem] p-8 shadow-2xl animate-in slide-in-from-bottom-8 duration-500">
            <div className="text-center mb-8">
              <div className="w-20 h-20 bg-red-50 text-red-500 rounded-3xl flex items-center justify-center mx-auto mb-4">
                <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>
              </div>
              <h3 className="text-2xl font-black text-slate-900 tracking-tighter mb-2">Stop Tracking?</h3>
              <p className="text-slate-500 text-sm font-medium leading-relaxed px-4">Students won't be able to see your live location if you disconnect.</p>
            </div>
            
            <div className="space-y-3">
              <button
                onClick={handleDriverLogout}
                className="w-full py-4 bg-red-600 text-white rounded-2xl font-black text-sm shadow-xl hover:bg-red-700 active:scale-95 transition-all uppercase tracking-wider"
              >
                Yes, Disconnect
              </button>
              <button
                onClick={() => {
                  setShowDisconnectConfirm(false);
                  window.history.pushState(null, '', window.location.href); // Push again to keep interceptor safe
                }}
                className="w-full py-4 bg-slate-100 text-slate-600 rounded-2xl font-black text-sm hover:bg-slate-200 active:scale-95 transition-all uppercase tracking-wider"
              >
                Keep Sharing
              </button>
            </div>
          </div>
        </div>
      )}

      {/* FEATURE 3: PWA Install Banner */}
      {showInstallBanner && (
        <div className="fixed bottom-6 left-4 right-4 z-[150] animate-in slide-in-from-bottom-10 duration-700">
          <div className="bg-indigo-600 text-white p-5 rounded-[2rem] shadow-2xl flex items-center justify-between border border-white/20 backdrop-blur-xl">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-white/20 rounded-2xl flex items-center justify-center text-2xl">📱</div>
              <div>
                <h4 className="font-black text-sm tracking-tight">Install CampusWay</h4>
                <p className="text-[10px] font-bold text-white/70 uppercase tracking-widest mt-0.5">Faster & Smoother Tracking</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={async () => {
                  if (deferredPromptRef.current) {
                    deferredPromptRef.current.prompt();
                    const { outcome } = await deferredPromptRef.current.userChoice;
                    console.log(`User response to install prompt: ${outcome}`);
                    deferredPromptRef.current = null;
                  }
                  setShowInstallBanner(false);
                }}
                className="px-5 py-2.5 bg-white text-indigo-600 rounded-xl font-black text-xs uppercase tracking-wider active:scale-90 transition-all shadow-lg"
              >
                Install
              </button>
              <button
                onClick={() => setShowInstallBanner(false)}
                className="p-2 text-white/50 hover:text-white transition-colors"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
          </div>
        </div>
      )}
    </div >
  );
};

export default App;
