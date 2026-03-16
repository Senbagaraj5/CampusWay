package com.campusway.app;

import android.app.*;
import android.content.*;
import android.location.*;
import android.os.*;
import android.util.Log;
import androidx.core.app.NotificationCompat;
import java.io.*;
import java.net.*;
import java.nio.charset.StandardCharsets;

public class LocationService extends Service {

    private static final String TAG = "CampusWayGPS";
    private static final String CHANNEL_ID = "CampusWayChannel";
    private static final int NOTIF_ID = 1001;
    private static final String FIREBASE_URL =
        "https://campusway-mzcet-default-rtdb.asia-southeast1.firebasedatabase.app";

    private LocationManager locationManager;
    private PowerManager.WakeLock wakeLock;
    private String busId = "bus_2"; // Default, will be updated from Intent

    private final LocationListener locationListener = new LocationListener() {
        @Override
        public void onLocationChanged(Location location) {
            double lat = location.getLatitude();
            double lng = location.getLongitude();
            float speed = location.getSpeed() * 3.6f; // Convert m/s to km/h
            float accuracy = location.getAccuracy();
            Log.d(TAG, "GPS Update [" + busId + "]: " + lat + ", " + lng + " | Speed: " + speed + "km/h");
            
            updateFirebase(lat, lng, speed, accuracy);
            updateNotification("Live: " + String.format("%.1f", speed) + " km/h | Acc: " + String.format("%.0f", accuracy) + "m");
        }

        @Override public void onStatusChanged(String provider, int status, Bundle extras) {}
        @Override public void onProviderEnabled(String provider) {
            Log.d(TAG, "Provider enabled: " + provider);
        }
        @Override public void onProviderDisabled(String provider) {
            Log.d(TAG, "Provider disabled: " + provider);
        }
    };

    @Override
    public void onCreate() {
        super.onCreate();
        Log.d(TAG, "Service Created");
        locationManager = (LocationManager) getSystemService(LOCATION_SERVICE);
        createNotificationChannel();
        acquireWakeLock();
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
            busId = intent.getStringExtra("busId");
            // Ensure busId doesn't have double "bus_" if passed incorrectly
            if (busId != null && busId.startsWith("bus_bus_")) {
                busId = busId.replace("bus_bus_", "bus_");
            }
            Log.d(TAG, "Starting tracking for: " + busId);

        if (intent != null && "STOP".equals(intent.getAction())) {
            Log.d(TAG, "Stop action received");
            stopForeground(true);
            stopSelf();
            return START_NOT_STICKY;
        }

        // Show persistent notification immediately
        startForeground(NOTIF_ID, buildNotification("Initializing GPS..."));
        
        startGPS();
        setFirebaseStatus("online");

        return START_STICKY; // Ensure OS restarts service if killed
    }

    private void startGPS() {
        try {
            // Request updates every 3 seconds, 5 meters minimum
            if (locationManager.isProviderEnabled(LocationManager.GPS_PROVIDER)) {
                locationManager.requestLocationUpdates(
                    LocationManager.GPS_PROVIDER, 3000, 5,
                    locationListener, Looper.getMainLooper());
                Log.d(TAG, "GPS_PROVIDER started");
            }
            
            // Network fallback
            if (locationManager.isProviderEnabled(LocationManager.NETWORK_PROVIDER)) {
                locationManager.requestLocationUpdates(
                    LocationManager.NETWORK_PROVIDER, 3000, 5,
                    locationListener, Looper.getMainLooper());
                Log.d(TAG, "NETWORK_PROVIDER started");
            }
        } catch (SecurityException e) {
            Log.e(TAG, "Missing permissions for GPS: " + e.getMessage());
        } catch (Exception e) {
            Log.e(TAG, "Error starting GPS: " + e.getMessage());
        }
    }

    private void updateFirebase(final double lat, final double lng, final float speed, final float accuracy) {
        new Thread(() -> {
            try {
                // Update Location
                String locationUrl = FIREBASE_URL + "/buses/" + busId + "/location.json";
                String data = "{\"lat\":" + lat + ",\"lng\":" + lng +
                    ",\"speed\":" + speed + ",\"accuracy\":" + accuracy +
                    ",\"timestamp\":" + System.currentTimeMillis() + "}";
                firebaseRequest(locationUrl, "PUT", data);

                // Ensure status is online
                String statusUrl = FIREBASE_URL + "/buses/" + busId + "/status.json";
                firebaseRequest(statusUrl, "PUT", "\"online\"");
            } catch (Exception e) {
                Log.e(TAG, "Firebase Update Error: " + e.getMessage());
            }
        }).start();
    }

