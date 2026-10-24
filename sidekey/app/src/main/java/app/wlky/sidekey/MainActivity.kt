package app.wlky.sidekey

import android.app.Activity
import android.content.Context
import android.content.Intent
import android.graphics.Typeface
import android.os.Bundle
import android.text.InputType
import android.text.util.Linkify
import android.view.Gravity
import android.widget.ArrayAdapter
import android.widget.Button
import android.widget.EditText
import android.widget.LinearLayout
import android.widget.ScrollView
import android.widget.Spinner
import android.widget.TextView
import android.widget.Toast

/** Settings of this one action (opened by tapping the app icon): what it does, plus its number or app where it needs one. */
class MainActivity : Activity() {

    private fun dp(v: Int) = (v * resources.displayMetrics.density).toInt()

    private fun label(s: String, size: Float, color: Int, bold: Boolean = false, top: Int = 0) = TextView(this).apply {
        text = s; textSize = size; setTextColor(color)
        if (bold) setTypeface(typeface, Typeface.BOLD)
        setPadding(0, dp(top), 0, 0)
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        val prefs = getSharedPreferences("side", Context.MODE_PRIVATE)
        val white = 0xFFEEEEEE.toInt()
        val grey = 0xFF9A9EA3.toInt()
        val orange = 0xFFF6A21A.toInt()
        val descs = mapOf(
            "torch" to R.string.desc_torch, "sound" to R.string.desc_sound, "camera" to R.string.desc_camera, "location" to R.string.desc_location,
            "call" to R.string.desc_call, "assist" to R.string.desc_assist, "smart" to R.string.desc_smart,
        )

        val col = LinearLayout(this).apply { orientation = LinearLayout.VERTICAL; setPadding(dp(20), dp(36), dp(20), dp(28)) }
        col.addView(label(getString(R.string.app_name), 26f, orange, true))
        descs[BuildConfig.ACTION]?.let { col.addView(label(getString(it), 16f, white, top = 10)) }
        col.addView(label(getString(R.string.how), 15f, grey, top = 14))

        var number: EditText? = null
        var spinner: Spinner? = null
        var entries = listOf<Pair<String, String>>()
        if (BuildConfig.ACTION == "call") {
            col.addView(label(getString(R.string.number_title), 16f, white, true, top = 24))
            number = EditText(this).apply {
                inputType = InputType.TYPE_CLASS_PHONE
                hint = getString(R.string.number_hint)
                setText(prefs.getString("number", ""))
                setTextColor(white)
                setHintTextColor(grey)
            }
            col.addView(number)
        }
        if (BuildConfig.ACTION == "smart") {
            col.addView(label(getString(R.string.smart_title), 16f, white, true, top = 24))
            val launcher = Intent(Intent.ACTION_MAIN).addCategory(Intent.CATEGORY_LAUNCHER)
            val apps = packageManager.queryIntentActivities(launcher, 0)
                .filter { !it.activityInfo.packageName.startsWith("app.wlky.sidekey") }
                .map { it.loadLabel(packageManager).toString() to it.activityInfo.packageName }
                .distinctBy { it.second }
                .sortedBy { it.first.lowercase() }
            entries = listOf(getString(R.string.smart_none) to "") + apps
            spinner = Spinner(this).apply {
                adapter = ArrayAdapter(this@MainActivity, android.R.layout.simple_spinner_dropdown_item, entries.map { it.first })
                setSelection(entries.indexOfFirst { it.second == prefs.getString("fallback", "") }.coerceAtLeast(0))
            }
            col.addView(spinner)
        }
        if (number != null || spinner != null) {
            val save = Button(this).apply {
                text = getString(R.string.save)
                setOnClickListener {
                    val edit = prefs.edit()
                    number?.let { edit.putString("number", it.text.toString().trim()) }
                    spinner?.let { edit.putString("fallback", entries[it.selectedItemPosition].second) }
                    edit.apply()
                    Toast.makeText(this@MainActivity, R.string.saved, Toast.LENGTH_SHORT).show()
                }
            }
            col.addView(save, LinearLayout.LayoutParams(LinearLayout.LayoutParams.WRAP_CONTENT, LinearLayout.LayoutParams.WRAP_CONTENT).apply {
                topMargin = dp(16)
                gravity = Gravity.START
            })
        }

        col.addView(label(getString(R.string.more), 14f, grey, top = 28).apply {
            setLinkTextColor(orange)
            Linkify.addLinks(this, Linkify.WEB_URLS)
        })
        setContentView(ScrollView(this).apply { addView(col); isFillViewport = true })
    }
}
