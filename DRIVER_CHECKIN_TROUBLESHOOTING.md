# Driver Check-In Troubleshooting Guide

## Common Issues & Solutions

### ❌ "Check In Now" Button is Disabled (Grayed Out)

**Cause 1: No Bus Selected**
- **Solution**: Select a bus from the fleet list first
- The button requires a bus to be selected

**Cause 2: Bus Status is "MAINTENANCE"**
- **Solution**: Select a different bus that's in "ACTIVE" status
- Buses in maintenance cannot be used

**Cause 3: Location Not Detected**
- **Solution**: 
  1. Grant location permission to the browser
  2. Enable GPS on your device
  3. Click "Retry Location" in the modal
  4. Wait 10+ seconds for GPS to lock

### ❌ "Camera access denied. Please allow permissions."

**Browser Permission Prompt Not Showing?**

**For Chrome:**
1. Click the lock icon in the address bar
2. Find "Camera" or "Permissions"
3. Click the dropdown next to Camera
4. Select "Always allow"
5. Refresh the page
6. Click "Retry Camera" in the modal

**For Firefox:**
1. In the URL bar, click the info icon
2. Click "Manage Permissions"
3. Toggle "Camera" to ON
4. Refresh and try again

**For Safari (Mac):**
1. Go to Safari → Preferences → Privacy
2. Check "Allow unverified devices to access camera"
3. Or give camera access in System Preferences → Security & Privacy

**For Edge:**
1. Click Settings and more (⋯)
2. Settings → Privacy → Site permissions → Camera
3. Allow camera access for localhost

### ❌ "Using approximate location. Enable GPS for accuracy."

This is **NOT an error** - it means:
- Geolocation is working with approximate location
- You can still check in
- For better accuracy, enable GPS/High-Accuracy mode

**To Enable High-Accuracy Location:**
- **On Phone**: Go to Settings → Location → Turn ON "High Accuracy" mode
- **On Desktop**: GPS might not be available, so approximate location is used

### ❌ "Initializing camera..." Takes Too Long

**Solution 1: Check Camera Permissions**
- Your browser might not have camera permission
- Grant it at the OS level:
  - **Windows**: Settings → Privacy → Camera → Allow apps to use camera
  - **Mac**: System Preferences → Security & Privacy → Camera
  - **Linux**: Run in terminal: `sudo chmod 777 /dev/video0`

**Solution 2: Camera in Use Elsewhere**
- Close other apps using camera (Zoom, Teams, Discord, etc.)
- Refresh the page

**Solution 3: No Camera Connected**
- Check if camera hardware is connected
- Try a different browser or device

### ❌ Check-In Gets Stuck on "Verifying..."

**Solution:**
1. Wait 30 seconds - sometimes it takes time
2. If still stuck, click Cancel and try again
3. Clear browser cache: Ctrl+Shift+Delete (Windows) or Cmd+Shift+Delete (Mac)
4. Restart browser and try again

---

## Step-by-Step Troubleshooting

### 1. Check Browser Console for Errors
1. Press **F12** to open Developer Tools
2. Go to **Console** tab
3. Look for red error messages
4. Screenshot and share the error with support

### 2. Test Permissions Separately

**Test Camera:**
```javascript
// Paste in browser console (F12 → Console)
navigator.mediaDevices.getUserMedia({ video: true })
  .then(stream => {
    console.log('✅ Camera access granted!');
    stream.getTracks()[0].stop();
  })
  .catch(err => console.error('❌ Camera error:', err));
```

**Test Geolocation:**
```javascript
// Paste in browser console
navigator.geolocation.getCurrentPosition(
  pos => {
    console.log('✅ Location access granted!');
    console.log('Lat:', pos.coords.latitude);
    console.log('Lng:', pos.coords.longitude);
  },
  err => console.error('❌ Location error:', err)
);
```

### 3. Check Device Permissions

**Windows 11:**
- Settings → Privacy & Security → Camera → Allow apps to use camera ✅
- Settings → Privacy & Security → Location → Allow apps to access your location ✅

**macOS:**
- System Preferences → Security & Privacy → Camera
- System Preferences → Security & Privacy → Location Services

**Android:**
- Settings → Apps → [App Name] → Permissions → Camera ✅
- Settings → Apps → [App Name] → Permissions → Location ✅

**iOS:**
- Settings → Privacy → Camera → Allow
- Settings → Privacy → Location Services → Allow

---

## Advanced: Manual Testing

### Test with Developer Options

**Chrome DevTools Emulation:**
1. Press F12
2. Press Ctrl+Shift+M to toggle device mode
3. Choose a mobile device
4. Try the check-in process

**Test Different Scenarios:**
```javascript
// Force permission denied
// Go to: chrome://settings/content/camera
// Set localhost to "Block"

// Then test fallback behavior:
// The app should still work with placeholder image
```

---

## Browser Compatibility

| Browser | Camera | Geolocation | Status |
|---------|--------|-------------|--------|
| Chrome | ✅ | ✅ | Fully supported |
| Firefox | ✅ | ✅ | Fully supported |
| Edge | ✅ | ✅ | Fully supported |
| Safari | ✅ | ✅ | Fully supported |
| IE 11 | ⚠️ | ⚠️ | Not recommended |

---

## What to Share with Support

If you're still having issues:

1. **Browser Info:**
   - Browser: Chrome / Firefox / Safari / Edge
   - Version: [see browser menu → About]
   - OS: Windows / Mac / Linux / Android / iOS

2. **Error Details:**
   - Screenshot of the error
   - Console output (F12 → Console tab)
   - Exact error message

3. **Test Results:**
   - Can you access camera in other apps? (Zoom, Teams)
   - Does location work in Google Maps?
   - Can you run the test commands above?

4. **Device Details:**
   - Device has camera? Yes/No
   - Device has GPS? Yes/No
   - Connected to internet? Yes/No

---

## Quick Checklist

Before seeking support, verify:

- [ ] Bus is selected from the list
- [ ] Bus status is "ACTIVE" (not MAINTENANCE)
- [ ] Browser has camera permission
- [ ] Device has camera connected
- [ ] Browser has location permission or fallback is available
- [ ] Device has GPS enabled or can use approximate location
- [ ] Internet connection is active
- [ ] No other apps are using the camera
- [ ] Browser cache is cleared
- [ ] Latest browser version installed

---

## If All Else Fails

**Fallback Check-In Method:**
The app supports checking in even without camera/location:
1. Just wait for the location fallback (2-3 seconds)
2. A placeholder image will be created
3. Click "Check In Now" to complete

This allows the driver to:
- ✅ Start broadcasting location
- ✅ Have their location tracked
- ✅ Receive ETA assistance
- ✅ See route optimization

The only limitation is the attendance photo will be a placeholder.

---

## Need Help?

1. Check this guide first
2. Run the test commands in console
3. Check browser console for errors
4. Contact support with error details

**Support:** dev-team@campusway.edu
**Docs:** [GOOGLE_MAPS_SETUP.md](../GOOGLE_MAPS_SETUP.md)
**Architecture:** [LIVE_TRACKING.md](../LIVE_TRACKING.md)
