package com.campusway.app;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.os.Build;

public class BootReceiver extends BroadcastReceiver {
    @Override
    public void onReceive(Context context, Intent intent) {
        if (Intent.ACTION_BOOT_COMPLETED.equals(intent.getAction())) {
            // In a real app, you might want to check if tracking was active
            // and restart the service here if needed.
            // For now, we just ensure the receiver exists as requested.
        }
    }
}
