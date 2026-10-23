package app.wlky

import android.os.Build
import android.webkit.JavascriptInterface
import android.webkit.WebView
import com.google.android.play.core.appupdate.AppUpdateInfo
import com.google.android.play.core.appupdate.AppUpdateManagerFactory
import com.google.android.play.core.appupdate.AppUpdateOptions
import com.google.android.play.core.install.model.AppUpdateType
import com.google.android.play.core.install.model.UpdateAvailability
import org.json.JSONObject

/**
 * Updating from inside the app. JS calls info() to learn the installed build and where it came from.
 * Installed from Google Play: playCheck() asks Play whether a newer version is out (answer via
 * walkieNative.onUpdatePlay) and playStart() opens Play's update screen.
 * Installed from an APK elsewhere: the page itself compares the build number with /api/update and opens the
 * APK link in the browser; Android then offers to install it over the old one (same signing key).
 */
class UpdateBridge(private val activity: MainActivity, private val web: WebView) {

    private val manager by lazy { AppUpdateManagerFactory.create(activity) }
    private var available: AppUpdateInfo? = null

    private fun installer(): String? = try {
        if (Build.VERSION.SDK_INT >= 30) activity.packageManager.getInstallSourceInfo(activity.packageName).installingPackageName
        else @Suppress("DEPRECATION") activity.packageManager.getInstallerPackageName(activity.packageName)
    } catch (e: Exception) { null }

    @JavascriptInterface
    fun info(): String {
        val pi = activity.packageManager.getPackageInfo(activity.packageName, 0)
        val code = if (Build.VERSION.SDK_INT >= 28) pi.longVersionCode else @Suppress("DEPRECATION") pi.versionCode.toLong()
        return JSONObject().put("code", code).put("name", pi.versionName ?: "").put("play", installer() == "com.android.vending").toString()
    }

    @JavascriptInterface
    fun playCheck() = activity.runOnUiThread {
        manager.appUpdateInfo
            .addOnSuccessListener { info ->
                val ok = info.updateAvailability() == UpdateAvailability.UPDATE_AVAILABLE && info.isUpdateTypeAllowed(AppUpdateType.IMMEDIATE)
                available = if (ok) info else null
                emit(ok)
            }
            .addOnFailureListener { emit(false) }
    }

    @JavascriptInterface
    fun playStart() = activity.runOnUiThread {
        val info = available ?: return@runOnUiThread
        manager.startUpdateFlowForResult(info, activity.updateLauncher, AppUpdateOptions.newBuilder(AppUpdateType.IMMEDIATE).build())
    }

    private fun emit(ok: Boolean) = activity.runOnUiThread {
        web.evaluateJavascript("window.walkieNative && walkieNative.onUpdatePlay($ok)", null)
    }
}
