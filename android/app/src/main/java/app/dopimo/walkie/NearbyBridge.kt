package app.dopimo.walkie

import android.util.Base64
import android.webkit.JavascriptInterface
import android.webkit.WebView
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
        val strategy = Strategy.P2P_CLUSTER // many-to-many, up to ~10 phones
        client.startAdvertising(endpointName(), SERVICE_ID, lifecycle, AdvertisingOptions.Builder().setStrategy(strategy).build())
            .addOnFailureListener { emit("onError", "'advertise'") }
        client.startDiscovery(SERVICE_ID, discovery, DiscoveryOptions.Builder().setStrategy(strategy).build())
            .addOnFailureListener { emit("onError", "'discover'") }
    }

    private fun stop() {
        client.stopAdvertising()
        client.stopDiscovery()
        client.stopAllEndpoints()
        synchronized(peers) { peers.clear() }
        room = null
        emitPeers()
    }

    private val discovery = object : EndpointDiscoveryCallback() {
        override fun onEndpointFound(endpointId: String, info: DiscoveredEndpointInfo) {
            // Both sides discover each other; only the one with the smaller id dials to avoid collisions.
            val other = info.endpointName.substringAfter(':', "")
            if (sameRoom(info.endpointName) && myId < other) client.requestConnection(endpointName(), endpointId, lifecycle)
        }

        override fun onEndpointLost(endpointId: String) {}
    }

    private val lifecycle = object : ConnectionLifecycleCallback() {
        override fun onConnectionInitiated(endpointId: String, info: ConnectionInfo) {
            if (sameRoom(info.endpointName)) client.acceptConnection(endpointId, payloads) else client.rejectConnection(endpointId)
        }

        override fun onConnectionResult(endpointId: String, result: ConnectionResolution) {
            if (result.status.isSuccess) {
                synchronized(peers) { peers += endpointId }
                emitPeers()
            }
        }

        override fun onDisconnected(endpointId: String) {
            synchronized(peers) { peers -= endpointId }
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
        const val SERVICE_ID = "app.dopimo.walkie"
    }
}
