package app.dopimo.walkie

import android.Manifest
import android.content.Intent
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.webkit.PermissionRequest
import android.webkit.WebChromeClient
import android.webkit.WebResourceRequest
import android.webkit.WebResourceResponse
import android.webkit.WebView
import androidx.activity.ComponentActivity
import androidx.core.view.WindowCompat
import androidx.core.view.WindowInsetsCompat
import androidx.core.view.WindowInsetsControllerCompat
import androidx.activity.result.contract.ActivityResultContracts
import androidx.webkit.WebViewAssetLoader
import androidx.webkit.WebViewClientCompat

/** Hosts the bundled walkie web UI in a WebView and exposes offline (Nearby) transport to it. */
class MainActivity : ComponentActivity() {

    private lateinit var web: WebView
    private lateinit var nearby: NearbyBridge
    private var pendingWebPermission: PermissionRequest? = null
    private var nearbyCallback: ((Boolean) -> Unit)? = null

    private val webPermissions = registerForActivityResult(ActivityResultContracts.RequestMultiplePermissions()) { res ->
        pendingWebPermission?.let { if (res.values.all { ok -> ok }) it.grant(it.resources) else it.deny() }
        pendingWebPermission = null
    }

    private val nearbyPermissions = registerForActivityResult(ActivityResultContracts.RequestMultiplePermissions()) { res ->
        nearbyCallback?.invoke(res.values.all { it })
        nearbyCallback = null
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        val assets = WebViewAssetLoader.Builder()
            .addPathHandler("/assets/", WebViewAssetLoader.AssetsPathHandler(this))
            .build()

        web = WebView(this)
        setContentView(web)
        goFullscreen()
        web.settings.apply {
            javaScriptEnabled = true
            domStorageEnabled = true
            mediaPlaybackRequiresUserGesture = false
            // Only bundled assets are loaded; no file or content URLs.
            allowFileAccess = false
            allowContentAccess = false
        }
        web.webViewClient = object : WebViewClientCompat() {
            override fun shouldInterceptRequest(view: WebView, request: WebResourceRequest): WebResourceResponse? =
                assets.shouldInterceptRequest(request.url)

            override fun shouldOverrideUrlLoading(view: WebView, request: WebResourceRequest): Boolean {
                val url = request.url
                return when (url.host) {
                    ASSET_HOST -> false
                    INVITE_HOST -> { openInvite(url); true }
                    else -> { startActivity(Intent(Intent.ACTION_VIEW, url)); true }
                }
            }
        }
        web.webChromeClient = object : WebChromeClient() {
            // Microphone for talking, camera for scanning QR codes.
            override fun onPermissionRequest(request: PermissionRequest) {
                val needed = request.resources.mapNotNull {
                    when (it) {
                        PermissionRequest.RESOURCE_AUDIO_CAPTURE -> Manifest.permission.RECORD_AUDIO
                        PermissionRequest.RESOURCE_VIDEO_CAPTURE -> Manifest.permission.CAMERA
                        else -> null
                    }
                }.filter { checkSelfPermission(it) != PackageManager.PERMISSION_GRANTED }
                if (needed.isEmpty()) return request.grant(request.resources)
                pendingWebPermission = request
                webPermissions.launch(needed.toTypedArray())
            }
        }

        nearby = NearbyBridge(this, web)
        web.addJavascriptInterface(nearby, "WalkieNative")

        val invite = intent?.data
        if (invite?.host == INVITE_HOST) openInvite(invite) else web.loadUrl(START)
    }

    // Same look as the installed web app (display: fullscreen): no status or navigation bar.
    private fun goFullscreen() {
        WindowCompat.setDecorFitsSystemWindows(window, false)
        WindowInsetsControllerCompat(window, web).apply {
            hide(WindowInsetsCompat.Type.systemBars())
            systemBarsBehavior = WindowInsetsControllerCompat.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE
        }
    }

    override fun onWindowFocusChanged(hasFocus: Boolean) {
        super.onWindowFocusChanged(hasFocus)
        if (hasFocus) goFullscreen()
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        intent.data?.takeIf { it.host == INVITE_HOST }?.let(::openInvite)
    }

    /** Invite links look like https://walkie.dopimo.app/#join=...; the web UI reads the fragment. */
    private fun openInvite(url: Uri) {
        web.loadUrl(START + (url.fragment?.let { "#$it" } ?: ""))
    }

    fun requestNearbyPermissions(done: (Boolean) -> Unit) {
        val needed = buildList {
            if (Build.VERSION.SDK_INT >= 31) {
                add(Manifest.permission.BLUETOOTH_SCAN)
                add(Manifest.permission.BLUETOOTH_ADVERTISE)
                add(Manifest.permission.BLUETOOTH_CONNECT)
            }
            if (Build.VERSION.SDK_INT >= 33) add(Manifest.permission.NEARBY_WIFI_DEVICES)
            if (Build.VERSION.SDK_INT <= 32) add(Manifest.permission.ACCESS_FINE_LOCATION)
        }.filter { checkSelfPermission(it) != PackageManager.PERMISSION_GRANTED }
        if (needed.isEmpty()) return done(true)
        nearbyCallback = done
        nearbyPermissions.launch(needed.toTypedArray())
    }

    override fun onDestroy() {
        nearby.shutdown()
        web.destroy()
        super.onDestroy()
    }

    companion object {
        const val ASSET_HOST = "appassets.androidplatform.net"
        const val INVITE_HOST = "walkie.dopimo.app"
        const val START = "https://$ASSET_HOST/assets/www/index.html"
    }
}
