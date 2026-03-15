import React, { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { database } from '../services/firebaseConfig';
import { ref, onValue, off } from 'firebase/database';
import { Location } from '../types';

interface MapComponentProps {
  busId?: string;
  busNumber?: string;
  viewMode?: string;
  onRouteUpdate?: (data: { distance: number | null; duration: number | null }) => void;
}

// FIX 5 — ICONS & PULSE ANIMATION
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
  const mapInitialized = useRef(false);
  const osrmTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // FIX 4 — MAP INIT TIMING FIX
  useEffect(() => {
    // Wait for DOM to render (modal animation)
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
      
      console.log("Map initialized ✅");
      setMap(mapRef.current);
      
    }, 300);
    
    return () => {
      clearTimeout(initTimer);
      if (mapRef.current) {
        console.log("Cleaning up map...");
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, []);

  // FIX 2 — STUDENT LOCATION TRACKING
  useEffect(() => {
    if (!map) return;
    
    console.log("Getting student location...");
    
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const lat = position.coords.latitude;
        const lng = position.coords.longitude;
        
        console.log("Student initial location acquired:", lat, lng);
        
        studentLatRef.current = lat;
        studentLngRef.current = lng;
        
        if (!studentMarkerRef.current) {
          studentMarkerRef.current = L.marker(
            [lat, lng],
            { icon: studentIcon, zIndexOffset: 900 }
          ).addTo(map);
          
          // Initial view
          map.setView([lat, lng], 15);
          console.log("Student marker created ✅");
        }
      },
      (error) => {
        console.error("Student GPS error:", error.code, error.message);
        if (error.code === 1) {
          alert("Please allow location permission for better experience!");
        } else if (error.code === 3) {
          console.log("Retrying student initial location with lower accuracy...");
          navigator.geolocation.getCurrentPosition(
            (position) => {
               const { latitude: lat, longitude: lng } = position.coords;
               studentLatRef.current = lat;
               studentLngRef.current = lng;
               if (!studentMarkerRef.current) {
                 studentMarkerRef.current = L.marker([lat, lng], { icon: studentIcon, zIndexOffset: 900 }).addTo(map);
                 map.setView([lat, lng], 15);
               }
            },
            null,
            { enableHighAccuracy: false, timeout: 30000, maximumAge: 10000 }
          );
        }
      },
      { enableHighAccuracy: true, timeout: 30000, maximumAge: 0 }
    );
    
    const watchId = navigator.geolocation.watchPosition(
      (position) => {
        const lat = position.coords.latitude;
        const lng = position.coords.longitude;
        
        studentLatRef.current = lat;
        studentLngRef.current = lng;
        
        if (studentMarkerRef.current) {
          studentMarkerRef.current.setLatLng([lat, lng]);
        }
      },
      (error) => {
        console.error("Student watch watchPosition Error:", error.code, error.message);
        if (error.code === 3) {
          console.log("Retrying watchPosition with lower accuracy...");
          navigator.geolocation.getCurrentPosition(
            (position) => {
              const { latitude: lat, longitude: lng } = position.coords;
              studentLatRef.current = lat;
              studentLngRef.current = lng;
              if (studentMarkerRef.current) studentMarkerRef.current.setLatLng([lat, lng]);
            },
            null,
            { enableHighAccuracy: false, timeout: 30000, maximumAge: 10000 }
          );
        }
      },
      { enableHighAccuracy: true, timeout: 30000, maximumAge: 0 }
    );
    
    return () => {
      navigator.geolocation.clearWatch(watchId);
    };
  }, [map]);

  // FIX 1 — BUS LOCATION TRACKING (FIREBASE)
  useEffect(() => {
    if (!map || !busId) return;

    console.log("Subscribing to bus location for:", busId);
    const busLocRef = ref(database, `buses/${busId}/location`);
    
    const unsubscribe = onValue(busLocRef, (snapshot) => {
      const data = snapshot.val();
      console.log("Bus location data received:", data);
      
      if (!data || !data.lat || !data.lng || (data.lat === 0 && data.lng === 0)) {
        console.log("Invalid bus location data, skipping marker update.");
        return;
      }
      
      const busLat = parseFloat(data.lat);
      const busLng = parseFloat(data.lng);
      
      if (!busMarkerRef.current) {
        busMarkerRef.current = L.marker(
          [busLat, busLng],
          { icon: busIcon(busNumber || '??'), zIndexOffset: 1000 }
        ).addTo(map);
        console.log("Bus marker created ✅");
      } else {
        busMarkerRef.current.setLatLng([busLat, busLng]);
        console.log("Bus marker position updated ✅");
      }
      
      // Update road route
      updateRoadRoute(busLat, busLng);
      
      // Fit bounds first time
      if (!mapInitialized.current && studentLatRef.current && studentLngRef.current) {
        map.fitBounds([
          [studentLatRef.current, studentLngRef.current],
          [busLat, busLng]
        ], { padding: [80, 80], maxZoom: 16 });
        mapInitialized.current = true;
      }
    });

    return () => {
      console.log("Unsubscribing from bus location");
      off(busLocRef);
    };
  }, [map, busId, busNumber]);

  // Road Route Logic (OSRM)
  const updateRoadRoute = (busLat: number, busLng: number) => {
    if (!map || studentLatRef.current === null || studentLngRef.current === null) return;

    if (osrmTimerRef.current) clearTimeout(osrmTimerRef.current);

    osrmTimerRef.current = setTimeout(async () => {
      try {
        const studentLat = studentLatRef.current!;
        const studentLng = studentLngRef.current!;
        const url = `https://router.project-osrm.org/route/v1/driving/${studentLng},${studentLat};${busLng},${busLat}?overview=full&geometries=geojson`;
        const response = await fetch(url);
        const data = await response.json();

        if (data.routes?.[0]?.geometry?.coordinates) {
          const route = data.routes[0];
          const distanceKm = route.distance / 1000;
          const durationMin = Math.ceil(route.duration / 60);

          const coords: [number, number][] = route.geometry.coordinates.map(
            (c: any) => [c[1], c[0]] as [number, number]
          );

          if (routePolylineRef.current) {
            routePolylineRef.current.setLatLngs(coords);
          } else {
            routePolylineRef.current = L.polyline(coords, {
              color: '#4F46E5',
              weight: 5,
              opacity: 0.8,
              lineJoin: 'round',
              lineCap: 'round'
            }).addTo(map);
          }
          
          if (onRouteUpdate) {
            onRouteUpdate({ distance: distanceKm, duration: durationMin });
          }
        }
      } catch (e) {
        console.error('OSRM fetch failed', e);
      }
    }, 2000);
  };

  // Invalidate size when viewMode changes
  useEffect(() => {
    if (map) {
      setTimeout(() => map.invalidateSize(), 300);
    }
  }, [map, viewMode]);

  return (
    <div 
      id="map" 
      ref={mapContainerRef} 
      className="absolute inset-0 bg-slate-100" 
      style={{ zIndex: 0 }}
    />
  );
};

export default MapComponent;
