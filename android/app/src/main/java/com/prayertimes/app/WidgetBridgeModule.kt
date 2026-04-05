package com.prayertimes.app

import android.appwidget.AppWidgetManager
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import com.facebook.react.bridge.*

class WidgetBridgeModule(reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    override fun getName(): String = "WidgetBridge"

    @ReactMethod
    fun setPrayerData(data: ReadableMap, promise: Promise) {
        try {
            val json = readableMapToJson(data)
            val prefs = reactApplicationContext.getSharedPreferences(
                "widget_prayer_data", Context.MODE_PRIVATE
            )
            prefs.edit().putString("prayerData", json).apply()
            broadcastWidgetUpdate()
            promise.resolve(null)
        } catch (e: Exception) {
            promise.reject("WIDGET_BRIDGE_ERROR", e.message)
        }
    }

    @ReactMethod
    fun reloadAllTimelines(promise: Promise) {
        // No-op on Android — broadcastWidgetUpdate handles updates
        promise.resolve(null)
    }

    private fun broadcastWidgetUpdate() {
        val ctx = reactApplicationContext

        // Update NextPrayerWidget
        val nextIntent = Intent(ctx, NextPrayerWidget::class.java).apply {
            action = AppWidgetManager.ACTION_APPWIDGET_UPDATE
            val ids = AppWidgetManager.getInstance(ctx)
                .getAppWidgetIds(ComponentName(ctx, NextPrayerWidget::class.java))
            putExtra(AppWidgetManager.EXTRA_APPWIDGET_IDS, ids)
        }
        ctx.sendBroadcast(nextIntent)

        // Update CountdownWidget
        val countdownIntent = Intent(ctx, CountdownWidget::class.java).apply {
            action = AppWidgetManager.ACTION_APPWIDGET_UPDATE
            val ids = AppWidgetManager.getInstance(ctx)
                .getAppWidgetIds(ComponentName(ctx, CountdownWidget::class.java))
            putExtra(AppWidgetManager.EXTRA_APPWIDGET_IDS, ids)
        }
        ctx.sendBroadcast(countdownIntent)
    }

    private fun readableMapToJson(map: ReadableMap): String {
        val gson = com.google.gson.Gson()
        val javaMap = map.toHashMap()
        return gson.toJson(javaMap)
    }
}
