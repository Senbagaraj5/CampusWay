# Live Tracking Architecture 🚌📍

## Overview

CampusWay implements a real-time bus tracking system using the Google Maps API, Geolocation API, and modern web technologies. This document explains how live tracking works and how to customize it.

## System Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    User Browser                         │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  ┌──────────────────┐        ┌──────────────────┐     │
│  │   MapComponent   │        │   App.tsx        │     │
│  │  - Display Map   │◄──────►│  - State Mgmt    │     │
│  │  - Markers       │        │  - Location      │     │
│  │  - Polylines     │        │  - ETA Calc      │     │
│  └──────────────────┘        └──────────────────┘     │
│           ▲                            ▲                 │
│           │                            │                 │
│           ├── googleMapsService.ts ────┤                │
│           │   (Calculations, Animations)               │
│           │                                             │
│  ┌────────▼──────────────────────────────────────┐    │
│  │    Geolocation API (Device)                   │    │
│  │  - watchPosition() - Real-time GPS            │    │
│  │  - Update interval: ~1 second                 │    │
│  │  - High accuracy enabled                      │    │
│  └───────────────────────────────────────────────┘    │
│                       │                                 │
│  ┌────────────────────▼──────────────────────────┐    │
│  │    BroadcastChannel API                       │    │
│  │  - Inter-tab communication                    │    │
│  │  - Location updates across tabs               │    │
│  └───────────────────────────────────────────────┘    │
│                       │                                 │
└───────────────────────┼─────────────────────────────────┘
                        │
                        ▼
            ┌───────────────────────────┐
            │  Google Maps API           │
            │  - Maps JavaScript API     │
            │  - Directions API          │
            │  - Distance Matrix API     │
            └───────────────────────────┘
```

## Data Flow

### 1. Driver Broadcasting Location

```
Driver Opens App
       ↓
Click "START BROADCASTING"
       ↓
Attendance Check-in
       ↓
watchPosition() activates
       ↓
Every ~1 second:
  - Browser gets GPS location
  - Updates mockDatabase
  - Broadcasts via BroadcastChannel
  - Updates state in App.tsx
       ↓
MapComponent Re-renders
  - Updates bus marker position
  - Calculates heading/rotation
  - Animates marker movement
  - Updates UI with speed info
       ↓
Bus Location Available to Students
```

### 2. Student Viewing Live Bus

```
Student Selects Bus from Fleet
       ↓
requestGeolocation() activates
  - Gets student location
  - Watches for updates
       ↓
MapComponent Receives Props:
  - busLocation (real-time GPS)
  - userLocation (student location)
       ↓
Every Update:
  - Calculate distance (googleMapsService.calculateDistance)
  - Calculate heading (googleMapsService.calculateHeading)
  - Calculate ETA (googleMapsService.estimateETA)
  - Fetch route (googleMapsService.getRoute)
       ↓
Display on Map:
  - Bus marker at busLocation
  - Student marker at userLocation
  - Route polyline from bus to destination
  - Info panel shows distance & ETA
```

## Key Technologies

### 1. Geolocation API
```typescript
// Enable high-accuracy GPS tracking
navigator.geolocation.watchPosition(
  (position) => {
    const location: Location = {
      lat: position.coords.latitude,
      lng: position.coords.longitude,
      timestamp: position.timestamp,
      speed: position.coords.speed  // in m/s
    };
    // Update application state
  },
  (error) => console.error(error),
  {
    enableHighAccuracy: true,  // Uses GPS (more power, more accurate)
    maximumAge: 0,             // Always get fresh data
    timeout: 5000              // 5 second timeout
  }
);
```

**Accuracy**: 5-50 meters (with GPS), better with modern devices

### 2. Google Maps JavaScript API

#### Display Map
```typescript
const map = new google.maps.Map(containerElement, {
  center: initialPosition,
  zoom: 15,
  mapTypeControl: false,
  fullscreenControl: false
});
```

#### Create Markers
```typescript
const marker = new google.maps.Marker({
  position: new google.maps.LatLng(lat, lng),
  map: map,
  icon: customIcon,
  animation: google.maps.Animation.DROP
});
```

#### Display Routes
```typescript
const directions = new google.maps.DirectionsService();
directions.route({
  origin: busLocation,
  destination: campusGate,
  travelMode: google.maps.TravelMode.DRIVING
}, (result, status) => {
  if (status === 'OK') {
    new google.maps.Polyline({
      path: result.routes[0].overview_path,
      map: map
    });
  }
});
```

### 3. Mathematical Calculations

#### Distance Between Two Points
```typescript
const distance = google.maps.geometry.spherical.computeDistanceBetween(
  new google.maps.LatLng(lat1, lng1),
  new google.maps.LatLng(lat2, lng2)
);
// Returns distance in meters
```

#### Heading/Bearing Between Two Points
```typescript
const heading = google.maps.geometry.spherical.computeHeading(
  from_latLng,
  to_latLng
);
// Returns heading in degrees (0-360)
// 0° = North, 90° = East, 180° = South, 270° = West
```

#### ETA Calculation
```typescript
const distanceInKm = distance / 1000;
const speedInKmh = speed * 3.6; // Convert m/s to km/h
const timeInHours = distanceInKm / speedInKmh;
const etaInMinutes = Math.ceil(timeInHours * 60);
```

### 4. Animation & Movement

#### Smooth Marker Movement
```typescript
function animateMarker(marker, from, to, duration = 1000) {
  const startTime = Date.now();
  
  const animate = () => {
    const elapsed = Date.now() - startTime;
    const progress = Math.min(elapsed / duration, 1);
    
    // Linear interpolation
    const lat = from.lat() + (to.lat() - from.lat()) * progress;
    const lng = from.lng() + (to.lng() - from.lng()) * progress;
    
    marker.setPosition(new google.maps.LatLng(lat, lng));
    
    if (progress < 1) {
      requestAnimationFrame(animate);
    }
  };
  
  animate();
}
```

#### Marker Rotation
```typescript
// Update marker icon with new rotation
const icon = marker.getIcon();
icon.rotation = heading;  // Heading in degrees
marker.setIcon(icon);
```

## Real-Time Update Cycle

### Update Frequency
- **Driver Location Updates**: Every GPS update (~1-5 seconds, depending on device)
- **Student Location Updates**: Every watchPosition callback (~1-5 seconds)
- **Distance/ETA Calculations**: Every time location updates
- **Traffic Check**: Every 30 seconds (configurable in App.tsx)
- **Map Re-renders**: React updates, batched for performance

### Performance Optimization
```typescript
// Use useCallback for stable function references
const handleLocationUpdate = useCallback((location) => {
  setCurrentLocation(location);
  mockDatabase.updateBusLocation(busId, location);
}, [busId]);

