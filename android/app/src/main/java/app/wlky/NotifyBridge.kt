package app.wlky

import android.Manifest
import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.media.AudioAttributes
import android.media.RingtoneManager
import android.os.Build
import android.provider.Settings
import android.webkit.JavascriptInterface
import android.webkit.WebView
import androidx.core.content.ContextCompat
import org.json.JSONObject

/** Notification channels and the small things the service and the bridge share. */
object Notif {
    const val LISTEN = "listen"
    const val CALLS = "calls"
    const val MESSAGES = "messages"
    const val ID_CALL = 2
    const val ID_MSG = 3

    fun prefs(c: Context) = c.getSharedPreferences("notify", Context.MODE_PRIVATE)

    fun hasPermission(c: Context) =
        Build.VERSION.SDK_INT < 33 || c.checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) == PackageManager.PERMISSION_GRANTED

    fun channels(c: Context) {
        val nm = c.getSystemService(NotificationManager::class.java)
        nm.createNotificationChannel(NotificationChannel(LISTEN, "WLKY luistert", NotificationManager.IMPORTANCE_LOW))
        nm.createNotificationChannel(NotificationChannel(CALLS, "Oproepen", NotificationManager.IMPORTANCE_HIGH).apply {
            setSound(
                RingtoneManager.getDefaultUri(RingtoneManager.TYPE_RINGTONE),
                AudioAttributes.Builder().setUsage(AudioAttributes.USAGE_NOTIFICATION_RINGTONE).setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION).build(),
            )
            enableVibration(true)
            vibrationPattern = longArrayOf(0, 400, 150, 400, 150, 400, 150, 400)
        })
        nm.createNotificationChannel(NotificationChannel(MESSAGES, "Berichten", NotificationManager.IMPORTANCE_HIGH))
    }

    fun openApp(c: Context): PendingIntent = PendingIntent.getActivity(
        c, 0,
        Intent(c, MainActivity::class.java).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_SINGLE_TOP),
        PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT,
    )
}

/**
 * Notifications for the web UI (window.WalkieNotify). With "Meldingen" on, ListenService keeps WLKY running in the
 * background, so calls and chat messages that arrive while the screen is off still reach the phone.
 * JS calls status(), setEnabled(on, ...) and show(kind, title, text, hiddenText), batterySettings();
 * the answer to setEnabled comes back as walkieNative.onNotify(on).
 */
class NotifyBridge(private val activity: MainActivity, private val web: WebView) {
    private val prefs = Notif.prefs(activity)

    @JavascriptInterface
    fun status(): String = JSONObject()
        .put("on", prefs.getBoolean("on", false) && Notif.hasPermission(activity))
        .put("perm", Notif.hasPermission(activity)).toString()

    @JavascriptInterface
    fun setEnabled(on: Boolean, title: String, text: String, stop: String) = activity.runOnUiThread {
        prefs.edit().putString("title", title).putString("text", text).putString("stop", stop).apply()
        if (!on) {
            prefs.edit().putBoolean("on", false).apply()
            activity.stopService(Intent(activity, ListenService::class.java))
            return@runOnUiThread emit(false)
        }
        if (Notif.hasPermission(activity)) turnOn() else activity.askNotifyPermission { ok -> if (ok) turnOn() else emit(false) }
    }

    private fun turnOn() {
        prefs.edit().putBoolean("on", true).apply()
        startService()
        emit(true)
    }

    private fun startService() = ContextCompat.startForegroundService(activity, Intent(activity, ListenService::class.java))

    /** Called when the app starts: bring the background listening back if it was on. */
    fun resume() {
        if (prefs.getBoolean("on", false) && Notif.hasPermission(activity)) startService()
    }

    /** A call or message from the page; only shown when WLKY is not on screen. */
    @JavascriptInterface
    fun show(kind: String, title: String, text: String, hidden: String) {
        if (Foreground.started || !Notif.hasPermission(activity)) return
        Notif.channels(activity)
        val call = kind == "call"
        val channel = if (call) Notif.CALLS else Notif.MESSAGES
        // On the lock screen only the general line is visible, not the message itself.
        val publicVersion = Notification.Builder(activity, channel).setSmallIcon(R.drawable.ic_stat).setContentTitle(title).setContentText(hidden).build()
        val n = Notification.Builder(activity, channel)
            .setSmallIcon(R.drawable.ic_stat)
            .setContentTitle(title)
            .setContentText(text)
            .setStyle(Notification.BigTextStyle().bigText(text))
            .setContentIntent(Notif.openApp(activity))
            .setAutoCancel(true)
            .setVisibility(Notification.VISIBILITY_PRIVATE)
            .setPublicVersion(publicVersion)
            .setCategory(if (call) Notification.CATEGORY_CALL else Notification.CATEGORY_MESSAGE)
            .apply { if (call) setTimeoutAfter(60_000) }
            .build()
        activity.getSystemService(NotificationManager::class.java).notify(if (call) Notif.ID_CALL else Notif.ID_MSG, n)
    }

    /** The system screen where WLKY can be set to "unrestricted", so the phone does not put it to sleep. */
    @JavascriptInterface
    fun batterySettings() = activity.runOnUiThread {
        try { activity.startActivity(Intent(Settings.ACTION_IGNORE_BATTERY_OPTIMIZATION_SETTINGS)) } catch (e: Exception) { }
    }

    private fun emit(on: Boolean) = activity.runOnUiThread {
        web.evaluateJavascript("window.walkieNative && walkieNative.onNotify($on)", null)
    }
}
