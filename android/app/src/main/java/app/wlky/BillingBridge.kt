package app.wlky

import android.webkit.JavascriptInterface
import android.webkit.WebView
import com.android.billingclient.api.BillingClient
import com.android.billingclient.api.BillingClient.BillingResponseCode
import com.android.billingclient.api.BillingClient.ProductType
import com.android.billingclient.api.BillingClientStateListener
import com.android.billingclient.api.BillingFlowParams
import com.android.billingclient.api.BillingResult
import com.android.billingclient.api.PendingPurchasesParams
import com.android.billingclient.api.ProductDetails
import com.android.billingclient.api.Purchase
import com.android.billingclient.api.PurchasesUpdatedListener
import com.android.billingclient.api.QueryProductDetailsParams
import com.android.billingclient.api.QueryPurchasesParams
import org.json.JSONArray
import org.json.JSONObject

/**
 * Google Play purchases of the paid versions (one-time products wlky_plus / wlky_pro) for the web UI.
 * JS calls refresh() and buy(id); results come back via window.walkieNative.onProducts / onPurchase / onBillingError.
 * The server verifies and acknowledges each purchase (src/license.js), so nothing is trusted on the phone.
 */
class BillingBridge(private val activity: MainActivity, private val web: WebView) : PurchasesUpdatedListener {

    private val client = BillingClient.newBuilder(activity)
        .setListener(this)
        .enablePendingPurchases(PendingPurchasesParams.newBuilder().enableOneTimeProducts().build())
        .build()
    private var products = mapOf<String, ProductDetails>()
    private var wanted = false // the page asked before the connection to Play was ready

    fun connect() = client.startConnection(object : BillingClientStateListener {
        override fun onBillingSetupFinished(result: BillingResult) {
            if (result.responseCode == BillingResponseCode.OK && wanted) load()
        }

        override fun onBillingServiceDisconnected() {}
    })

    /** Prices and existing purchases (restore after reinstall or on a second phone). */
    @JavascriptInterface
    fun refresh() = activity.runOnUiThread { if (client.isReady) load() else { wanted = true; if (client.connectionState == BillingClient.ConnectionState.DISCONNECTED) connect() } }

    @JavascriptInterface
    fun buy(productId: String) = activity.runOnUiThread {
        val details = products[productId] ?: return@runOnUiThread emit("onBillingError", JSONObject.quote("unavailable"))
        val params = BillingFlowParams.newBuilder().setProductDetailsParamsList(
            listOf(BillingFlowParams.ProductDetailsParams.newBuilder().setProductDetails(details).build())
        ).build()
        client.launchBillingFlow(activity, params)
    }

    private fun load() {
        val ids = listOf("wlky_plus", "wlky_pro").map {
            QueryProductDetailsParams.Product.newBuilder().setProductId(it).setProductType(ProductType.INAPP).build()
        }
        client.queryProductDetailsAsync(QueryProductDetailsParams.newBuilder().setProductList(ids).build()) { _, list ->
            products = list.associateBy { it.productId }
            val out = JSONArray()
            list.forEach { out.put(JSONObject().put("id", it.productId).put("price", it.oneTimePurchaseOfferDetails?.formattedPrice ?: "")) }
            emit("onProducts", out.toString())
        }
        client.queryPurchasesAsync(QueryPurchasesParams.newBuilder().setProductType(ProductType.INAPP).build()) { _, list ->
            list.forEach(::report)
        }
    }

    override fun onPurchasesUpdated(result: BillingResult, purchases: MutableList<Purchase>?) {
        when (result.responseCode) {
            BillingResponseCode.OK -> purchases?.forEach(::report)
            BillingResponseCode.USER_CANCELED -> {}
            else -> emit("onBillingError", JSONObject.quote(result.debugMessage.ifEmpty { "code ${result.responseCode}" }))
        }
    }

    private fun report(p: Purchase) {
        if (p.purchaseState != Purchase.PurchaseState.PURCHASED) return // pending: Play calls back when paid
        p.products.forEach { emit("onPurchase", "${JSONObject.quote(it)},${JSONObject.quote(p.purchaseToken)}") }
    }

    private fun emit(fn: String, args: String) = activity.runOnUiThread {
        web.evaluateJavascript("window.walkieNative && walkieNative.$fn($args)", null)
    }
}
