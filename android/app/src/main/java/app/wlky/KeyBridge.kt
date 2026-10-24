package app.wlky

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.view.KeyEvent
import android.webkit.JavascriptInterface
import android.webkit.WebView
import androidx.core.content.ContextCompat
import org.json.JSONObject

/**
 * A hardware side button as PTT (rugged phones such as the AGM H6). Two routes, both only while the app is on screen:
 *  - the button sends a broadcast, like the Zello integration does (com.zello.ptt.down / .up) or the common
 *    android.intent.action.PTT.down / .up;
 *  - the button is an ordinary key: JS calls learn(), the next key press is remembered and used as PTT.
 * The page hears about it through walkieNative.onPtt(true|false) and onKeyLearned(code, name).
 */
class KeyBridge(private val activity: MainActivity, private val web: WebView) {

    private val prefs = activity.getSharedPreferences("keys", Context.MODE_PRIVATE)
    private var learning = false
    private var pressed = false

    private val pairs = listOf(
        "com.zello.ptt.down" to "com.zello.ptt.up",
        "android.intent.action.PTT.down" to "android.intent.action.PTT.up",
        "com.sonim.intent.action.PTT_KEY_DOWN" to "com.sonim.intent.action.PTT_KEY_UP",
    )

    private val receiver = object : BroadcastReceiver() {
        override fun onReceive(context: Context, intent: Intent) {
            val action = intent.action ?: return
            if (pairs.any { it.first == action }) press(true) else if (pairs.any { it.second == action }) press(false)
        }
    }

    fun register() {
        val filter = IntentFilter()
        for ((down, up) in pairs) { filter.addAction(down); filter.addAction(up) }
        ContextCompat.registerReceiver(activity, receiver, filter, ContextCompat.RECEIVER_EXPORTED)
    }

    fun unregister() {
        try { activity.unregisterReceiver(receiver) } catch (e: IllegalArgumentException) { }
        if (pressed) press(false) // never leave the microphone open
    }

    /** Called for every key event of the activity; true = handled here. */
    fun onKey(e: KeyEvent): Boolean {
        val code = e.keyCode
        if (code == KeyEvent.KEYCODE_BACK || code == KeyEvent.KEYCODE_HOME || code == KeyEvent.KEYCODE_APP_SWITCH || code == KeyEvent.KEYCODE_POWER) return false
        if (learning) {
            if (e.action == KeyEvent.ACTION_DOWN && e.repeatCount == 0) {
                learning = false
                prefs.edit().putInt("code", code).apply()
                emit("onKeyLearned(${JSONObject.quote(name(code))})")
            }
            return true
        }
        if (code != prefs.getInt("code", 0)) return false
        if (e.action == KeyEvent.ACTION_DOWN) { if (e.repeatCount == 0) press(true) }
        else if (e.action == KeyEvent.ACTION_UP) press(false)
        return true
    }

    private fun name(code: Int) = KeyEvent.keyCodeToString(code).removePrefix("KEYCODE_") + " ($code)"

    private fun press(on: Boolean) {
        if (on == pressed) return
        pressed = on
        emit("onPtt($on)")
    }

    @JavascriptInterface
    fun info(): String {
        val code = prefs.getInt("code", 0)
        return JSONObject().put("key", if (code == 0) "" else name(code)).toString()
    }

    @JavascriptInterface
    fun learn() { learning = true }

    @JavascriptInterface
    fun cancel() { learning = false }

    @JavascriptInterface
    fun clear() { learning = false; prefs.edit().remove("code").apply() }

    private fun emit(call: String) = activity.runOnUiThread {
        web.evaluateJavascript("window.walkieNative && walkieNative.$call", null)
    }
}
