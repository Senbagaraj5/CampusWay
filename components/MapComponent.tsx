import React, { useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polyline, Circle, useMap, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Location } from '../types';

// Add CSS to ensure map works on all devices
const mapStyles = `
  .leaflet-container {
    font-family: 'Inter', sans-serif;
    touch-action: manipulation;
  }
  .map-wrapper {
    position: relative;
    width: 100%;
    height: 100%;
    -webkit-user-select: none;
    user-select: none;
  }
  /* Show all controls on all devices - mobile, tablet, and desktop */
  .leaflet-control-zoom,
  .leaflet-control-attribution,
  .leaflet-control-layers,
  .leaflet-top,
  .leaflet-bottom {
    display: flex !important;
  }
  
  /* Adjust control positioning for smaller screens */
  @media (max-width: 640px) {
    .leaflet-control-attribution {
      font-size: 10px;
      padding: 2px 4px;
      background: rgba(255, 255, 255, 0.85);
    }
    .leaflet-control-zoom {
      margin: 8px;
    }
    .leaflet-control-zoom a {
      width: 32px;
      height: 32px;
      line-height: 32px;
      font-size: 14px;
    }
    .leaflet-control-zoom-in,
    .leaflet-control-zoom-out {
      font-size: 14px;
    }
  }
  
  /* Tablet sizing */
  @media (min-width: 641px) and (max-width: 1024px) {
    .leaflet-control-zoom {
      margin: 12px;
    }
    .leaflet-control-attribution {
      font-size: 11px;
    }
  }
  
  /* Desktop - full featured */
  @media (min-width: 1025px) {
    .leaflet-control-zoom {
      margin: 16px;
    }
    .leaflet-control-attribution {
      font-size: 12px;
    }
  }
  
  /* Ensure popups are visible and responsive */
  .leaflet-popup-content-wrapper {
    max-width: 85vw;
    border-radius: 12px;
  }
  
  .leaflet-popup-content {
    margin: 6px 12px;
  }
`;

// Inject styles
if (typeof document !== 'undefined') {
  const style = document.createElement('style');
  style.textContent = mapStyles;
  document.head.appendChild(style);
}

interface MapComponentProps {
  busLocation?: Location;
  userLocation?: Location | null;
  isDriver?: boolean;
  alternativeRoute?: { id: number; timeSaved: number } | null;
  onAcceptRoute?: () => void;
  viewMode?: string;
}

// Small helper to recenter the map when location changes
const MapRecenter: React.FC<{ target?: Location | null, viewMode?: string }> = ({ target, viewMode }) => {
  const map = useMap();
  useEffect(() => {
    if (target && map) {
      try {
        map.setView([target.lat, target.lng], Math.max(map.getZoom(), 15), { animate: true });
        // ensure Leaflet recalculates container size after visual changes
        setTimeout(() => map.invalidateSize(), 500); // Increased timeout for CSS transitions
      } catch (e) {
        console.warn('Recenter failed', e);
      }
    }
  }, [target, map, viewMode]);
  return null;
};

// Ensure map invalidates size on mount and window resize (fixes clipping/alignment)
const MapSizeFix: React.FC<{ viewMode?: string }> = ({ viewMode }) => {
  const map = useMap();
  useEffect(() => {
    const handle = () => map.invalidateSize();
    // Force a resize check when viewMode changes
    setTimeout(() => map.invalidateSize(), 100);
    setTimeout(() => map.invalidateSize(), 500); // Second check after transition
    window.addEventListener('resize', handle);
    return () => window.removeEventListener('resize', handle);
  }, [map, viewMode]);
  return null;
};

// Simple div icons so markers render consistently
const createDivIcon = (color: string, size = 36, emoji = '') =>
  L.divIcon({
    html: `<div style="display:flex;align-items:center;justify-content:center;width:${size}px;height:${size}px;border-radius:50%;background:${color};border:3px solid #fff;font-weight:700">${emoji}</div>`,
    className: '',
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  });

const busIcon = L.divIcon({
  html: `
    <div style="
      display: flex;
      align-items: center;
      justify-content: center;
      width: 48px;
      height: 48px;
      border-radius: 12px;
      background: #4f46e5;
      border: 3px solid #fff;
      box-shadow: 0 4px 12px rgba(0,0,0,0.2);
      overflow: hidden;
    ">
      <img src="/Bus.jpeg" style="width: 100%; height: 100%; object-fit: cover;" />
    </div>
  `,
  className: '',
  iconSize: [48, 48],
  iconAnchor: [24, 24],
});
const userIcon = createDivIcon('#06b6d4', 36, '📍');

