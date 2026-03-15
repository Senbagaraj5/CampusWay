import { Location } from '../types';



import L from 'leaflet';

export const googleMapsService = {
  /**
   * FIX 12: Robust distance calculation with coordinate validation and sanity limits.
   * Rejects [0,0], null, NaN. Ignores distances > 200km.
   */
  calculateDistance: (from: Location | null, to: Location | null, debugInfo?: { lastUpdateTs?: number; driverOnline?: boolean }): number | null => {
    if (!from || !to) return null;

    const isInvalid = (l: Location) =>
      (l.lat === 0 && l.lng === 0) ||
      isNaN(l.lat) || isNaN(l.lng) ||
      l.lat == null || l.lng == null;

    if (isInvalid(from) || isInvalid(to)) {
      console.warn("📍 Robust Distance Calc - Skipped due to invalid coords:", { from, to });
      return null;
    }

    const fromLatLng = L.latLng(from.lat, from.lng);
    const toLatLng = L.latLng(to.lat, to.lng);
    const distance = fromLatLng.distanceTo(toLatLng);

    // Requirement B.5: Log debug values
    console.log("📍 Robust Distance Calc:", {
      studentLatLng: `(${from.lat.toFixed(6)}, ${from.lng.toFixed(6)})`,
      busLatLng: `(${to.lat.toFixed(6)}, ${to.lng.toFixed(6)})`,
      lastUpdateTs: debugInfo?.lastUpdateTs,
      driverOnline: debugInfo?.driverOnline,
      computedDistance: `${(distance / 1000).toFixed(2)} km`
    });

    // Requirement B.4: Sanity limit (200km)
    if (distance > 200000) {
      console.warn("📍 Robust Distance Calc - Ignored unrealistic distance (>200km):", (distance / 1000).toFixed(2), "km");
      return null;
    }

    return distance;
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
   * FIX 2: Smooth Marker Animations
   * Animate marker movement smoothly using a requestAnimationFrame easing loop
   */
  animateMarker: (
    marker: L.Marker,
    from: L.LatLng,
    to: L.LatLng,
    duration: number = 800 // default 800ms animation
  ) => {
    const startTime = performance.now();
    const startLat = from.lat;
    const startLng = from.lng;
    const endLat = to.lat;
    const endLng = to.lng;

    const animate = (currentTime: number) => {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);

      // Ease in-out function from user payload
      const ease = progress < 0.5
        ? 2 * progress * progress
        : -1 + (4 - 2 * progress) * progress;

      const lat = startLat + (endLat - startLat) * ease;
      const lng = startLng + (endLng - startLng) * ease;

      marker.setLatLng([lat, lng]);

      if (progress < 1) {
        requestAnimationFrame(animate);
      }
    };

    requestAnimationFrame(animate);
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
   * Format distance for human-readable display.
   * Returns '--' for invalid, zero, or sub-50m (likely GPS noise) values.
   */
  formatDistance: (meters: number | null | undefined): string => {
    if (!meters || meters <= 0) return '--';
    if (isNaN(meters)) return '--';
    if (meters < 50) return '--'; // too close, likely GPS noise
    if (meters < 1000) return `${Math.round(meters)} m`;
    return `${(meters / 1000).toFixed(1)} km`;
  },

  /**
   * Format ETA for human-readable display.
   * Returns '--' for invalid, zero, or unrealistic (>120min) values.
   */
  formatETA: (minutes: number | null | undefined): string => {
    if (!minutes || minutes <= 0) return '--';
    if (isNaN(minutes)) return '--';
    if (minutes > 120) return '--'; // unrealistic
    if (minutes < 1) return '< 1 min';
    return `~${Math.ceil(minutes)} min`;
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
        enableHighAccuracy: true,
        timeout: 5000,
        maximumAge: 0,
        distanceFilter: 5  // FIX 1: update only if moved > 5 meters
      } as any // typecasting because distanceFilter is slightly non-standard typescript DOM depending on environment
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
