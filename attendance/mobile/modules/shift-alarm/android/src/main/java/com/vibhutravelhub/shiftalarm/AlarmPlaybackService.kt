package com.vibhutravelhub.shiftalarm

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Intent
import android.media.MediaPlayer
import android.os.Build
import android.os.IBinder
import androidx.core.app.NotificationCompat

class AlarmPlaybackService : Service() {
  companion object {
    const val ACTION_PLAY = "com.vibhutravelhub.shiftalarm.PLAY"
    const val ACTION_STOP = "com.vibhutravelhub.shiftalarm.STOP"
    private const val CHANNEL_ID = "yaal360-shift-alarm-native"
    private const val NOTIFICATION_ID = 74120
  }

  private var player: MediaPlayer? = null
  private var currentTitle = "Shift reminder"
  private var currentBody = "Your shift reminder is active."

  override fun onCreate() {
    super.onCreate()
    createChannel()
  }

  override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
    if (intent?.action == ACTION_STOP) {
      stopPlayback()
      return START_NOT_STICKY
    }

    if (intent?.action != ACTION_PLAY) {
      stopSelf()
      return START_NOT_STICKY
    }

    currentTitle = intent.getStringExtra("title") ?: "Shift reminder"
    currentBody = intent.getStringExtra("body") ?: "Your shift reminder is active."

    // Promote immediately so Android knows this is a foreground service.
    startForeground(NOTIFICATION_ID, buildNotification())

    if (player == null) {
      try {
        player = MediaPlayer.create(this, com.vibhutravelhub.shiftalarm.R.raw.shift_reminder_alarm)
        player?.isLooping = true
        player?.setOnErrorListener { mp, _, _ ->
          try { mp.release() } catch (_: Exception) {}
          player = null
          true
        }
        player?.start()
      } catch (_: Exception) {
        stopPlayback()
      }
    } else {
      val manager = getSystemService(NOTIFICATION_SERVICE) as NotificationManager
      manager.notify(NOTIFICATION_ID, buildNotification())
    }

    return START_NOT_STICKY
  }

  private fun buildNotification(): Notification {
    val stopIntent = Intent(this, AlarmPlaybackService::class.java).apply {
      action = ACTION_STOP
    }
    val stopPendingIntent = PendingIntent.getService(
      this,
      74121,
      stopIntent,
      PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
    )

    return NotificationCompat.Builder(this, CHANNEL_ID)
      .setSmallIcon(android.R.drawable.ic_lock_idle_alarm)
      .setContentTitle(currentTitle)
      .setContentText(currentBody)
      .setCategory(NotificationCompat.CATEGORY_ALARM)
      .setPriority(NotificationCompat.PRIORITY_MAX)
      .setOngoing(true)
      .setOnlyAlertOnce(true)
      .addAction(android.R.drawable.ic_media_pause, "Stop Alarm", stopPendingIntent)
      .build()
  }

  private fun createChannel() {
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
      val channel = NotificationChannel(
        CHANNEL_ID,
        "Yaal360 Shift Alarm",
        NotificationManager.IMPORTANCE_HIGH
      ).apply {
        description = "Ongoing shift alarms with a Stop action"
        setSound(null, null)
      }
      val manager = getSystemService(NOTIFICATION_SERVICE) as NotificationManager
      manager.createNotificationChannel(channel)
    }
  }

  private fun stopPlayback() {
    try {
      player?.stop()
    } catch (_: Exception) {}
    try {
      player?.release()
    } catch (_: Exception) {}
    player = null

    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) {
      stopForeground(STOP_FOREGROUND_REMOVE)
    } else {
      @Suppress("DEPRECATION")
      stopForeground(true)
    }

    (getSystemService(NOTIFICATION_SERVICE) as NotificationManager)
      .cancel(NOTIFICATION_ID)
    stopSelf()
  }

  override fun onDestroy() {
    try { player?.release() } catch (_: Exception) {}
    player = null
    super.onDestroy()
  }

  override fun onBind(intent: Intent?): IBinder? = null
}