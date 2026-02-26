import React, { useEffect, useRef, useMemo, useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Location } from '../types';
import { isValidLocation, isBusActive } from '../services/locationUtils';

// FIX 3: Vite-safe bus icon import
import busIconPng from '../Bus.jpeg';

// FIX 3: Prevent Leaflet from trying to load broken default marker PNGs
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({ iconUrl: '', shadowUrl: '' });

// ── Inline styles ─────────────────────────────────────────────────────────────
const mapStyles = `
  .leaflet-container { font-family: 'Inter', sans-serif; touch-action: manipulation; }
  .map-wrapper { position: relative; width: 100%; height: 100%; -webkit-user-select: none; user-select: none; }
  .leaflet-popup-content-wrapper { border-radius: 12px; }
  .leaflet-popup-content { margin: 6px 12px; }
`;

if (typeof document !== 'undefined') {
  const style = document.createElement('style');
  style.textContent = mapStyles;
  document.head.appendChild(style);
}

// ── Types ─────────────────────────────────────────────────────────────────────
interface MapLocation extends Location {
  isOnline?: boolean;
  busNumber?: string;
  updatedAt?: number;
}

interface MapComponentProps {
  busLocation?: MapLocation;
  userLocation?: Location | null;
  isDriver?: boolean;
  alternativeRoute?: { id: number; timeSaved: number } | null;
  onAcceptRoute?: () => void;
  viewMode?: string;
  eta?: number | null;
}

// ── Helpers ───────────────────────────────────────────────────────────────────
const haversineMeters = (p1: Location, p2: Location): number => {
  return L.latLng(p1.lat, p1.lng).distanceTo(L.latLng(p2.lat, p2.lng));
};

const shouldRefetchRoute = (oldLoc: Location | null, newLoc: Location, threshold = 100): boolean => {
  if (!oldLoc) return true;
  return haversineMeters(oldLoc, newLoc) > threshold;
};

// ── Sub-Components ────────────────────────────────────────────────────────────

const MapSizeFix: React.FC<{ viewMode?: string }> = ({ viewMode }) => {
  const map = useMap();
  useEffect(() => {
    const handle = () => map.invalidateSize();
    setTimeout(handle, 100);
    setTimeout(handle, 500);
    window.addEventListener('resize', handle);
    return () => window.removeEventListener('resize', handle);
  }, [map, viewMode]);
  return null;
};

const MapClickSet: React.FC = () => {
  useMapEvents({
    click(e) {
      const { lat, lng } = e.latlng;
      window.dispatchEvent(new CustomEvent('override-location', { detail: { lat, lng } }));
    },
  });
  return null;
};

const AnimatedMarker: React.FC<{
  position: [number, number];
  icon: L.DivIcon;
  children?: React.ReactNode;
}> = ({ position, icon, children }) => {
  const markerRef = useRef<L.Marker | null>(null);
  const prevPosRef = useRef<[number, number]>(position);
  const animationRef = useRef<number | null>(null);

  useEffect(() => {
    if (markerRef.current) {
      const marker = markerRef.current;
      const from = L.latLng(prevPosRef.current[0], prevPosRef.current[1]);
      const to = L.latLng(position[0], position[1]);

      if (from.distanceTo(to) > 0.5) {
        if (animationRef.current) cancelAnimationFrame(animationRef.current);

        let startTime: number | null = null;
        const duration = 200; // FIX 21: Hyper-fast Swiggy-style animation

        const animate = (timestamp: number) => {
          if (!startTime) startTime = timestamp;
          const progress = Math.min((timestamp - startTime) / duration, 1);
          const currentLat = from.lat + (to.lat - from.lat) * progress;
          const currentLng = from.lng + (to.lng - from.lng) * progress;

          marker.setLatLng([currentLat, currentLng]);
          prevPosRef.current = [currentLat, currentLng];

          if (progress < 1) {
            animationRef.current = requestAnimationFrame(animate);
          }
        };
        animationRef.current = requestAnimationFrame(animate);
      } else {
        marker.setLatLng(to);
        prevPosRef.current = position;
      }
    }
  }, [position]);

  return (
    <Marker position={prevPosRef.current} icon={icon} ref={(ref) => { markerRef.current = ref; }}>
      {children}
    </Marker>
  );
};

// ── Main Component ────────────────────────────────────────────────────────────

