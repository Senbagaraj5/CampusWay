package com.campusway.app;

import android.app.*;
import android.content.Intent;
import android.content.pm.ServiceInfo;
import android.location.*;
import android.os.*;
import androidx.core.app.NotificationCompat;
import com.google.firebase.database.*;

public class LocationService extends Service 
  implements LocationListener {
  
  private LocationManager locationManager;
  private DatabaseReference busRef;
  private String busId;
  private static final String CHANNEL_ID = "gps_channel";
  private static final int NOTIF_ID = 1;

  @Override
  public int onStartCommand(Intent intent, int f, int id) {
    if (intent != null) {
      busId = intent.getStringExtra("busId");
    }
    
    if (busId == null || busId.isEmpty()) {
      stopSelf();
      return START_NOT_STICKY;
    }
    
    // Setup Firebase
    busRef = FirebaseDatabase.getInstance()
      .getReference("buses/" + busId);
    
    // Create notification channel
    createNotificationChannel();
    
    // Start foreground service
    Notification notif = new NotificationCompat
      .Builder(this, CHANNEL_ID)
      .setContentTitle("CampusWay GPS Active")
      .setContentText("Sharing location for " + busId)
      .setSmallIcon(R.mipmap.ic_launcher)
      .setPriority(NotificationCompat.PRIORITY_HIGH)
      .setOngoing(true)  // cant be dismissed
      .build();
    
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
      startForeground(NOTIF_ID, notif,
        ServiceInfo.FOREGROUND_SERVICE_TYPE_LOCATION);
    } else {
      startForeground(NOTIF_ID, notif);
    }
    
    // Start GPS
    startGPS();
    
    return START_STICKY; // restart if killed
  }

  private void startGPS() {
    locationManager = (LocationManager) 
      getSystemService(LOCATION_SERVICE);
    
    try {
      locationManager.requestLocationUpdates(
        LocationManager.GPS_PROVIDER,
        3000,   // 3 seconds
        5,      // 5 meters
        this,
        Looper.getMainLooper()
      );
    } catch (SecurityException e) {
      e.printStackTrace();
    }
  }

  @Override
  public void onLocationChanged(Location location) {
    if (busRef == null) return;
    
    // Update Firebase
    busRef.child("location").setValue(
      new LocationData(
        location.getLatitude(),
        location.getLongitude(),
        System.currentTimeMillis(),
        (float) location.getSpeed(),
        (float) location.getBearing()
      )
    );
    busRef.child("status").setValue("online");
    busRef.child("updatedAt").setValue(System.currentTimeMillis());
  }

  @Override
  public void onDestroy() {
    super.onDestroy();
    if (locationManager != null) {
      locationManager.removeUpdates(this);
    }
    // Set offline when service stops
    if (busRef != null) {
      busRef.child("status").setValue("offline");
    }
  }

  private void createNotificationChannel() {
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
      NotificationChannel channel = new NotificationChannel(
        CHANNEL_ID,
        "GPS Tracking",
        NotificationManager.IMPORTANCE_HIGH
      );
      channel.setDescription("Bus location sharing");
      NotificationManager manager = 
        getSystemService(NotificationManager.class);
      if (manager != null) {
        manager.createNotificationChannel(channel);
      }
    }
  }

  @Override
  public IBinder onBind(Intent intent) { return null; }
}