// Throttle heavy computations
useEffect(() => {
  if (!busLocation || !userLocation) return;
  
  const distance = googleMapsService.calculateDistance(
    userLocation, 
    busLocation
  );
  setDistanceToUser(distance);
}, [busLocation, userLocation]);
```

## Customization Guide

### Change Update Frequency
```typescript
// In App.tsx - Driver location watch
navigator.geolocation.watchPosition(
  callback,
  error,
  {
    enableHighAccuracy: true,
    maximumAge: 0,           // Change to 2000 for 2-second updates
    timeout: 5000            // Increase for slower networks
  }
);
```

### Adjust ETA Calculation
```typescript
// In googleMapsService.ts
estimateETA: (distance: number, speed: number = 15): number => {
  // Change default speed (km/h) based on your city
  // Campus buses: 15 km/h
  // Highway buses: 50 km/h
  // Residential: 20 km/h
  const avgSpeed = speed ? speed * 3.6 : 15;
  return Math.ceil((distance / 1000 / avgSpeed) * 60);
};
```

### Custom Map Styling
```typescript
const mapStyles = [
  {
    "featureType": "road",
    "elementType": "geometry",
    "stylers": [{ "color": "#ff0000" }]
  },
  // Add more style rules
];

const map = new google.maps.Map(element, {
  styles: mapStyles
});
```

### Change Marker Icons
```typescript
const busIcon = {
  path: "M12 2...",  // SVG path data
  fillColor: "#4f46e5",  // Change color
  scale: 1.5,            // Change size
};

marker.setIcon(busIcon);
```

### Traffic Layer Toggle
```typescript
const trafficLayer = new google.maps.TrafficLayer();

// Show traffic
trafficLayer.setMap(map);

// Hide traffic
trafficLayer.setMap(null);
```

## Troubleshooting Live Tracking

### Location Updates Not Working
1. **Check Permissions**: Browser location permission granted?
2. **Check GPS**: Device GPS enabled?
3. **Check Network**: Internet connection available?
4. **Check Console**: Any JavaScript errors?

```typescript
// Debug location updates
navigator.geolocation.watchPosition(
  (pos) => console.log('Location:', pos.coords),
  (err) => console.error('Error:', err),
  { enableHighAccuracy: true }
);
```

### Map Not Displaying
1. **Check API Key**: Valid and enabled?
2. **Check APIs**: Maps JavaScript API enabled in Google Cloud?
3. **Check Container**: Proper height/width on map element?

### Markers Not Moving
1. **Check Data Flow**: Bus location updating in state?
2. **Check Props**: MapComponent receiving busLocation prop?
3. **Check Rendering**: React re-rendering on location change?

### ETA Not Calculating
1. **Check Speed**: Bus speed value available?
2. **Check Distance**: Student location and bus location both available?
3. **Check Fallback**: Default speed of 15 km/h being used?

## Performance Metrics

### Typical Latency
- GPS Location Update: 1-10 seconds
- App State Update: <100ms
- Map Marker Update: <50ms
- Distance/ETA Calc: <10ms
- **Total End-to-End**: 1-15 seconds

### Data Usage
- Location Update: ~500 bytes
- Map Tile: 50-200 KB per map view
- Directions API: 2-5 KB per request
- **Hourly**: 5-50 MB (depends on frequency)

### Battery Impact
- GPS Enabled: 2-5% per hour
- High-Accuracy Mode: 3-6% per hour
- Map Display: 1-2% per hour
- **Total**: 5-10% per hour with all features active

## Future Enhancements

### Real-Time Server Sync
```typescript
// Replace BroadcastChannel with WebSocket
const ws = new WebSocket('wss://api.example.com/tracking');
ws.onmessage = (event) => {
  const location = JSON.parse(event.data);
  updateBusLocation(location);
};
```

### Predictive Routing
```typescript
// Calculate predicted route based on historical data
const predictedRoute = await geminiService.predictRoute(
  currentLocation,
  busRoute,
  historicalData
);
```

### Offline Mode
```typescript
// Store locations in IndexedDB
const db = await openDB('campusway');
await db.put('locations', location);

// Sync when reconnected
window.addEventListener('online', syncLocations);
```

---

**For more info**: [GOOGLE_MAPS_SETUP.md](GOOGLE_MAPS_SETUP.md) | [README.md](README.md)
