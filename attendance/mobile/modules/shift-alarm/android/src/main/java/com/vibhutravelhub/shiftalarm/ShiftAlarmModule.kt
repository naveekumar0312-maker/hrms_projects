package com.vibhutravelhub.shiftalarm

import android.app.AlarmManager
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.provider.Settings
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import org.json.JSONArray
import org.json.JSONObject

class ShiftAlarmModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("ShiftAlarm")

    Function("canScheduleExactAlarms") {
      val context = appContext.reactContext
        ?: throw IllegalStateException("Android context is unavailable")

      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
        val manager = context.getSystemService(Context.ALARM_SERVICE) as AlarmManager
        manager.canScheduleExactAlarms()
      } else {
        true
      }
    }

    Function("openExactAlarmSettings") {
      val context = appContext.reactContext
        ?: throw IllegalStateException("Android context is unavailable")

      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
        val intent = Intent(Settings.ACTION_REQUEST_SCHEDULE_EXACT_ALARM).apply {
          data = Uri.parse("package:${context.packageName}")
          addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        }
        context.startActivity(intent)
      }
    }

    Function("scheduleAlarms") { items: List<Map<String, Any?>> ->
      val context = appContext.reactContext
        ?: throw IllegalStateException("Android context is unavailable")

      val array = JSONArray()
      items.forEach { item ->
        val json = JSONObject()
        json.put("id", item["id"]?.toString() ?: "")
        json.put("timestamp", (item["timestamp"] as? Number)?.toLong() ?: 0L)
        json.put("event", item["event"]?.toString() ?: "SHIFT_START")
        json.put("shiftName", item["shiftName"]?.toString() ?: "Your shift")
        json.put("title", item["title"]?.toString() ?: "Shift reminder")
        json.put("body", item["body"]?.toString() ?: "")
        array.put(json)
      }

      AlarmScheduler.saveAndSchedule(context, array)
    }

    Function("cancelAlarms") {
      val context = appContext.reactContext
        ?: throw IllegalStateException("Android context is unavailable")
      AlarmScheduler.cancelAll(context)
    }

    Function("stopAlarm") {
      val context = appContext.reactContext
        ?: throw IllegalStateException("Android context is unavailable")
      context.startService(
        Intent(context, AlarmPlaybackService::class.java)
          .setAction(AlarmPlaybackService.ACTION_STOP)
      )
    }
  }
}

internal object AlarmScheduler {
  private const val PREFS = "yaal360_shift_alarm"
  private const val KEY_ITEMS = "scheduled_items"

  fun saveAndSchedule(context: Context, items: JSONArray) {
    cancelPending(context)
    context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
      .edit().putString(KEY_ITEMS, items.toString()).apply()
    scheduleFuture(context, items)
  }

  fun cancelAll(context: Context) {
    cancelPending(context)
    context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
      .edit().remove(KEY_ITEMS).apply()
    context.startService(
      Intent(context, AlarmPlaybackService::class.java)
        .setAction(AlarmPlaybackService.ACTION_STOP)
    )
  }

  fun rescheduleSaved(context: Context) {
    val raw = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
      .getString(KEY_ITEMS, null) ?: return
    try {
      scheduleFuture(context, JSONArray(raw))
    } catch (_: Exception) {
      // Ignore invalid or outdated saved data.
    }
  }

  private fun alarmManager(context: Context) =
    context.getSystemService(Context.ALARM_SERVICE) as AlarmManager

  private fun pendingIntent(
    context: Context,
    item: JSONObject
  ): android.app.PendingIntent {
    val id = item.optString("id", "")
    val requestCode = id.hashCode()
    val intent = Intent(context, AlarmReceiver::class.java).apply {
      action = "com.vibhutravelhub.shiftalarm.ALARM.$requestCode"
      putExtra("id", id)
      putExtra("event", item.optString("event", "SHIFT_START"))
      putExtra("shiftName", item.optString("shiftName", "Your shift"))
      putExtra("title", item.optString("title", "Shift reminder"))
      putExtra("body", item.optString("body", ""))
    }

    return android.app.PendingIntent.getBroadcast(
      context,
      requestCode,
      intent,
      android.app.PendingIntent.FLAG_UPDATE_CURRENT or
        android.app.PendingIntent.FLAG_IMMUTABLE
    )
  }

  private fun cancelPending(context: Context) {
    val prefs = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
    val raw = prefs.getString(KEY_ITEMS, null) ?: return

    try {
      val items = JSONArray(raw)
      for (i in 0 until items.length()) {
        val item = items.optJSONObject(i) ?: continue
        alarmManager(context).cancel(pendingIntent(context, item))
      }
    } catch (_: Exception) {
      // Ignore invalid saved data.
    }
  }

  private fun scheduleFuture(context: Context, items: JSONArray) {
    val manager = alarmManager(context)

    for (i in 0 until items.length()) {
      val item = items.optJSONObject(i) ?: continue
      val timestamp = item.optLong("timestamp", 0L)
      if (timestamp <= System.currentTimeMillis()) continue

      val operation = pendingIntent(context, item)

      try {
        if (
          Build.VERSION.SDK_INT >= Build.VERSION_CODES.S &&
          manager.canScheduleExactAlarms()
        ) {
          manager.setExactAndAllowWhileIdle(
            AlarmManager.RTC_WAKEUP,
            timestamp,
            operation
          )
        } else {
          manager.setAndAllowWhileIdle(
            AlarmManager.RTC_WAKEUP,
            timestamp,
            operation
          )
        }
      } catch (_: SecurityException) {
        manager.setAndAllowWhileIdle(
          AlarmManager.RTC_WAKEUP,
          timestamp,
          operation
        )
      }
    }
  }
}