    private void setFirebaseStatus(final String status) {
        new Thread(() -> {
            try {
                String statusUrl = FIREBASE_URL + "/buses/" + busId + "/status.json";
                firebaseRequest(statusUrl, "PUT", "\"" + status + "\"");
                Log.d(TAG, "Firebase status set to: " + status);
            } catch (Exception e) {
                Log.e(TAG, "Firebase Status Error: " + e.getMessage());
            }
        }).start();
    }

    private void firebaseRequest(String urlStr, String method, String data) throws Exception {
        HttpURLConnection conn = null;
        try {
            URL url = new URL(urlStr);
            conn = (HttpURLConnection) url.openConnection();
            conn.setRequestMethod(method);
            conn.setRequestProperty("Content-Type", "application/json");
            conn.setConnectTimeout(10000);
            conn.setReadTimeout(10000);
            
            if (data != null) {
                conn.setDoOutput(true);
                try (OutputStream os = conn.getOutputStream()) {
                    os.write(data.getBytes(StandardCharsets.UTF_8));
                }
            }
            
            int responseCode = conn.getResponseCode();
            if (responseCode >= 400) {
                Log.e(TAG, "Firebase Request Failed: " + responseCode + " for " + urlStr);
            }
        } finally {
            if (conn != null) conn.disconnect();
        }
    }

    private void acquireWakeLock() {
        PowerManager pm = (PowerManager) getSystemService(POWER_SERVICE);
        if (pm != null) {
            wakeLock = pm.newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "CampusWay::GPS_WakeLock");
            wakeLock.acquire(10*60*1000L /*10 minutes timeout as safety, though we hold it while service runs*/);
            Log.d(TAG, "WakeLock acquired");
        }
    }

    private void createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationChannel ch = new NotificationChannel(
                CHANNEL_ID, "CampusWay Tracking Service", NotificationManager.IMPORTANCE_LOW);
            ch.setDescription("Keeps bus tracking active in background");
            ch.setShowBadge(false);
            NotificationManager nm = getSystemService(NotificationManager.class);
            if (nm != null) nm.createNotificationChannel(ch);
        }
    }

    private Notification buildNotification(String status) {
        // Intent to open App when clicking notification
        Intent openIntent = new Intent(this, MainActivity.class);
        openIntent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        PendingIntent openPending = PendingIntent.getActivity(this, 0, openIntent,
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);

        // Intent for Disconnect button
        Intent stopIntent = new Intent(this, LocationService.class);
        stopIntent.setAction("STOP");
        PendingIntent stopPending = PendingIntent.getService(this, 1, stopIntent,
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);

        return new NotificationCompat.Builder(this, CHANNEL_ID)
            .setContentTitle("🚌 CampusWay - " + busId)
            .setContentText(status)
            .setSmallIcon(android.R.drawable.ic_menu_mylocation)
            .setOngoing(true) // Cannot be swiped away
            .setPriority(NotificationCompat.PRIORITY_LOW)
            .setCategory(Notification.CATEGORY_SERVICE)
            .setContentIntent(openPending)
            .addAction(android.R.drawable.ic_menu_close_clear_cancel, "Disconnect", stopPending)
            .build();
    }

    private void updateNotification(String status) {
        NotificationManager nm = (NotificationManager) getSystemService(NOTIFICATION_SERVICE);
        if (nm != null) {
            nm.notify(NOTIF_ID, buildNotification(status));
        }
    }

    @Override
    public void onDestroy() {
        Log.d(TAG, "Service Destroyed");
        if (locationManager != null) {
            locationManager.removeUpdates(locationListener);
        }
        
        setFirebaseStatus("offline");
        
        if (wakeLock != null && wakeLock.isHeld()) {
            wakeLock.release();
            Log.d(TAG, "WakeLock released");
        }
        
        super.onDestroy();
    }

    @Override
    public IBinder onBind(Intent intent) { return null; }
}