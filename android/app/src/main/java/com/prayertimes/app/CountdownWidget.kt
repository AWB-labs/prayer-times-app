package com.prayertimes.app

import android.app.AlarmManager
import android.app.PendingIntent
import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProvider
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.os.Build
import android.widget.RemoteViews
import org.json.JSONObject

class CountdownWidget : AppWidgetProvider() {

    override fun onUpdate(
        context: Context,
        appWidgetManager: AppWidgetManager,
        appWidgetIds: IntArray
    ) {
        for (id in appWidgetIds) {
            updateWidget(context, appWidgetManager, id)
        }
        scheduleNextMinuteTick(context)
    }

    override fun onReceive(context: Context, intent: Intent) {
        super.onReceive(context, intent)
        // Handle the per-minute alarm tick
        if (intent.action == ACTION_TICK) {
            val manager = AppWidgetManager.getInstance(context)
            val ids = manager.getAppWidgetIds(
                ComponentName(context, CountdownWidget::class.java)
            )
            for (id in ids) {
                updateWidget(context, manager, id)
            }
            // Reschedule next tick only if widgets are still active
            if (ids.isNotEmpty()) {
                scheduleNextMinuteTick(context)
            }
        }
    }

    override fun onDisabled(context: Context) {
        cancelTick(context)
    }

    companion object {
        const val ACTION_TICK = "com.prayertimes.app.COUNTDOWN_TICK"

        fun updateWidget(context: Context, manager: AppWidgetManager, widgetId: Int) {
            val views = RemoteViews(context.packageName, R.layout.countdown_widget)

            val prefs = context.getSharedPreferences("widget_prayer_data", Context.MODE_PRIVATE)
            val json = prefs.getString("prayerData", null)

            if (json != null) {
                try {
                    val data = JSONObject(json)
                    val nextIndex = data.getInt("nextPrayerIndex")
                    val prayers = data.getJSONArray("prayers")
                    val prayer = prayers.getJSONObject(nextIndex)
                    val name = prayer.getString("name")
                    val nextTimestamp = data.getLong("nextPrayerTimestamp")

                    val nowSec = System.currentTimeMillis() / 1000
                    val remaining = maxOf(0L, nextTimestamp - nowSec)
                    val h = remaining / 3600
                    val m = (remaining % 3600) / 60

                    val countdownText = if (h > 0) "%dh %02dm".format(h, m) else "%dm".format(m)

                    views.setTextViewText(R.id.countdown_prayer_name, name)
                    views.setTextViewText(R.id.countdown_time, countdownText)
                } catch (e: Exception) {
                    views.setTextViewText(R.id.countdown_prayer_name, "—")
                    views.setTextViewText(R.id.countdown_time, "Open app")
                }
            } else {
                views.setTextViewText(R.id.countdown_prayer_name, "—")
                views.setTextViewText(R.id.countdown_time, "Open app")
            }

            manager.updateAppWidget(widgetId, views)
        }

        fun scheduleNextMinuteTick(context: Context) {
            val alarmManager = context.getSystemService(Context.ALARM_SERVICE) as AlarmManager
            val intent = PendingIntent.getBroadcast(
                context, 0,
                Intent(context, CountdownWidget::class.java).apply { action = ACTION_TICK },
                PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
            )
            val triggerAt = System.currentTimeMillis() + 60_000L
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S &&
                !alarmManager.canScheduleExactAlarms()
            ) {
                // Fallback: inexact alarm if exact alarm permission not granted
                alarmManager.set(AlarmManager.RTC, triggerAt, intent)
            } else {
                alarmManager.setExact(AlarmManager.RTC, triggerAt, intent)
            }
        }

        fun cancelTick(context: Context) {
            val alarmManager = context.getSystemService(Context.ALARM_SERVICE) as AlarmManager
            val intent = PendingIntent.getBroadcast(
                context, 0,
                Intent(context, CountdownWidget::class.java).apply { action = ACTION_TICK },
                PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
            )
            alarmManager.cancel(intent)
        }
    }
}
