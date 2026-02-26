import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.campusway.app',
  appName: 'CampusWay',
  webDir: 'dist',
  // FIX: Allow mixed HTTP/HTTPS in Android WebView (needed for OSM tiles + Firebase)
  android: {
    allowMixedContent: true,
  },
  server: {
    // FIX: Allow cleartext (HTTP) traffic in WebView
    cleartext: true,
  },
};

export default config;