// Smoothly animated marker component
const AnimatedMarker: React.FC<{ position: [number, number], icon: L.DivIcon, children?: React.ReactNode }> = ({ position, icon, children }) => {
  const markerRef = React.useRef<L.Marker | null>(null);
  const prevPosRef = React.useRef<[number, number]>(position);

  useEffect(() => {
    if (markerRef.current) {
      const marker = markerRef.current;
      const from = L.latLng(prevPosRef.current[0], prevPosRef.current[1]);
      const to = L.latLng(position[0], position[1]);

      if (from.distanceTo(to) > 1) { // Only animate if significant movement
        let startTime: number | null = null;
        const duration = 1000;

        const animate = (timestamp: number) => {
          if (!startTime) startTime = timestamp;
          const elapsed = timestamp - startTime;
          const progress = Math.min(elapsed / duration, 1);

          const currentLat = from.lat + (to.lat - from.lat) * progress;
          const currentLng = from.lng + (to.lng - from.lng) * progress;
          marker.setLatLng([currentLat, currentLng]);

          if (progress < 1) {
            requestAnimationFrame(animate);
          } else {
            prevPosRef.current = position;
          }
        };
        requestAnimationFrame(animate);
      } else {
        marker.setLatLng(to);
        prevPosRef.current = position;
      }
    }
  }, [position]);

  return (
    <Marker
      position={prevPosRef.current}
      icon={icon}
      ref={(ref) => { markerRef.current = ref; }}
    >
      {children}
    </Marker>
  );
};

const MapComponent: React.FC<MapComponentProps> = ({ busLocation, userLocation, isDriver, alternativeRoute, onAcceptRoute, viewMode }) => {
  const [routeCoords, setRouteCoords] = React.useState<[number, number][]>([]);

  // Prioritize: user location > bus location > default
  const defaultCenter: [number, number] = [10.395, 78.824]; // Pudukkottai/Chennai area

  const center: [number, number] = userLocation
    ? [userLocation.lat, userLocation.lng]
    : (busLocation ? [busLocation.lat, busLocation.lng] : defaultCenter);

  // Road-following routing using OSRM
  useEffect(() => {
    if (busLocation && userLocation) {
      const fetchRoute = async () => {
        try {
          const url = `https://router.project-osrm.org/route/v1/driving/${userLocation.lng},${userLocation.lat};${busLocation.lng},${busLocation.lat}?overview=full&geometries=geojson`;
          const response = await fetch(url);
          const data = await response.json();
          if (data.routes && data.routes.length > 0) {
            const coords = data.routes[0].geometry.coordinates.map((coord: [number, number]) => [coord[1], coord[0]] as [number, number]);
            setRouteCoords(coords);
          }
        } catch (error) {
          console.error('OSRM Route Fetch Error:', error);
          setRouteCoords([[userLocation.lat, userLocation.lng], [busLocation.lat, busLocation.lng]]);
        }
      };

      fetchRoute();
    } else {
      setRouteCoords([]);
    }
  }, [busLocation?.lat, busLocation?.lng, userLocation?.lat, userLocation?.lng]);

  const MapClickSet: React.FC = () => {
    useMapEvents({
      click(e) {
        const { lat, lng } = e.latlng;
        window.dispatchEvent(new CustomEvent('override-location', { detail: { lat, lng } }));
      },
    });
    return null;
  };

  return (
    <div className="relative w-full h-full bg-slate-200">
      <MapContainer
        center={center}
        zoom={15}
        style={{ width: '100%', height: '100%' }}
        className="map-wrapper"
        zoomControl={false}
      >
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution='&copy; OpenStreetMap contributors'
        />

        <MapClickSet />
        <MapRecenter target={busLocation ?? userLocation ?? null} viewMode={viewMode} />
        <MapSizeFix viewMode={viewMode} />

        {busLocation && (
          <AnimatedMarker position={[busLocation.lat, busLocation.lng]} icon={busIcon}>
            <Popup>
              <div className="text-sm font-bold">🚌 Bus {busLocation.lat.toFixed(4)}</div>
            </Popup>
          </AnimatedMarker>
        )}

        {userLocation && (
          <AnimatedMarker position={[userLocation.lat, userLocation.lng]} icon={userIcon}>
            <Popup>
              <div className="text-sm font-bold">📍 Your Location</div>
            </Popup>
          </AnimatedMarker>
        )}

        {routeCoords.length > 0 && (
          <Polyline
            positions={routeCoords}
            color="#4f46e5"
            weight={5}
            opacity={0.8}
            lineCap="round"
            lineJoin="round"
          />
        )}
      </MapContainer>

      {/* Recenter button */}
      <div className="absolute top-4 right-4 z-10">
        <button
          onClick={() => {
            const target = busLocation ?? userLocation;
            if (target) window.dispatchEvent(new CustomEvent('recenter-map', { detail: target }));
          }}
          className="p-3 bg-white rounded-full shadow-xl border border-slate-100 active:scale-90 transition-all"
        >
          <svg className="w-6 h-6 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
        </button>
      </div>
    </div>
  );
};

export default MapComponent;
