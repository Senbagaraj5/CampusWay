package com.campusway.app;

import android.content.Intent;
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
        
        if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.O) {
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
}
