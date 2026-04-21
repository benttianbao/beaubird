package cn.beaubird.app

import android.app.Activity
import android.content.ContentValues
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.os.Environment
import android.provider.MediaStore
import android.webkit.JavascriptInterface
import android.widget.Toast
import java.io.File
import java.io.FileOutputStream

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

  @JavascriptInterface
  fun saveTextFile(filename: String, mimeType: String, content: String): String {
    val safeFilename = filename.trim().ifEmpty { "beaubird-export.csv" }
    return try {
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
        val values = ContentValues().apply {
          put(MediaStore.Downloads.DISPLAY_NAME, safeFilename)
          put(MediaStore.Downloads.MIME_TYPE, mimeType.ifBlank { "text/plain" })
          put(MediaStore.Downloads.RELATIVE_PATH, Environment.DIRECTORY_DOWNLOADS)
          put(MediaStore.Downloads.IS_PENDING, 1)
        }
        val resolver = activity.contentResolver
        val uri = resolver.insert(MediaStore.Downloads.EXTERNAL_CONTENT_URI, values)
          ?: throw IllegalStateException("无法创建下载文件")
        resolver.openOutputStream(uri)?.use { output ->
          output.write(content.toByteArray(Charsets.UTF_8))
        } ?: throw IllegalStateException("无法写入下载文件")
        values.clear()
        values.put(MediaStore.Downloads.IS_PENDING, 0)
        resolver.update(uri, values, null, null)
        showToast("已导出到下载目录：$safeFilename")
        "下载目录/$safeFilename"
      } else {
        val downloadDir = activity.getExternalFilesDir(Environment.DIRECTORY_DOWNLOADS)
          ?: throw IllegalStateException("无法访问应用下载目录")
        if (!downloadDir.exists()) {
          downloadDir.mkdirs()
        }
        val file = File(downloadDir, safeFilename)
        FileOutputStream(file).use { output ->
          output.write(content.toByteArray(Charsets.UTF_8))
        }
        showToast("已导出到应用下载目录：$safeFilename")
        file.absolutePath
      }
    } catch (error: Exception) {
      showToast("导出失败：${error.message}")
      throw error
    }
  }

  private fun showToast(message: String) {
    activity.runOnUiThread {
      Toast.makeText(activity, message, Toast.LENGTH_SHORT).show()
    }
  }
}
