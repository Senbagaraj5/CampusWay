# 🚌 Driver Quick Start Guide

## How to Check In & Start Broadcasting (3 Steps)

### Step 1: Select Your Bus 🚌
1. Click **Driver Portal** button
2. Pick your assigned bus from the list
3. Note the bus number and route

### Step 2: Click "START BROADCASTING" 🚀
1. The check-in modal will appear
2. Grant **Camera** permission when asked
3. Grant **Location** permission when asked

### Step 3: Check In ✅
1. You'll see your live camera feed
2. Location will show when detected
3. Click **"Check In Now"** button
4. You're NOW LIVE! 🎉

---

## What You Should See

✅ **Camera Feed**
- See yourself on screen
- "Camera On" indicator (green)
- Your face/location captured

✅ **Location Status**
- Green checkmark when ready
- Shows your lat/long coordinates
- Might say "Using approximate location" (still works!)

✅ **After Check-In**
- Modal closes automatically
- Map shows your bus location
- You see your speed/velocity
- Students can see you live!

---

## 🆘 If Stuck on "Check In Now" Button (Disabled)

### Cause 1: No Bus Selected
**Solution**: Go back and select a bus from the list

### Cause 2: Camera/Location Not Ready
**Solution**: Wait 5-10 seconds, then try "Retry" buttons

### Cause 3: Permission Denied
**Solution**: 
1. Open browser settings
2. Allow camera and location
3. Reload the page
4. Try again

### Cause 4: Device Issues
**Solution**:
1. Check if camera is physically connected
2. Check if GPS is enabled
3. Try with a different browser
4. Restart your device

---

## 📸 Camera Issues?

**See nothing in camera preview:**
- Click "Retry Camera" button
- Check camera permission in settings
- Make sure no other app is using camera
- Try unplugging and replugging camera

**Still not working?**
- App allows fallback (placeholder image)
- You can still check in and broadcast!
- Just won't have photo verification

---

## 📍 Location Issues?

**See "Detecting Location..." for too long:**
- Click "Retry Location" button  
- Enable high-accuracy GPS mode
- Move to open area (away from buildings)
- Wait 10+ seconds for GPS lock

**See "Using approximate location"?**
- This is FINE - you can still broadcast!
- Accuracy might be 100-500m instead of 5m
- Perfect for campus-level tracking

---

## ✨ After You Check In

### Your Dashboard Shows:
- 🗺️ **Live Map** - Your current location
- 📍 **Your Location** - GPS coordinates
- 💨 **Velocity** - Current speed (km/h)
- 🔐 **Signal** - Encrypted & secure
- 🚌 **Vehicle** - Bus number you selected

### You Can Now:
- ✅ See your location on the map in real-time
- ✅ View your speed and velocity
- ✅ Receive route optimization suggestions
- ✅ Get traffic alerts
- ✅ Receive alternative route recommendations
- ✅ Disconnect from your shift

### Students Can See:
- 📍 Your bus location on their map
- 📏 How far away you are
- ⏱️ Estimated time till arrival
- 🗺️ Your route to campus

---

## 🔄 During Your Shift

### Live Features Active:
- Your location updates every 1-5 seconds
- AI checks traffic every 30 seconds
- Route optimized in real-time
- Students get live distance & ETA

### What to Do:
1. Drive normally to your destination
2. Your location broadcasts automatically
3. If traffic detected, get route suggestions
4. Follow suggested routes to save time
5. When done, click "DISCONNECT" to stop broadcasting

---

## 🛑 When to Disconnect

1. You've reached your destination
2. Your shift is ending
3. You want to stop broadcasting
4. Emergency situation

**Click the Red "DISCONNECT" Button:**
- Your location stops broadcasting
- Students can't see you anymore
- Your attendance check-in is saved
- You can select a new bus if needed

---

## ⚡ Pro Tips

💡 **For Best Results:**
- Start in an open area (away from buildings)
- Let GPS lock for 10+ seconds before checking in
- Keep your phone/device on during shift
- Don't close the browser tab while broadcasting
- Use Chrome or Firefox for best compatibility

💡 **If Updates Seem Slow:**
- Make sure internet is stable
- Check if many apps are using data
- Move closer to WiFi if available
- Restart the browser

💡 **Battery Saver:**
- You'll use 2-3x more battery with:
  - GPS enabled (High Accuracy)
  - Map display on
  - WiFi off
- Try to charge periodically during shift

---

## 📋 Troubleshooting Checklist

Before checking in, verify:
- [ ] I've selected a bus
- [ ] Bus status is "LIVE" (not SERVICE)
- [ ] I'm allowing camera access
- [ ] I'm allowing location access
- [ ] Device has camera
- [ ] GPS is turned on (or WiFi for approximate)
- [ ] Internet is connected
- [ ] Latest browser version

---

## Still Having Issues?

1. **Read**: [DRIVER_CHECKIN_TROUBLESHOOTING.md](DRIVER_CHECKIN_TROUBLESHOOTING.md)
2. **Open**: Browser console (F12 → Console tab)
3. **Look for**: Red error messages
4. **Screenshot**: The error
5. **Contact**: dev-team@campusway.edu

---

## Emergency Help

**Check-in Completely Not Working?**

Try this workaround:
1. Open browser console (F12)
2. Run test command:
   ```javascript
   navigator.mediaDevices.getUserMedia({ video: true })
     .then(() => alert('✅ Camera works!'))
     .catch(err => alert('❌ Camera error: ' + err.message));
   ```
3. Share result with support team

---

## Contact & Support

- **Issues?** Check [DRIVER_CHECKIN_TROUBLESHOOTING.md](DRIVER_CHECKIN_TROUBLESHOOTING.md)
- **Architecture?** See [LIVE_TRACKING.md](../LIVE_TRACKING.md)  
- **Setup?** See [GOOGLE_MAPS_SETUP.md](../GOOGLE_MAPS_SETUP.md)
- **Support Email:** dev-team@campusway.edu

---

**Happy Driving! 🚌📍✨**

Remember: Your location helps students get to campus on time!
