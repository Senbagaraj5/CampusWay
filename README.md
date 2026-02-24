<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# CampusWay - College Bus Tracker 🚌📍

Real-time college campus bus tracking with live GPS, AI-powered ETAs, and intelligent route optimization.

## Features

✨ **Live Bus Tracking**
- Real-time GPS location updates for all campus buses
- Animated bus markers with direction indicators
- Live traffic layer overlay
- Smooth map interactions and zooming

👥 **Dual Portal System**
- **Driver Portal**: Broadcast location, receive route recommendations, attend to shift management
- **Student Portal**: Track bus location, view real-time distance, see estimated arrivals

🤖 **AI-Powered Intelligence**
- Smart ETA calculations with traffic awareness
- AI route assistant for optimal paths
- Traffic analysis and alternative route suggestions
- Natural language interaction via chat support

📍 **Location Services**
- Device geolocation with high accuracy
- Real-time student location tracking
- Distance calculations between users and buses
- Automatic map re-centering

## Getting Started

### Prerequisites
- Node.js (v16 or higher)
- Google Cloud Console account (for Maps API)
- Gemini API key (for AI features)

### Installation

1. **Clone the repository:**
   ```bash
   git clone <repository-url>
   cd campusway---college-bus-tracker
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Configure Environment Variables:**
   - Copy `.env.example` to `.env`
   - Add your API keys:
     ```env
     VITE_GOOGLE_MAPS_API_KEY=your_google_maps_api_key
     GEMINI_API_KEY=your_gemini_api_key
     ```

   **For detailed Google Maps setup**: See [GOOGLE_MAPS_SETUP.md](GOOGLE_MAPS_SETUP.md)

4. **Run the development server:**
   ```bash
   npm run dev
   ```

5. **Open in browser:**
   - Navigate to `http://localhost:3000`
   - Allow location permissions when prompted
   - Select your role (Driver or Student)

## What's New - Live Tracking Integration

### 🗺️ Google Maps Integration
- **Real-time tracking** with smooth animations
- **Traffic awareness** with live traffic layer
- **Route optimization** with Directions API
- **Distance calculations** between locations
- **ETA forecasting** based on current speed and conditions

### 📍 Location Services
- Enhanced geolocation with fallback mechanisms
- High-accuracy GPS tracking for drivers
- Student location sharing for distance calculations
- Real-time location updates at 1-second intervals

### 🔄 Live Updates
- Bus location broadcasts with BroadcastChannel API
- Real-time distance and ETA calculations
- Automatic marker animations
- Smart map re-centering

## Project Structure

```
├── components/
│   ├── MapComponent.tsx         # 🗺️ Interactive Google Maps with live tracking
│   ├── AttendanceModule.tsx      # 📸 Driver check-in with photo verification
│   └── ChatModule.tsx            # 💬 AI-powered support chat
├── services/
│   ├── googleMapsService.ts      # 🆕 Google Maps utilities & calculations
│   ├── geminiService.ts          # 🤖 AI/Gemini integration
│   └── mockDatabase.ts           # 💾 Local data persistence
├── App.tsx                       # 🎯 Main application logicalso
├── types.ts                      # 📋 TypeScript type definitions
└── index.html                    # 🌐 Entry point
```

## API Keys Required

### Google Maps API
Get your free API key: https://ai.studio/apps/temp/1
- Enable: Maps JavaScript API, Directions API, Distance Matrix API
- [Setup Guide](GOOGLE_MAPS_SETUP.md)

### Gemini API
For AI features (ETA, route assistance, traffic analysis)
- Get key from: https://ai.google.dev
- Set `GEMINI_API_KEY` in `.env`

## Usage Guide

### For Drivers 👨‍✈️
1. Select "Driver Portal"
2. Choose your assigned vehicle
3. Click "START BROADCASTING"
4. Complete attendance check-in
5. Your live location will broadcast to all students
6. Receive AI-powered route optimization suggestions

### For Students 👨‍🎓
1. Select "Student Portal"
2. View available campus buses with live status
3. Click on a bus to see:
   - Real-time location on the map
   - Distance to the bus
   - Estimated arrival time
   - AI assistant recommendations
4. Chat with support for assistance

## Live Tracking Features

| Feature | Student | Driver |
|---------|---------|--------|
| View bus location | ✅ | ✅ |
| See distance | ✅ | - |
| View ETA | ✅ | - |
| Broadcast location | - | ✅ |
| Traffic awareness | ✅ | ✅ |
| Route suggestions | - | ✅ |
| Chat support | ✅ | - |

## Technical Stack

- **Frontend**: React 19 + TypeScript
- **Maps**: Google Maps JavaScript API
- **Maps Services**: Directions API, Distance Matrix API
- **AI**: Google Gemini API
- **Styling**: Tailwind CSS
- **Build**: Vite
- **State**: React Hooks + Context

## Real-Time Tracking Technology

The app uses several technologies for live tracking:

1. **Geolocation API**: Get device location with high accuracy
2. **BroadcastChannel API**: Real-time communication between tabs
3. **requestAnimationFrame**: Smooth marker animations
4. **Google Maps API**: Display and calculate routes
5. **WebSocket-ready**: Prepared for real-time server updates

## Performance Tips

- Enable "High Accuracy" in browser location settings
- Use GPS for best results (Wi-Fi provides less accuracy)
- Keep cache cleared for fresh location data
- Check network connection for real-time updates

## Troubleshooting

**Map not loading?**
- Verify your Google Maps API key in `.env`
- Check that all required APIs are enabled in Google Cloud Console
- Look at browser console for error messages

**Location not updating?**
- Grant location permission in browser settings
- Enable GPS on your device
- Refresh the page
- Try a different browser

**ETA not calculating?**
- Ensure Gemini API key is set in `.env`
- Check internet connection
- Verify student and bus both have locations

For more detailed troubleshooting, see [GOOGLE_MAPS_SETUP.md](GOOGLE_MAPS_SETUP.md)

## Development

### Available Scripts

```bash
npm run dev      # Start development server
npm run build    # Build for production
npm run preview  # Preview production build locally
```

### Code Quality
- TypeScript for type safety
- React component memoization for performance
- Proper error handling with fallbacks
- Accessibility-first UI design

## Security & Privacy

- API keys are environment-only (never committed)
- Location data is device-local unless explicitly shared
- HTTPS required for production
- No location history stored without consent

## Future Enhancements

- [ ] Real-time server sync with WebSocket
- [ ] Offline mode support
- [ ] Multiple route preferences
- [ ] Student pickup notifications
- [ ] Driver communication system
- [ ] Attendance analytics
- [ ] Budget-aware routing
- [ ] Integration with campus systems

## Contributing

Contributions are welcome! Please ensure:
- Code follows TypeScript strict mode
- Components are properly typed
- Accessibility is maintained
- Tests pass before submitting

## License

MIT License - See LICENSE file for details

## Support

For issues or questions:
1. Check the [GOOGLE_MAPS_SETUP.md](GOOGLE_MAPS_SETUP.md) guide
2. Review the troubleshooting section
3. Check GitHub Issues
4. Contact development team

---

**Built with ❤️ for campus mobility**
