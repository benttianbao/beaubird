package cn.beaubird.app

import android.os.Bundle
import android.view.View
import android.webkit.WebChromeClient
import android.webkit.WebView
import android.webkit.WebViewClient
import android.widget.Toast
import androidx.activity.OnBackPressedCallback
import androidx.appcompat.app.AppCompatActivity

class MainActivity : AppCompatActivity() {
  private lateinit var webView: WebView
  private lateinit var localServer: BeauBirdLocalServer

  override fun onCreate(savedInstanceState: Bundle?) {
    super.onCreate(savedInstanceState)
    setContentView(R.layout.activity_main)

    webView = findViewById(R.id.web_view)
    localServer = BeauBirdLocalServer(applicationContext)

    configureWebView()

    try {
      localServer.start()
      webView.loadUrl(localServer.homeUrl())
    } catch (error: Exception) {
      Toast.makeText(this, "Built-in proxy failed: ${error.message}", Toast.LENGTH_LONG).show()
    }

    onBackPressedDispatcher.addCallback(this, object : OnBackPressedCallback(true) {
      override fun handleOnBackPressed() {
        if (webView.canGoBack()) {
          webView.goBack()
        } else {
          isEnabled = false
          onBackPressedDispatcher.onBackPressed()
        }
      }
    })
  }

  override fun onDestroy() {
    webView.removeJavascriptInterface("BeauBirdAndroid")
    webView.stopLoading()
    webView.destroy()
    localServer.stop()
    super.onDestroy()
  }

  private fun configureWebView() {
    webView.settings.javaScriptEnabled = true
    webView.settings.domStorageEnabled = true
    webView.settings.databaseEnabled = true
    webView.settings.useWideViewPort = false
    webView.settings.loadWithOverviewMode = false
    webView.settings.setSupportZoom(false)
    webView.settings.builtInZoomControls = false
    webView.settings.displayZoomControls = false
    webView.settings.textZoom = 100
    webView.isHorizontalScrollBarEnabled = false
    webView.overScrollMode = View.OVER_SCROLL_NEVER
    webView.settings.userAgentString = "${webView.settings.userAgentString} BeauBirdAndroidApp/1.0"
    webView.addJavascriptInterface(BeauBirdBridge(this), "BeauBirdAndroid")
    webView.webChromeClient = WebChromeClient()
    webView.webViewClient = object : WebViewClient() {
      override fun shouldOverrideUrlLoading(view: WebView?, url: String?): Boolean {
        return false
      }

      override fun onPageFinished(view: WebView?, url: String?) {
        super.onPageFinished(view, url)
        view?.evaluateJavascript(
          """
            (function () {
              var viewport = document.querySelector('meta[name="viewport"]');
              if (viewport) {
                viewport.setAttribute('content', 'width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover');
              }
              document.documentElement.style.width = '100%';
              document.documentElement.style.maxWidth = '100%';
              document.body.style.width = '100%';
              document.body.style.maxWidth = '100%';
              document.body.style.overflowX = 'hidden';
            })();
          """.trimIndent(),
          null
        )
      }
    }
  }
}
