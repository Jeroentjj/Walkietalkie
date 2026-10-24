package app.wlky.sidekey

import android.Manifest
import android.annotation.SuppressLint
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.hardware.camera2.CameraCharacteristics
import android.hardware.camera2.CameraManager
import android.location.Location
import android.location.LocationManager
import android.media.AudioManager
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.provider.MediaStore
import android.widget.Toast
import androidx.activity.ComponentActivity
import androidx.activity.result.contract.ActivityResultContracts

/**
 * One action per class. Each is a see-through activity (Theme.Action) with its own launcher entry, so the phone's
 * "Open the app" list shows them separately. They do their job in go() and close at once.
 */
abstract class Act : ComponentActivity() {
    protected val prefs by lazy { getSharedPreferences("side", Context.MODE_PRIVATE) }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        @Suppress("DEPRECATION") overridePendingTransition(0, 0)
        go()
    }

    protected abstract fun go()

    protected fun say(text: String) = Toast.makeText(this, text, Toast.LENGTH_SHORT).show()

    override fun finish() {
        super.finish()
        @Suppress("DEPRECATION") overridePendingTransition(0, 0)
    }
}

class TorchAct : Act() {
    override fun go() {
        val cm = getSystemService(CameraManager::class.java)
        val id = cm.cameraIdList.firstOrNull { cm.getCameraCharacteristics(it).get(CameraCharacteristics.FLASH_INFO_AVAILABLE) == true }
        if (id == null) { say(getString(R.string.no_torch)); return finish() }
        var done = false
        val callback = object : CameraManager.TorchCallback() {
            // Called at once with the current state, so we always flip what is really happening.
            override fun onTorchModeChanged(cameraId: String, enabled: Boolean) {
                if (cameraId != id || done) return
                done = true
                cm.unregisterTorchCallback(this)
                try { cm.setTorchMode(id, !enabled) } catch (e: Exception) { say(getString(R.string.no_torch)) }
                finish()
            }
        }
        val handler = Handler(Looper.getMainLooper())
        cm.registerTorchCallback(callback, handler)
        handler.postDelayed({ if (!done) { done = true; cm.unregisterTorchCallback(callback); finish() } }, 2000)
    }
}

class SoundAct : Act() {
    override fun go() {
        val am = getSystemService(AudioManager::class.java)
        val normal = am.ringerMode == AudioManager.RINGER_MODE_NORMAL
        try {
            am.ringerMode = if (normal) AudioManager.RINGER_MODE_VIBRATE else AudioManager.RINGER_MODE_NORMAL
            say(getString(if (normal) R.string.sound_vibrate else R.string.sound_normal))
        } catch (e: SecurityException) { say(getString(R.string.sound_fail)) }
        finish()
    }
}

class CameraAct : Act() {
    override fun go() {
        try { startActivity(Intent(MediaStore.INTENT_ACTION_STILL_IMAGE_CAMERA).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)) } catch (e: Exception) { }
        finish()
    }
}

class AssistAct : Act() {
    override fun go() {
        try { startActivity(Intent(Intent.ACTION_VOICE_COMMAND).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)) }
        catch (e: Exception) {
            try { startActivity(Intent(Intent.ACTION_ASSIST).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)) } catch (e2: Exception) { say(getString(R.string.no_assistant)) }
        }
        finish()
    }
}

class CallAct : Act() {
    private val ask = registerForActivityResult(ActivityResultContracts.RequestPermission()) { ok -> dial(ok) }

    override fun go() {
        if (prefs.getString("number", "").isNullOrBlank()) {
            say(getString(R.string.set_number))
            startActivity(Intent(this, MainActivity::class.java))
            return finish()
        }
        if (checkSelfPermission(Manifest.permission.CALL_PHONE) == PackageManager.PERMISSION_GRANTED) dial(true) else ask.launch(Manifest.permission.CALL_PHONE)
    }

    @SuppressLint("MissingPermission")
    private fun dial(call: Boolean) {
        val uri = Uri.fromParts("tel", prefs.getString("number", "")!!.trim(), null)
        try { startActivity(Intent(if (call) Intent.ACTION_CALL else Intent.ACTION_DIAL, uri).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)) } catch (e: Exception) { }
        finish()
    }
}

class LocationAct : Act() {
    private val ask = registerForActivityResult(ActivityResultContracts.RequestPermission()) { ok ->
        if (ok) share() else { say(getString(R.string.need_location)); finish() }
    }

    override fun go() {
        if (checkSelfPermission(Manifest.permission.ACCESS_FINE_LOCATION) == PackageManager.PERMISSION_GRANTED) share() else ask.launch(Manifest.permission.ACCESS_FINE_LOCATION)
    }

    @SuppressLint("MissingPermission")
    private fun share() {
        val lm = getSystemService(LocationManager::class.java)
        val last = lm.getProviders(true).mapNotNull { lm.getLastKnownLocation(it) }.maxByOrNull { it.time }
        if (last != null && System.currentTimeMillis() - last.time < 120_000) return send(last)
        say(getString(R.string.locating))
        if (Build.VERSION.SDK_INT >= 30) {
            val provider = if (lm.isProviderEnabled(LocationManager.GPS_PROVIDER)) LocationManager.GPS_PROVIDER else LocationManager.NETWORK_PROVIDER
            lm.getCurrentLocation(provider, null, mainExecutor) { loc -> send(loc ?: last) }
        } else send(last)
    }

    private fun send(loc: Location?) {
        if (loc == null) { say(getString(R.string.no_location)); return finish() }
        val url = "https://maps.google.com/?q=${loc.latitude},${loc.longitude}"
        val text = Intent(Intent.ACTION_SEND).setType("text/plain").putExtra(Intent.EXTRA_TEXT, getString(R.string.my_location, url))
        startActivity(Intent.createChooser(text, null).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
        finish()
    }
}

/** For "long press": nothing while WLKY is on screen (so holding PTT stays PTT), otherwise the app chosen in the settings. */
class SmartAct : Act() {
    override fun go() {
        val wlkyOpen = try {
            contentResolver.query(Uri.parse("content://app.wlky.state/fg"), null, null, null, null)?.use { it.moveToFirst() && it.getInt(0) == 1 } ?: false
        } catch (e: Exception) { false }
        if (!wlkyOpen) {
            val pkg = prefs.getString("fallback", "") ?: ""
            if (pkg.isNotEmpty()) packageManager.getLaunchIntentForPackage(pkg)?.let { startActivity(it.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)) }
        }
        finish()
    }
}
