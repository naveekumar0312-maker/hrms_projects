package com.vibhutravelhub.shiftalarm

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.os.Build

class AlarmReceiver : BroadcastReceiver() {
  override fun onReceive(context: Context, intent: Intent) {
    val serviceIntent = Intent(context, AlarmPlaybackService::class.java).apply {
      action = AlarmPlaybackService.ACTION_PLAY
      putExtras(intent)
    }
    try {
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
        context.startForegroundService(serviceIntent)
      } else {
        context.startService(serviceIntent)
      }
    } catch (_: Exception) {
      // The OS may block service startup under restricted device conditions.
    }
  }
}