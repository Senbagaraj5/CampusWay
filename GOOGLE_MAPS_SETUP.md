# 🗺️ Google Maps Live Tracking Setup Guide

## Quick Start

This guide will help you set up Google Maps integration for real-time bus tracking in the CampusWay application.

### Prerequisites
- Google Cloud Console account (create at https://console.cloud.google.com)
- A project in Google Cloud Console
- Billing enabled on your Google Cloud project

---

## Step 1: Create a Google Cloud Project

1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Click on the project dropdown at the top
3. Click "NEW PROJECT"
4. Enter your project name: `CampusWay`
5. Click "CREATE"
6. Wait for the project to be created (2-3 minutes)

---

## Step 2: Enable Required APIs

Enable the following APIs for your project:

1. **Maps JavaScript API**
   - Search for "Maps JavaScript API"
   - Click on it
   - Click "ENABLE"

2. **Directions API**
   - Search for "Directions API"
   - Click on it
   - Click "ENABLE"

3. **Distance Matrix API**
   - Search for "Distance Matrix API"
   - Click on it
   - Click "ENABLE"

4. **Geolocation API** (optional, for better location tracking)
   - Search for "Geolocation API"
   - Click on it
   - Click "ENABLE"

---

## Step 3: Create an API Key

1. Go to **Credentials** in the Google Cloud Console left sidebar
2. Click **"+ CREATE CREDENTIALS"** at the top
3. Select **"API Key"**
4. A dialog will appear with your new API key
5. Click **"Copy"** to copy the API key
6. Click **"RESTRICT KEY"** to add security restrictions

### Restrict Your API Key (Recommended for Production)

1. In the **API restrictions** section, select:
   - Maps JavaScript API
   - Directions API
   - Distance Matrix API

2. In the **Application restrictions** section, select:
   - **HTTP referrers (web sites)**
   - Add your domain (e.g., `localhost:3000` for development)

3. Click **"SAVE"**

---

## Step 4: Configure Environment Variables

1. Create a `.env` file in the root directory of the project (copy from `.env.example`):

```bash
VITE_GOOGLE_MAPS_API_KEY=your_api_key_here
```

2. Replace `your_api_key_here` with the API key you copied in Step 3

3. Save the file

**Important:** Never commit `.env` to version control. It's already in `.gitignore`.

---

## Step 5: Enable Location Permissions

### For Browser
When you first access the app, your browser will ask for location permission:
- Click **"Allow"** to share your location with the app
- This is required for live tracking to work

### For Users
- Students need to allow location access to see real-time bus tracking
- Drivers need to allow location access to broadcast their position

---

## Step 6: Test the Setup

1. Install dependencies:
```bash
npm install
```

2. Start the development server:
```bash
npm run dev
```

3. Open `http://localhost:3000` in your browser

4. Select your role (Driver or Student)

5. Verify that:
   - The map loads without errors
   - You can see the bus location markers
   - Real-time updates work as you move
   - Traffic layer displays (toggle with the button)

---

## Features Now Available

✅ **Real-Time Bus Tracking**
- Live GPS location updates for buses
- Bus markers with direction indicators
- Smooth marker animations

✅ **Student Features**
- View your location on the map
- See distance to the selected bus
- Real-time ETA calculations
- Traffic-aware route planning

✅ **Driver Features**
- Broadcast your current location
- Route optimization suggestions
- AI-powered traffic analysis
- Alternative route recommendations

✅ **Map Interactions**
- Zoom and pan controls
- Live traffic layer toggle
- Auto-recenter on bus location
- Distance and ETA display

---

## Troubleshooting

### "Map initialization failed"
- Check that all required APIs are enabled in Google Cloud Console
- Verify your API key is correct in the `.env` file
- Check API restrictions - make sure your domain is whitelisted

### "Location permission denied"
- Grant location permission in browser settings
- For Chrome: Settings → Privacy and security → Site Settings → Location
- Refresh the page after granting permission

### "Maps script failed to load"
- Check your internet connection
- Verify the API key has access to Maps JavaScript API
- Check browser console for more details

### No real-time updates
- Ensure location permission is granted
- Check that your device's GPS is enabled
- Verify the bus is in "ACTIVE" status
- Check browser console for geolocation errors

---

## Production Deployment

When deploying to production:

1. **Update API Key Restrictions**
   - Change HTTP referrers to your production domain
   - Set up a new API key for production if needed

2. **Environment Variables**
   - Create a `.env.production` file with your production API key
   - Never expose sensitive data in client-side code

3. **SSL/HTTPS**
   - APIs require HTTPS in production
   - Most modern browsers also require HTTPS for geolocation

4. **Rate Limiting**
   - Monitor API usage in Google Cloud Console
   - Set up billing alerts to avoid unexpected costs

---

## API Cost Estimation

Google Maps API pricing (as of 2024):

- **Maps JavaScript API**: $7 per 1,000 sessions (first 25,000 free monthly)
- **Directions API**: $5 per 1,000 requests (first 25,000 free monthly)
- **Distance Matrix API**: $5 per 1,000 elements

**Estimated Monthly Cost**: $50-200 depending on usage
- Typical campus with 50 buses and 1,000 students: ~$100/month

---

## Advanced Configuration

### Custom Map Styling
The app includes custom map styles. Modify them in [MapComponent.tsx](components/MapComponent.tsx)

### Geolocation Accuracy
Adjust accuracy settings in [googleMapsService.ts](services/googleMapsService.ts):
```typescript
{
  enableHighAccuracy: true,  // Use GPS (uses more power)
  maximumAge: 0,             // Always get fresh location
  timeout: 5000              // 5 second timeout
}
```

### Update Frequency
Modify the AI traffic check interval in [App.tsx](App.tsx) (currently 30 seconds)

---

## Support & Resources

- [Google Maps API Documentation](https://developers.google.com/maps/documentation)
- [Geolocation API Guide](https://developer.mozilla.org/en-US/docs/Web/API/Geolocation_API)
- [Google Cloud Console](https://console.cloud.google.com)

---

## Security Best Practices

1. **Never expose your API key** in public repositories
2. **Restrict API key** to specific domains and APIs
3. **Monitor API usage** regularly
4. **Use HTTPS** for all connections
5. **Validate user input** on the server side
6. **Consider using a backend proxy** for API calls in production

---

Happy tracking! 🚌📍
