package app.wlky

import android.app.Notification
import android.app.PendingIntent
import android.app.Service
import android.content.Intent
import android.content.pm.ServiceInfo
import android.graphics.drawable.Icon
import android.os.Build
import android.os.IBinder
import android.os.PowerManager

/**
 * Keeps WLKY alive in the background while "Meldingen" is on: a permanent quiet notification ("WLKY luistert") with a
 * Stop button. The channels themselves are held by the WebView in the app process; this only stops Android from
 * ending that process. A partial wake lock keeps the connections going with the screen off (this costs battery).
 */
class ListenService : Service() {
    private var wake: PowerManager.WakeLock? = null

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        val prefs = Notif.prefs(this)
        if (intent?.action == STOP) {
            prefs.edit().putBoolean("on", false).apply()
            stopForeground(STOP_FOREGROUND_REMOVE)
            stopSelf()
            return START_NOT_STICKY
        }
        Notif.channels(this)
        val stop = PendingIntent.getService(this, 1, Intent(this, ListenService::class.java).setAction(STOP), PendingIntent.FLAG_IMMUTABLE)
        val note = Notification.Builder(this, Notif.LISTEN)
            .setSmallIcon(R.drawable.ic_stat)
            .setContentTitle(prefs.getString("title", "WLKY luistert"))
            .setContentText(prefs.getString("text", "Tik om te openen"))
            .setContentIntent(Notif.openApp(this))
            .setOngoing(true)
            .addAction(Notification.Action.Builder(Icon.createWithResource(this, R.drawable.ic_stat), prefs.getString("stop", "Stoppen"), stop).build())
            .build()
        if (Build.VERSION.SDK_INT >= 34) startForeground(1, note, ServiceInfo.FOREGROUND_SERVICE_TYPE_SPECIAL_USE) else startForeground(1, note)
        if (wake == null) {
            wake = getSystemService(PowerManager::class.java).newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "wlky:listen").apply { acquire() }
        }
        return START_STICKY
    }

    override fun onDestroy() {
        wake?.takeIf { it.isHeld }?.release()
        wake = null
        super.onDestroy()
    }

    companion object { const val STOP = "app.wlky.STOP" }
}
