package com.campusway.app;

import android.Manifest;
import android.content.Context;
import android.content.Intent;
import android.location.LocationManager;
import android.net.Uri;
import android.os.Build;
import android.os.PowerManager;
import android.provider.Settings;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "BackgroundGPS")
public class BackgroundGPSPlugin extends Plugin {

    @PluginMethod
    public void startService(PluginCall call) {
        String busId = call.getString("busId");
        if (busId == null || busId.isEmpty()) {
            call.reject("busId is required");
            return;
        }

        Intent intent = new Intent(getContext(), LocationService.class);
        intent.putExtra("busId", busId);
        
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            getContext().startForegroundService(intent);
        } else {
            getContext().startService(intent);
        }

        JSObject ret = new JSObject();
        ret.put("status", "started");
        call.resolve(ret);
    }

    @PluginMethod
    public void stopService(PluginCall call) {
        Intent intent = new Intent(getContext(), LocationService.class);
        getContext().stopService(intent);
        
        JSObject ret = new JSObject();
        ret.put("status", "stopped");
        call.resolve(ret);
    }

    @PluginMethod
    public void checkPermissions(PluginCall call) {
        JSObject ret = new JSObject();
        boolean fine = getPermissionState("location") == com.getcapacitor.PermissionState.GRANTED;
        ret.put("location", fine ? "granted" : "denied");
        call.resolve(ret);
    }

    @PluginMethod
    public void requestPermissions(PluginCall call) {
        // This usually triggers the Capacitor standard permission flow
        pluginRequestAllPermissions(call);
    }

    @PluginMethod
    public void requestBatteryOptimization(PluginCall call) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            Intent intent = new Intent();
            String packageName = getContext().getPackageName();
            PowerManager pm = (PowerManager) getContext().getSystemService(Context.POWER_SERVICE);
            if (pm != null && !pm.isIgnoringBatteryOptimizations(packageName)) {
                intent.setAction(Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS);
                intent.setData(Uri.parse("package:" + packageName));
                getContext().startActivity(intent);
                call.resolve();
            } else {
                call.resolve();
            }
        } else {
            call.resolve();
        }
    }

    @PluginMethod
    public void isGPSEnabled(PluginCall call) {
        LocationManager lm = (LocationManager) getContext().getSystemService(Context.LOCATION_SERVICE);
        boolean gpsEnabled = false;
        try {
            gpsEnabled = lm.isProviderEnabled(LocationManager.GPS_PROVIDER);
        } catch (Exception e) {}
        
        JSObject ret = new JSObject();
        ret.put("enabled", gpsEnabled);
        call.resolve(ret);
    }

    @PluginMethod
    public void openLocationSettings(PluginCall call) {
        Intent intent = new Intent(Settings.ACTION_LOCATION_SOURCE_SETTINGS);
        intent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        getContext().startActivity(intent);
        call.resolve();
    }
}
