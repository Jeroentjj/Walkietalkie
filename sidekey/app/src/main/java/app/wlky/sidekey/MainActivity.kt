package app.wlky.sidekey

import android.app.Activity
import android.content.Context
import android.content.Intent
import android.graphics.Typeface
import android.os.Bundle
import android.text.InputType
import android.view.Gravity
import android.widget.ArrayAdapter
import android.widget.Button
import android.widget.EditText
import android.widget.LinearLayout
import android.widget.ScrollView
import android.widget.Spinner
import android.widget.TextView
import android.widget.Toast

/** Settings: the favourite number and the app the "smart" action starts, plus a list of what the actions do. */
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

        val col = LinearLayout(this).apply { orientation = LinearLayout.VERTICAL; setPadding(dp(20), dp(36), dp(20), dp(28)) }
        col.addView(label(getString(R.string.app_name), 26f, orange, true))
        col.addView(label(getString(R.string.intro), 15f, white, top = 10))
        col.addView(label(getString(R.string.how), 15f, grey, top = 10))

        col.addView(label(getString(R.string.number_title), 16f, white, true, top = 24))
        val number = EditText(this).apply {
            inputType = InputType.TYPE_CLASS_PHONE
            hint = getString(R.string.number_hint)
            setText(prefs.getString("number", ""))
            setTextColor(white)
            setHintTextColor(grey)
        }
        col.addView(number)

        col.addView(label(getString(R.string.smart_title), 16f, white, true, top = 20))
        val launcher = Intent(Intent.ACTION_MAIN).addCategory(Intent.CATEGORY_LAUNCHER)
        val apps = packageManager.queryIntentActivities(launcher, 0)
            .filter { it.activityInfo.packageName != packageName }
            .map { it.loadLabel(packageManager).toString() to it.activityInfo.packageName }
            .distinctBy { it.second }
            .sortedBy { it.first.lowercase() }
        val entries = listOf(getString(R.string.smart_none) to "") + apps
        val spinner = Spinner(this).apply {
            adapter = ArrayAdapter(this@MainActivity, android.R.layout.simple_spinner_dropdown_item, entries.map { it.first })
            setSelection(entries.indexOfFirst { it.second == prefs.getString("fallback", "") }.coerceAtLeast(0))
        }
        col.addView(spinner)

        val save = Button(this).apply {
            text = getString(R.string.save)
            setOnClickListener {
                prefs.edit()
                    .putString("number", number.text.toString().trim())
                    .putString("fallback", entries[spinner.selectedItemPosition].second)
                    .apply()
                Toast.makeText(this@MainActivity, R.string.saved, Toast.LENGTH_SHORT).show()
            }
        }
        col.addView(save, LinearLayout.LayoutParams(LinearLayout.LayoutParams.WRAP_CONTENT, LinearLayout.LayoutParams.WRAP_CONTENT).apply {
            topMargin = dp(16)
            gravity = Gravity.START
        })

        col.addView(label(getString(R.string.actions_title), 16f, white, true, top = 28))
        val actions = listOf(
            R.string.act_torch to R.string.desc_torch, R.string.act_sound to R.string.desc_sound, R.string.act_camera to R.string.desc_camera,
            R.string.act_location to R.string.desc_location, R.string.act_call to R.string.desc_call, R.string.act_assist to R.string.desc_assist,
            R.string.act_smart to R.string.desc_smart,
        )
        for ((title, desc) in actions) {
            col.addView(label(getString(title), 15f, orange, true, top = 14))
            col.addView(label(getString(desc), 14f, grey))
        }
        setContentView(ScrollView(this).apply { addView(col); isFillViewport = true })
    }
}