const MapComponent: React.FC<MapComponentProps> = ({
  busLocation,
  userLocation,
  viewMode,
  eta,
}) => {
  const [routeCoords, setRouteCoords] = useState<[number, number][]>([]);
  const lastUserLocRef = useRef<Location | null>(null);
  const osrmTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastFetchedRef = useRef<{ student: Location, bus: MapLocation } | null>(null);
  const hasRecentered = useRef(false);

  // Memoize Icons (FIX 20)
  const busIconMemo = useMemo(() => L.divIcon({
    html: `
      <div style="display:flex;align-items:center;justify-content:center;width:48px;height:48px;border-radius:12px;background:#4f46e5;border:3px solid #fff;box-shadow:0 4px 12px rgba(0,0,0,0.2);overflow:hidden;">
        <img src="${busIconPng}" style="width:100%;height:100%;object-fit:cover;" />
      </div>
    `,
    className: '', iconSize: [48, 48], iconAnchor: [24, 24], popupAnchor: [0, -28],
  }), []);

  const studentIconMemo = useMemo(() => L.divIcon({
    html: `
      <div style="display:flex;align-items:center;justify-content:center;width:38px;height:38px;border-radius:50%;background:#fff;border:3px solid #1e293b;box-shadow:0 4px 12px rgba(0,0,0,0.15);font-size:18px;">👨‍🎓</div>
    `,
    className: '', iconSize: [38, 38], iconAnchor: [19, 19],
  }), []);

  if (isValidLocation(userLocation)) lastUserLocRef.current = userLocation;
  const stableUserLoc = userLocation ?? lastUserLocRef.current;
  const busIsActive = isBusActive(busLocation);

  // Route Fetching (FIX 20: 60m threshold)
  useEffect(() => {
    if (busIsActive && isValidLocation(stableUserLoc)) {
      const shouldRefetch = !lastFetchedRef.current ||
        shouldRefetchRoute(lastFetchedRef.current.student, stableUserLoc!) ||
        shouldRefetchRoute(lastFetchedRef.current.bus, busLocation!);

      if (!shouldRefetch) return;

      if (osrmTimerRef.current) clearTimeout(osrmTimerRef.current);
      osrmTimerRef.current = setTimeout(async () => {
        try {
          const url = `https://router.project-osrm.org/route/v1/driving/${stableUserLoc!.lng},${stableUserLoc!.lat};${busLocation!.lng},${busLocation!.lat}?overview=full&geometries=geojson`;
          const response = await fetch(url);
          const data = await response.json();
          if (data.routes?.[0]?.geometry?.coordinates) {
            const coords = data.routes[0].geometry.coordinates.map((c: any) => [c[1], c[0]]);
            setRouteCoords(coords);
            lastFetchedRef.current = { student: stableUserLoc!, bus: busLocation! };
          }
        } catch (e) { console.error('OSRM fail', e); }
      }, 1000);
    } else {
      setRouteCoords([]);
      lastFetchedRef.current = null;
    }
  }, [busLocation?.lat, busLocation?.lng, busIsActive, stableUserLoc?.lat, stableUserLoc?.lng]);

  // Recenter logic
  const MapRecenter = () => {
    const map = useMap();
    useEffect(() => {
      if (hasRecentered.current) return;
      const points: L.LatLngExpression[] = [];
      if (isValidLocation(stableUserLoc)) points.push([stableUserLoc!.lat, stableUserLoc!.lng]);
      if (busIsActive) points.push([busLocation!.lat, busLocation!.lng]);
      if (points.length > 0) {
        if (points.length === 1) map.setView(points[0], 15);
        else map.fitBounds(L.latLngBounds(points), { padding: [50, 50], maxZoom: 16 });
        hasRecentered.current = true;
      }
    }, [map, busIsActive, stableUserLoc]);
    return null;
  };

  return (
    <div className="relative w-full h-full bg-slate-200">
      <MapContainer center={[0, 0]} zoom={2} style={{ width: '100%', height: '100%' }} zoomControl={false}>
        <TileLayer url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png" subdomains="abcd" maxZoom={20} />
        <MapClickSet />
        <MapRecenter />
        <MapSizeFix viewMode={viewMode} />

        {busIsActive && (
          <AnimatedMarker position={[busLocation!.lat, busLocation!.lng]} icon={busIconMemo}>
            <Popup>
              <div className="p-1">
                <h3 className="text-xl font-black text-slate-900 tracking-tighter leading-none mb-1">Bus {busLocation!.busNumber}</h3>
                <span className="text-[10px] font-black text-green-600 uppercase tracking-widest leading-none">Live Now</span>
              </div>
            </Popup>
          </AnimatedMarker>
        )}

        {isValidLocation(stableUserLoc) && (
          <AnimatedMarker position={[stableUserLoc!.lat, stableUserLoc!.lng]} icon={studentIconMemo}>
            {busIsActive && eta != null && (
              <Popup permanent offset={[0, -25]} className="eta-popup-custom">
                <div style={{ background: '#1e293b', color: '#fff', padding: '4px 14px', borderRadius: '20px', fontSize: '11px', fontWeight: '900', whiteSpace: 'nowrap' }}>
                  ETA : {eta} MINS
                </div>
              </Popup>
            )}
          </AnimatedMarker>
        )}

        {busIsActive && routeCoords.length > 0 && (
          <Polyline positions={routeCoords} color="#3b82f6" weight={7} opacity={0.9} lineCap="round" lineJoin="round" />
        )}
      </MapContainer>
    </div>
  );
};

export default MapComponent;
