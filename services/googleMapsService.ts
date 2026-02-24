import { Location } from '../types';



import L from 'leaflet';

export const googleMapsService = {
  /**
   * Calculate distance between two locations (meters)
   */
  calculateDistance: (from: Location, to: Location): number => {
    const fromLatLng = L.latLng(from.lat, from.lng);
    const toLatLng = L.latLng(to.lat, to.lng);
    return fromLatLng.distanceTo(toLatLng);
  },

  /**
   * Calculate bearing/heading between two points (degrees)
   */
  calculateHeading: (from: Location, to: Location): number => {
    const φ1 = (from.lat * Math.PI) / 180;
    const φ2 = (to.lat * Math.PI) / 180;
    const λ1 = (from.lng * Math.PI) / 180;
    const λ2 = (to.lng * Math.PI) / 180;
    const y = Math.sin(λ2 - λ1) * Math.cos(φ2);
    const x = Math.cos(φ1) * Math.sin(φ2) -
      Math.sin(φ1) * Math.cos(φ2) * Math.cos(λ2 - λ1);
    const θ = Math.atan2(y, x);
    return ((θ * 180) / Math.PI + 360) % 360;
  },

  /**
   * Estimate ETA based on distance (meters) and average speed (m/s)
   * Returns time in minutes
   */
  estimateETA: (distance: number, speed: number | null | undefined = 15): number => {
    // Default speed is 15 km/h (typical city bus speed)
    const avgSpeed = speed && speed > 0 ? Math.abs(speed) * 3.6 : 15; // Convert m/s to km/h
    const timeInHours = distance / 1000 / avgSpeed;
    return Math.ceil(timeInHours * 60); // Convert to minutes
  },

  /**
   * Create a polyline for bus routes (returns Leaflet Polyline instance)
   */
  createPolyline: (
    map: L.Map,
    path: { lat: number; lng: number }[],
    options?: {
      color?: string;
      weight?: number;
      opacity?: number;
      zIndex?: number;
    }
  ): L.Polyline => {
    const polyline = L.polyline(path, {
      color: options?.color || '#4f46e5',
      weight: options?.weight || 3,
      opacity: options?.opacity ?? 0.7,
      zIndex: options?.zIndex || 1,
    }).addTo(map);
    return polyline;
  },

  /**
   * Animate marker movement smoothly (Leaflet)
   */
  animateMarker: (
    marker: L.Marker,
    from: L.LatLng,
    to: L.LatLng,
    duration: number = 1000
  ) => {
    const startTime = Date.now();
    const startLat = from.lat;
    const startLng = from.lng;
    const endLat = to.lat;
    const endLng = to.lng;

    const animate = () => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / duration, 1);

      const lat = startLat + (endLat - startLat) * progress;
      const lng = startLng + (endLng - startLng) * progress;

      marker.setLatLng([lat, lng]);

      if (progress < 1) {
        requestAnimationFrame(animate);
      }
    };

    animate();
  },

  /**
   * Create animated marker with pulse effect (Leaflet)
   * Returns a Leaflet marker with CSS animation
   */
  createAnimatedMarker: (
    map: L.Map,
    position: Location,
    options?: {
      color?: string;
      title?: string;
      icon?: string;
    }
  ): L.Marker => {
    const markerHtmlStyles = `
      background-color: ${options?.color || '#4f46e5'};
      width: 32px;
      height: 32px;
      display: block;
      left: -16px;
      top: -16px;
      position: relative;
      border-radius: 16px 16px 16px 16px;
      border: 2px solid #fff;
      animation: pulse 1.5s infinite;
    `;
    const icon = L.divIcon({
      className: '',
      html: `<span style="${markerHtmlStyles}"></span>`,
      iconSize: [32, 32],
    });
    const marker = L.marker([position.lat, position.lng], {
      icon,
      title: options?.title || 'Location',
    }).addTo(map);
    // Add CSS for pulse animation if not present
    if (!document.getElementById('leaflet-pulse-keyframes')) {
      const style = document.createElement('style');
      style.id = 'leaflet-pulse-keyframes';
      style.innerHTML = `@keyframes pulse { 0% { box-shadow: 0 0 0 0 rgba(79,70,229,0.7); } 70% { box-shadow: 0 0 0 16px rgba(79,70,229,0); } 100% { box-shadow: 0 0 0 0 rgba(79,70,229,0); } }`;
      document.head.appendChild(style);
    }
    return marker;
  },


  /**
   * Format distance for human-readable display
   */
  formatDistance: (meters: number): string => {
    if (meters < 1000) return `${Math.round(meters)} m`;
    return `${(meters / 1000).toFixed(1)} km`;
  },

  /**
   * Watch user location in real-time with high accuracy - continuous updates
   */
  watchUserLocation: (
    onLocationChange: (location: Location) => void,
    onError?: (error: GeolocationPositionError) => void
  ): number => {
    console.log('🔍 Starting high-accuracy GPS tracking...');
    
    const watchId = navigator.geolocation.watchPosition(
      (position) => {
        const location: Location = {
          lat: position.coords.latitude,
          lng: position.coords.longitude,
          timestamp: position.timestamp || Date.now(),
          speed: position.coords.speed || undefined,
          accuracy: Math.round((position.coords.accuracy || 50) * 100) / 100,
        };
        
        console.log('✅ GPS Update:', {
          latitude: location.lat.toFixed(6),
          longitude: location.lng.toFixed(6),
          accuracy_meters: location.accuracy,
          timestamp: new Date(location.timestamp).toLocaleTimeString(),
        });
        
        onLocationChange(location);
      },
      (error) => {
        console.error('❌ Geolocation Error Code:', error.code, 'Message:', error.message);
        if (onError) onError(error);
      },
      {
        enableHighAccuracy: true, // Force GPS (not WiFi)
        maximumAge: 0, // Always fresh data
        timeout: 8000, // Wait up to 8 seconds for GPS fix
      }
    );
    
    console.log('📍 Watch ID:', watchId);
    return watchId;
  },

  /**
   * Get high accuracy location once (for calibration)
   */
  getHighAccuracyLocation: (): Promise<Location> => {
    return new Promise((resolve, reject) => {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const location: Location = {
            lat: position.coords.latitude,
            lng: position.coords.longitude,
            timestamp: position.timestamp,
            speed: position.coords.speed || undefined,
            accuracy: position.coords.accuracy || 50,
          };
          console.log('✅ High-accuracy location acquired:', {
            lat: location.lat.toFixed(6),
            lng: location.lng.toFixed(6),
            accuracy: location.accuracy,
          });
          resolve(location);
        },
        (error) => {
          console.error('❌ Failed to get location:', error.message);
          reject(error);
        },
        {
          enableHighAccuracy: true,
          maximumAge: 0,
          timeout: 10000,
        }
      );
    });
  },
};
