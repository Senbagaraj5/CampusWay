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
}

// Small helper to recenter the map when location changes
const MapRecenter: React.FC<{ target?: Location | null }> = ({ target }) => {
  const map = useMap();
  useEffect(() => {
    if (target && map) {
      try {
        map.setView([target.lat, target.lng], Math.max(map.getZoom(), 15), { animate: true });
        // ensure Leaflet recalculates container size after visual changes
        // small timeout helps when the map is inside a styled/animated container
        setTimeout(() => map.invalidateSize(), 200);
      } catch (e) {
        console.warn('Recenter failed', e);
      }
    }
  }, [target, map]);
  return null;
};

// Ensure map invalidates size on mount and window resize (fixes clipping/alignment)
const MapSizeFix: React.FC = () => {
  const map = useMap();
  useEffect(() => {
    const handle = () => map.invalidateSize();
    // Call once on mount
    setTimeout(() => map.invalidateSize(), 100);
    window.addEventListener('resize', handle);
    return () => window.removeEventListener('resize', handle);
  }, [map]);
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

const busIcon = createDivIcon('#4f46e5', 44, '🚌');
const userIcon = createDivIcon('#06b6d4', 36, '📍');

const MapComponent: React.FC<MapComponentProps> = ({ busLocation, userLocation, isDriver, alternativeRoute, onAcceptRoute }) => {
  // Prioritize: user location > bus location > default
  const defaultCenter: [number, number] = [13.0827, 80.2707]; // Chennai, India
  
  let center: [number, number];
  if (userLocation) {
    center = [userLocation.lat, userLocation.lng];
  } else if (busLocation) {
    center = [busLocation.lat, busLocation.lng];
  } else {
    center = defaultCenter;
  }

  useEffect(() => {
    console.log('🗺️ Map Center Updated:', {
      hasUserLocation: !!userLocation,
      hasBusLocation: !!busLocation,
      centerLat: center[0].toFixed(6),
      centerLng: center[1].toFixed(6),
    });
  }, [busLocation, userLocation, center]);

  // allow user to click the map to manually correct/set their location
  const MapClickSet: React.FC = () => {
    useMapEvents({
      click(e) {
        const { lat, lng } = e.latlng;
        // dispatch override event for App to consume
        window.dispatchEvent(new CustomEvent('override-location', { detail: { lat, lng } }));
      },
    });
    return null;
  };

  return (
    <div className="relative w-full h-screen sm:h-screen md:h-[70vh] lg:h-[80vh] 2xl:h-[90vh] rounded-[1rem] sm:rounded-[2rem] md:rounded-[3rem] overflow-hidden border-2 sm:border-4 border-white shadow-2xl bg-slate-200">
      <MapContainer center={center} zoom={15} style={{ width: '100%', height: '100%', display: 'block' }} className="map-wrapper" attributionControl={true} zoomControl={true}>
        <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" attribution="&copy; OpenStreetMap contributors" />

        <MapClickSet />
        <MapRecenter target={busLocation ?? userLocation ?? null} />
        <MapSizeFix />

        {busLocation && (
          <Marker position={[busLocation.lat, busLocation.lng]} icon={busIcon} key={`bus-${busLocation.lat}-${busLocation.lng}`}>
            <Popup>
              <div className="text-sm font-bold">🚌 Bus Location</div>
              <div className="text-xs text-slate-600">Real-time tracking active</div>
            </Popup>
          </Marker>
        )}

        {userLocation && (
          <>
            <Marker position={[Number(userLocation.lat), Number(userLocation.lng)]} icon={userIcon} key={`user-${userLocation.lat}-${userLocation.lng}`}>
              <Popup>
                <div className="text-sm font-bold">📍 Your Location</div>
                <div className="text-xs text-slate-600">Real-time GPS Tracking</div>
                <div className="text-xs text-slate-500 mt-2">
                  Lat: {Number(userLocation.lat).toFixed(6)}<br/>
                  Lng: {Number(userLocation.lng).toFixed(6)}
                </div>
                {userLocation.accuracy != null && (
                  <div className="text-xs text-slate-400">Accuracy: ±{Math.round(userLocation.accuracy)} m</div>
                )}
              </Popup>
            </Marker>

            {userLocation.accuracy != null && (
              <Circle
                center={[Number(userLocation.lat), Number(userLocation.lng)]}
                radius={Math.max(5, Number(userLocation.accuracy))}
                pathOptions={{ color: '#06b6d4', fillColor: '#06b6d4', fillOpacity: 0.12 }}
              />
            )}
          </>
        )}

        {busLocation && userLocation && (
          <Polyline positions={[[busLocation.lat, busLocation.lng], [userLocation.lat, userLocation.lng]]} color="#4f46e5" weight={3} opacity={0.8} dashArray="6,6" />
        )}
      </MapContainer>

      {/* Recenter button - visible on all devices */}
      <div className="absolute top-3 right-3 sm:top-4 sm:right-4 md:top-8 md:right-8 z-10">
        <button
          onClick={() => {
            const target = busLocation ?? userLocation;
            if (target) window.dispatchEvent(new CustomEvent('recenter-map', { detail: target }));
          }}
          className="p-2 sm:p-2.5 md:p-3 bg-white rounded-full shadow-lg border border-slate-200 hover:shadow-xl transition-all active:scale-95 touch-manipulation"
          title="Recenter map"
        >
          ⤢
        </button>
      </div>

      {/* Full-featured info panel - visible on all devices */}
      {!isDriver && busLocation && (
        <div className="absolute bottom-3 left-3 right-3 sm:bottom-4 sm:left-4 sm:right-4 md:bottom-10 md:left-8 md:right-8 pointer-events-none">
          <div className="bg-white/95 backdrop-blur-sm p-3 sm:p-4 md:p-6 rounded-xl sm:rounded-2xl md:rounded-[2.5rem] shadow-2xl border border-slate-100 flex flex-col sm:flex-row sm:items-center sm:justify-between pointer-events-auto gap-3 sm:gap-4 md:gap-6">
            <div className="flex items-center gap-2 sm:gap-3 md:gap-5 flex-1">
              <div className="w-10 h-10 sm:w-12 sm:h-12 md:w-14 md:h-14 bg-indigo-600 rounded-2xl md:rounded-3xl flex items-center justify-center text-white text-lg sm:text-xl md:text-2xl flex-shrink-0">
                🛰️
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[7px] sm:text-[8px] md:text-[10px] font-black text-indigo-500 uppercase truncate">Live GPS Tracking</p>
                <h6 className="font-black text-xs sm:text-sm md:text-base text-slate-800 truncate">Bus Broadcasting Active</h6>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2 sm:gap-3 md:gap-4 text-right text-xs sm:text-sm md:text-base">
              <div className="bg-slate-50 p-2 sm:p-2.5 md:p-3 rounded-lg">
                <p className="text-[7px] sm:text-[8px] md:text-[10px] font-black text-slate-400 uppercase">Distance</p>
                <p className="font-black text-slate-800 mt-1 text-[10px] sm:text-sm md:text-base">--</p>
              </div>
              <div className="bg-slate-50 p-2 sm:p-2.5 md:p-3 rounded-lg">
                <p className="text-[7px] sm:text-[8px] md:text-[10px] font-black text-slate-400 uppercase">ETA</p>
                <p className="font-black text-slate-800 mt-1 text-[10px] sm:text-sm md:text-base">--</p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MapComponent;
