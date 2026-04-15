package cn.beaubird.app

import android.app.Activity
import android.content.Intent
import android.net.Uri
import android.webkit.JavascriptInterface
import android.widget.Toast

class BeauBirdBridge(private val activity: Activity) {
  @JavascriptInterface
  fun openExternal(url: String) {
    activity.runOnUiThread {
      try {
        val intent = Intent(Intent.ACTION_VIEW, Uri.parse(url))
        activity.startActivity(intent)
      } catch (error: Exception) {
        Toast.makeText(activity, "Unable to open link: ${error.message}", Toast.LENGTH_SHORT).show()
      }
    }
  }
}
