import React, { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { database } from '../services/firebaseConfig';
import { saveLocationHistory } from '../services/api';
import { ref, onValue, off } from 'firebase/database';
import { Location } from '../types';

interface MapComponentProps {
  busId?: string;
  busNumber?: string;
  viewMode?: string;
  onRouteUpdate?: (data: { distance: number | null; duration: number | null }) => void;
}

// ICONS & PULSE ANIMATION
const studentIcon = L.divIcon({
  className: '',
  html: `
    <div style="position:relative; width:44px; height:44px">
      <div style="
        position:absolute; inset:-6px;
        background:rgba(59,130,246,0.2);
        border-radius:50%;
        animation:pulse 2s infinite;
      "></div>
      <div style="
        position:absolute;
        top:50%; left:50%;
        transform:translate(-50%,-50%);
        width:20px; height:20px;
        background:#3B82F6;
        border:3px solid white;
        border-radius:50%;
        box-shadow:0 2px 8px rgba(59,130,246,0.6);
      "></div>
    </div>
    <style>
      @keyframes pulse {
        0%   { transform:scale(1); opacity:0.6; }
        50%  { transform:scale(1.8); opacity:0.1; }
        100% { transform:scale(1); opacity:0.6; }
      }
    </style>
  `,
  iconSize: [44, 44],
  iconAnchor: [22, 22]
});

const busIcon = (busNumber: string) => L.divIcon({
  className: '',
  html: `
    <div style="
      width:48px; height:48px;
      background:#4F46E5;
      border-radius:14px;
      border:3px solid white;
      box-shadow:0 4px 14px rgba(79,70,229,0.5);
      display:flex;
      flex-direction: column;
      align-items:center;
      justify-content:center;
      font-size:20px;
      color: white;
      font-weight: 900;
    ">
      <span style="font-size: 22px; line-height: 1;">🚌</span>
      <span style="font-size: 10px; margin-top: -2px;">${busNumber}</span>
    </div>
  `,
  iconSize: [48, 48],
  iconAnchor: [24, 24]
});

const MapComponent: React.FC<MapComponentProps> = ({
  busId,
  busNumber,
  viewMode,
  onRouteUpdate
}) => {
  const mapRef = useRef<L.Map | null>(null);
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const [map, setMap] = useState<L.Map | null>(null);

  const busMarkerRef = useRef<L.Marker | null>(null);
  const studentMarkerRef = useRef<L.Marker | null>(null);
  const routePolylineRef = useRef<L.Polyline | null>(null);
  const studentLatRef = useRef<number | null>(null);
  const studentLngRef = useRef<number | null>(null);
  const busLatRef = useRef<number | null>(null);
  const busLngRef = useRef<number | null>(null);
  
  const mapInitialized = useRef(false);
  const osrmTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastUpdateRef = useRef<number>(0);

  // MAP INITIALIZATION
  useEffect(() => {
    const initTimer = setTimeout(() => {
      if (mapRef.current || !mapContainerRef.current) return;

      console.log("Map initializing...");

      mapRef.current = L.map(mapContainerRef.current, {
        zoomControl: false,
        attributionControl: false,
        preferCanvas: true,
        tap: false
      });

      L.tileLayer(
        'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png',
        { maxZoom: 19, keepBuffer: 4 }
      ).addTo(mapRef.current);

      setMap(mapRef.current);
    }, 300);

    return () => {
      clearTimeout(initTimer);
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, []);

  // STUDENT LOCATION TRACKING
  useEffect(() => {
    if (!map) return;

    const watchId = navigator.geolocation.watchPosition(
      (position) => {
        const lat = position.coords.latitude;
        const lng = position.coords.longitude;
        studentLatRef.current = lat;
        studentLngRef.current = lng;

        if (!studentMarkerRef.current) {
          studentMarkerRef.current = L.marker([lat, lng], { icon: studentIcon, zIndexOffset: 900 }).addTo(map);
          if (!mapInitialized.current) {
            map.setView([lat, lng], 15);
          }
        } else {
          studentMarkerRef.current.setLatLng([lat, lng]);
        }
        
        // Trigger route update if bus is known
        if (busLatRef.current && busLngRef.current) {
          updateRoadRoute(busLatRef.current, busLngRef.current);
        }
      },
      (error) => {
        console.error("Student GPS error:", error);
        if (error.code === 3) {
            console.warn("📍 GPS Timeout: Check if Location is enabled on your device.");
        }
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );

    return () => navigator.geolocation.clearWatch(watchId);
  }, [map]);

  // BUS LOCATION TRACKING (FIREBASE)
  useEffect(() => {
    if (!map || !busId) return;

    const busLocRef = ref(database, `buses/${busId}/location`);
    const unsubscribe = onValue(busLocRef, (snapshot) => {
      const data = snapshot.val();
      if (!data || !data.lat || !data.lng || (data.lat === 0 && data.lng === 0)) return;

      const busLat = parseFloat(data.lat);
      const busLng = parseFloat(data.lng);
      busLatRef.current = busLat;
      busLngRef.current = busLng;

      if (!busMarkerRef.current) {
        busMarkerRef.current = L.marker([busLat, busLng], { icon: busIcon(busNumber || '??'), zIndexOffset: 1000 }).addTo(map);
      } else {
        busMarkerRef.current.setLatLng([busLat, busLng]);
      }

      updateRoadRoute(busLat, busLng);
      
      // Auto-fit bounds logic
      if (studentLatRef.current && studentLngRef.current) {
        const bounds = L.latLngBounds(
          [studentLatRef.current, studentLngRef.current],
          [busLat, busLng]
        );
        
        // If first update or significantly moved, fit bounds
        if (!mapInitialized.current) {
          map.fitBounds(bounds, { padding: [50, 50], maxZoom: 16 });
          mapInitialized.current = true;
        } else if (viewMode === 'HALF' || viewMode === 'FULL') {
             // Only auto-fit if user isn't actively panning/zooming away
             // Or we can just fit bounds more subtly
        }
      }
    });

    return () => off(busLocRef);
  }, [map, busId, busNumber]);

  // EFFECT: Update marker icon if busNumber changes after initialization
  useEffect(() => {
    if (busMarkerRef.current && busNumber) {
      busMarkerRef.current.setIcon(busIcon(busNumber));
    }
  }, [busNumber]);

  // Road Route Logic (OSRM) - Road Following Fix
  const updateRoadRoute = (busLat: number, busLng: number) => {
    if (!map || studentLatRef.current === null || studentLngRef.current === null) return;
    
    const now = Date.now();
    // Throttle OSRM calls to every 5 seconds to prevent rate limits
    if (now - lastUpdateRef.current < 5000) return;
    lastUpdateRef.current = now;

    if (osrmTimerRef.current) clearTimeout(osrmTimerRef.current);

    osrmTimerRef.current = setTimeout(async () => {
      try {
        const studentLat = studentLatRef.current!;
        const studentLng = studentLngRef.current!;
        
        // Added overview=full for detailed road following
        const url = `https://router.project-osrm.org/route/v1/driving/${studentLng},${studentLat};${busLng},${busLat}?overview=full&geometries=geojson`;
        const response = await fetch(url);
        const data = await response.json();

        if (data.routes?.[0]) {
          const route = data.routes[0];
          const coords: [number, number][] = route.geometry.coordinates.map((c: any) => [c[1], c[0]]);
          
          if (routePolylineRef.current) {
            routePolylineRef.current.setLatLngs(coords);
          } else {
            routePolylineRef.current = L.polyline(coords, {
              color: '#6366F1',
              weight: 6,
              opacity: 0.9,
              lineJoin: 'round',
              lineCap: 'round',
              dashArray: '1, 10' // Subtle dashed path for road following
            }).addTo(map);
          }

          if (onRouteUpdate) {
            onRouteUpdate({ 
              distance: route.distance / 1000, 
              duration: Math.ceil(route.duration / 60) 
            });
          }
          
          // Auto-fit every time the route is recalculated
          if (map) {
            map.fitBounds(routePolylineRef.current.getBounds(), {
              padding: [60, 60],
              maxZoom: 16,
              animate: true
            });
          }

          // Persistence: Save to backend
          saveLocationHistory({
            busId: busId || 'unknown',
            busLat,
            busLng,
            studentLat,
            studentLng,
            distanceKm: route.distance / 1000,
            durationMin: Math.ceil(route.duration / 60)
          }).catch(() => {});
        }
      } catch (e) {
        console.error('OSRM route failed:', e);
      }
    }, 500);
  };

  useEffect(() => {
    if (map) {
      setTimeout(() => map.invalidateSize(), 300);
    }
  }, [map, viewMode]);

  return (
    <div
      ref={mapContainerRef}
      className="absolute inset-0 bg-slate-100"
      style={{ zIndex: 0 }}
    />
  );
};

export default MapComponent;
