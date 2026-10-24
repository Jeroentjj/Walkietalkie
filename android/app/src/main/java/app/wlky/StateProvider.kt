package app.wlky

import android.content.ContentProvider
import android.content.ContentValues
import android.database.Cursor
import android.database.MatrixCursor
import android.net.Uri

/** Is WLKY on screen? True from onStart to onStop of the main activity (a see-through activity on top does not end it). */
object Foreground {
    @Volatile var started = false
}

/**
 * content://app.wlky.state/fg -> one row, one column: 1 while WLKY is on screen, otherwise 0.
 * The "WLKY Zijknop" app reads it, so a long press of the side button can do nothing while you hold PTT.
 */
class StateProvider : ContentProvider() {
    override fun onCreate() = true

    override fun query(uri: Uri, projection: Array<out String>?, selection: String?, selectionArgs: Array<out String>?, sortOrder: String?): Cursor =
        MatrixCursor(arrayOf("fg")).apply { addRow(arrayOf<Any>(if (Foreground.started) 1 else 0)) }

    override fun getType(uri: Uri): String? = null
    override fun insert(uri: Uri, values: ContentValues?): Uri? = null
    override fun delete(uri: Uri, selection: String?, selectionArgs: Array<out String>?) = 0
    override fun update(uri: Uri, values: ContentValues?, selection: String?, selectionArgs: Array<out String>?) = 0
}
