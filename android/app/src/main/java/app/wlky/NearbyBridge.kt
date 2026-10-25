package app.wlky

import android.location.LocationManager
import android.os.Build
import android.os.Handler
import android.os.Looper
import android.util.Base64
import android.webkit.JavascriptInterface
import android.webkit.WebView
import com.google.android.gms.common.ConnectionResult
import com.google.android.gms.common.GoogleApiAvailability
import com.google.android.gms.common.api.ApiException
import com.google.android.gms.nearby.Nearby
import com.google.android.gms.nearby.connection.AdvertisingOptions
import com.google.android.gms.nearby.connection.ConnectionInfo
import com.google.android.gms.nearby.connection.ConnectionLifecycleCallback
import com.google.android.gms.nearby.connection.ConnectionResolution
import com.google.android.gms.nearby.connection.DiscoveredEndpointInfo
import com.google.android.gms.nearby.connection.DiscoveryOptions
import com.google.android.gms.nearby.connection.EndpointDiscoveryCallback
import com.google.android.gms.nearby.connection.Payload
import com.google.android.gms.nearby.connection.PayloadCallback
import com.google.android.gms.nearby.connection.PayloadTransferUpdate
import com.google.android.gms.nearby.connection.Strategy
import java.util.UUID

/**
 * Offline transport for the web UI: phones on the same channel find each other over Bluetooth / wifi
 * (Google Nearby Connections, no internet) and exchange the already-encrypted frames from the page.
 *
 * Endpoint names are "<room prefix>:<random id>" so only phones on the same channel connect.
 * JS calls join/leave/send; results come back via window.walkieNative.onPeers/onData/onError.
 */
class NearbyBridge(private val activity: MainActivity, private val web: WebView) {

    private val client = Nearby.getConnectionsClient(activity)
    private val myId = UUID.randomUUID().toString().take(8)
    private val peers = mutableSetOf<String>()
    private var room: String? = null
    private val handler = Handler(Looper.getMainLooper())
    private val asked = mutableSetOf<String>() // endpoints we already asked to connect to

    private fun endpointName() = "${room!!.take(16)}:$myId"
    private fun sameRoom(name: String) = room != null && name.substringBefore(':') == room!!.take(16)

    @JavascriptInterface
    fun join(newRoom: String) = activity.runOnUiThread {
        activity.requestNearbyPermissions { ok -> if (ok) start(newRoom) else emit("onError", "'perm'") }
    }

    @JavascriptInterface
    fun leave() = activity.runOnUiThread { stop() }

    @JavascriptInterface
    fun send(b64: String) {
        val bytes = Base64.decode(b64, Base64.NO_WRAP)
        val to = synchronized(peers) { peers.toList() }
        if (to.isNotEmpty()) client.sendPayload(to, Payload.fromBytes(bytes))
    }

    fun shutdown() = stop()

    private fun start(newRoom: String) {
        stop()
        room = newRoom
        // Nearby needs Google Play services, and (before Android 13) location switched on for Bluetooth discovery.
        if (GoogleApiAvailability.getInstance().isGooglePlayServicesAvailable(activity) != ConnectionResult.SUCCESS) emit("onError", "'gms'")
        if (Build.VERSION.SDK_INT >= 28 && !activity.getSystemService(LocationManager::class.java).isLocationEnabled) emit("onError", "'location'")
        val strategy = Strategy.P2P_CLUSTER // many-to-many, up to ~10 phones
        client.startAdvertising(endpointName(), SERVICE_ID, lifecycle, AdvertisingOptions.Builder().setStrategy(strategy).build())
            .addOnFailureListener { failed("advertise", it) }
        client.startDiscovery(SERVICE_ID, discovery, DiscoveryOptions.Builder().setStrategy(strategy).build())
            .addOnFailureListener { failed("discover", it) }
    }

    // "Already advertising/discovering" (8001, 8002) is fine; any other code goes to the page, so it can say what is wrong.
    private fun failed(what: String, e: Exception) {
        val code = (e as? ApiException)?.statusCode ?: -1
        if (code == 8001 || code == 8002) return
        emit("onError", "'$what:$code'")
    }

    private fun stop() {
        client.stopAdvertising()
        client.stopDiscovery()
        client.stopAllEndpoints()
        handler.removeCallbacksAndMessages(null)
        asked.clear()
        synchronized(peers) { peers.clear() }
        room = null
        emitPeers()
    }

    private val discovery = object : EndpointDiscoveryCallback() {
        override fun onEndpointFound(endpointId: String, info: DiscoveredEndpointInfo) {
            // Both sides discover each other. The smaller id dials at once; the other one waits a moment and dials too if
            // nothing happened (discovery is not always symmetrical), so the two phones always end up connected.
            val other = info.endpointName.substringAfter(':', "")
            if (!sameRoom(info.endpointName)) return
            val delay = if (myId < other) 0L else 3000L
            handler.postDelayed({ dial(endpointId) }, delay)
        }

        override fun onEndpointLost(endpointId: String) { asked -= endpointId }
    }

    private fun dial(endpointId: String) {
        if (room == null || endpointId in asked || synchronized(peers) { endpointId in peers }) return
        asked += endpointId
        client.requestConnection(endpointName(), endpointId, lifecycle).addOnFailureListener { e ->
            asked -= endpointId // may be tried again when the endpoint is found again
            val code = (e as? ApiException)?.statusCode ?: -1
            if (code != 8003 && code != 8012) emit("onError", "'connect:$code'")
        }
    }

    private val lifecycle = object : ConnectionLifecycleCallback() {
        override fun onConnectionInitiated(endpointId: String, info: ConnectionInfo) {
            if (sameRoom(info.endpointName)) client.acceptConnection(endpointId, payloads) else client.rejectConnection(endpointId)
        }

        override fun onConnectionResult(endpointId: String, result: ConnectionResolution) {
            if (result.status.isSuccess) {
                synchronized(peers) { peers += endpointId }
                emitPeers()
            } else asked -= endpointId
        }

        override fun onDisconnected(endpointId: String) {
            synchronized(peers) { peers -= endpointId }
            asked -= endpointId
            emitPeers()
        }
    }

    private val payloads = object : PayloadCallback() {
        override fun onPayloadReceived(endpointId: String, payload: Payload) {
            payload.asBytes()?.let { emit("onData", "'${Base64.encodeToString(it, Base64.NO_WRAP)}'") }
        }

        override fun onPayloadTransferUpdate(endpointId: String, update: PayloadTransferUpdate) {}
    }

    private fun emitPeers() = emit("onPeers", synchronized(peers) { peers.size }.toString())

    private fun emit(fn: String, arg: String) = activity.runOnUiThread {
        web.evaluateJavascript("window.walkieNative && walkieNative.$fn($arg)", null)
    }

    companion object {
        const val SERVICE_ID = "app.wlky"
    }
}
