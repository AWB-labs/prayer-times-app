package com.prayertimes.app

import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProvider
import android.content.Context
import android.widget.RemoteViews
import org.json.JSONObject

class NextPrayerWidget : AppWidgetProvider() {

    override fun onUpdate(
        context: Context,
        appWidgetManager: AppWidgetManager,
        appWidgetIds: IntArray
    ) {
        for (id in appWidgetIds) {
            updateWidget(context, appWidgetManager, id)
        }
    }

    companion object {
        fun updateWidget(context: Context, manager: AppWidgetManager, widgetId: Int) {
            val views = RemoteViews(context.packageName, R.layout.next_prayer_widget)

            val prefs = context.getSharedPreferences("widget_prayer_data", Context.MODE_PRIVATE)
            val json = prefs.getString("prayerData", null)

            if (json != null) {
                try {
                    val data = JSONObject(json)
                    val nextIndex = data.getInt("nextPrayerIndex")
                    val prayers = data.getJSONArray("prayers")
                    val prayer = prayers.getJSONObject(nextIndex)

                    val name = prayer.getString("name")
                    val arabic = prayer.getString("arabicName")
                    val time = prayer.getString("time")

                    views.setTextViewText(R.id.widget_prayer_name, name)
                    views.setTextViewText(R.id.widget_arabic_name, arabic)
                    views.setTextViewText(R.id.widget_prayer_time, formatTime(time))
                } catch (e: Exception) {
                    views.setTextViewText(R.id.widget_prayer_name, "—")
                    views.setTextViewText(R.id.widget_arabic_name, "")
                    views.setTextViewText(R.id.widget_prayer_time, "Open app")
                }
            } else {
                views.setTextViewText(R.id.widget_prayer_name, "—")
                views.setTextViewText(R.id.widget_arabic_name, "")
                views.setTextViewText(R.id.widget_prayer_time, "Open app")
            }

            manager.updateAppWidget(widgetId, views)
        }

        private fun formatTime(time24: String): String {
            val parts = time24.split(":").mapNotNull { it.toIntOrNull() }
            if (parts.size < 2) return time24
            val h = parts[0]; val m = parts[1]
            val period = if (h >= 12) "PM" else "AM"
            val h12 = if (h == 0) 12 else if (h > 12) h - 12 else h
            return "%d:%02d %s".format(h12, m, period)
        }
    }
}
