package cn.beaubird.app

import android.content.Context
import android.util.Log
import java.io.BufferedInputStream
import java.io.BufferedReader
import java.io.ByteArrayOutputStream
import java.io.InputStream
import java.io.InputStreamReader
import java.io.OutputStream
import java.net.HttpURLConnection
import java.net.InetAddress
import java.net.InetSocketAddress
import java.net.HttpCookie
import java.net.URI
import java.net.ServerSocket
import java.net.Socket
import java.net.SocketException
import java.net.URL
import java.nio.charset.StandardCharsets
import java.util.Locale
import java.util.concurrent.ExecutorService
import java.util.concurrent.Executors
import java.util.concurrent.atomic.AtomicBoolean

class BeauBirdLocalServer(private val context: Context) {
  private val running = AtomicBoolean(false)
  private val acceptExecutor: ExecutorService = Executors.newSingleThreadExecutor()
  private val workerExecutor: ExecutorService = Executors.newCachedThreadPool()
  private var serverSocket: ServerSocket? = null
  private val birdreportCookies = linkedMapOf<String, String>()

  private val endpointMap = mapOf(
    "/api/birdreport/province" to EndpointTarget(
      remotePath = "https://api.birdreport.cn/front/system/adcode/province",
      referer = "https://www.birdreport.cn/home/search/page.html"
    ),
    "/api/birdreport/city" to EndpointTarget(
      remotePath = "https://api.birdreport.cn/front/system/adcode/city",
      referer = "https://www.birdreport.cn/home/search/page.html"
    ),
    "/api/birdreport/district" to EndpointTarget(
      remotePath = "https://api.birdreport.cn/front/system/adcode/district",
      referer = "https://www.birdreport.cn/home/search/page.html"
    ),
    "/api/birdreport/taxon" to EndpointTarget(
      remotePath = "https://api.birdreport.cn/front/record/activity/taxon",
      referer = "https://www.birdreport.cn/home/search/taxon.html"
    ),
    "/api/birdreport/record" to EndpointTarget(
      remotePath = "https://api.birdreport.cn/front/record/search/page",
      referer = "https://www.birdreport.cn/home/search/record.html"
    ),
    "/api/birdreport/summary" to EndpointTarget(
      remotePath = "https://api.birdreport.cn/front/record/chart/summary",
      referer = "https://www.birdreport.cn/home/search/page.html"
    )
  )

  fun start() {
    if (!running.compareAndSet(false, true)) {
      return
    }

    val socket = ServerSocket()
    socket.reuseAddress = true
    socket.bind(InetSocketAddress(InetAddress.getByName(HOST), PORT))
    serverSocket = socket

    acceptExecutor.execute {
      while (running.get()) {
        try {
          val client = socket.accept()
          workerExecutor.execute {
            handleClient(client)
          }
        } catch (_: SocketException) {
          if (running.get()) {
            Log.e(TAG, "Local server socket closed unexpectedly.")
          }
        } catch (error: Exception) {
          Log.e(TAG, "Failed to accept local request", error)
        }
      }
    }
  }

  fun stop() {
    if (!running.compareAndSet(true, false)) {
      return
    }

    try {
      serverSocket?.close()
    } catch (error: Exception) {
      Log.w(TAG, "Failed to close local server socket", error)
    }
    workerExecutor.shutdownNow()
    acceptExecutor.shutdownNow()
  }

  fun homeUrl(): String = "http://$HOST:$PORT/"

  private fun handleClient(socket: Socket) {
    socket.use { client ->
      client.soTimeout = 20000

      try {
        val request = readRequest(client.getInputStream()) ?: return
        val response = when {
          request.method == "OPTIONS" -> jsonResponse(200, """{"success":true}""")
          request.path == "/health" -> jsonResponse(200, """{"success":true,"service":"beaubird-local-server"}""")
          STATIC_ASSET_PATHS.containsKey(request.path) -> serveAsset(request.path)
          request.path == "/api/birdreport/captcha" -> proxyCaptchaImage(request)
          request.path == "/api/birdreport/verify" -> proxyCaptchaVerify(request)
          endpointMap.containsKey(request.path) -> proxyRequest(request)
          else -> jsonResponse(404, """{"success":false,"error":"Unknown endpoint"}""")
        }
        writeResponse(client.getOutputStream(), response)
      } catch (error: Exception) {
        Log.e(TAG, "Failed to handle local request", error)
        writeResponse(client.getOutputStream(), jsonResponse(500, """{"success":false,"error":"${escapeJson(error.message ?: "Internal server error")}"}"""))
      }
    }
  }

  private fun readRequest(input: InputStream): LocalRequest? {
    val reader = BufferedReader(InputStreamReader(BufferedInputStream(input), StandardCharsets.UTF_8))
    val requestLine = reader.readLine() ?: return null
    if (requestLine.isBlank()) {
      return null
    }

    val parts = requestLine.split(" ")
    if (parts.size < 2) {
      return null
    }

    val headers = linkedMapOf<String, String>()
    while (true) {
      val line = reader.readLine() ?: break
      if (line.isEmpty()) {
        break
      }

      val separator = line.indexOf(':')
      if (separator <= 0) {
        continue
      }

      val name = line.substring(0, separator).trim().lowercase(Locale.ROOT)
      val value = line.substring(separator + 1).trim()
      headers[name] = value
    }

    val contentLength = headers["content-length"]?.toIntOrNull() ?: 0
    val bodyChars = CharArray(contentLength)
    var readTotal = 0
    while (readTotal < contentLength) {
      val readCount = reader.read(bodyChars, readTotal, contentLength - readTotal)
      if (readCount <= 0) {
        break
      }
      readTotal += readCount
    }

    return LocalRequest(
      method = parts[0].uppercase(Locale.ROOT),
      path = parts[1].substringBefore('?'),
      headers = headers,
      body = String(bodyChars, 0, readTotal)
    )
  }

  private fun serveAsset(path: String): LocalResponse {
    val assetName = STATIC_ASSET_PATHS[path] ?: return jsonResponse(404, """{"success":false,"error":"Asset not found"}""")
    val body = context.assets.open(assetName).use { it.readBytes() }
    return LocalResponse(
      statusCode = 200,
      contentType = CONTENT_TYPES[path] ?: "application/octet-stream",
      body = body
    )
  }

  private fun proxyRequest(request: LocalRequest): LocalResponse {
    val target = endpointMap[request.path]
      ?: return jsonResponse(404, """{"success":false,"error":"Unknown endpoint"}""")

    if (request.method != "POST") {
      return jsonResponse(405, """{"success":false,"error":"Method not allowed"}""")
    }

    val connection = (URL(target.remotePath).openConnection() as HttpURLConnection).apply {
      requestMethod = "POST"
      connectTimeout = 15000
      readTimeout = 30000
      doOutput = true
      instanceFollowRedirects = false
      setRequestProperty("Accept", "application/json, text/plain, */*")
      setRequestProperty("Accept-Encoding", "identity")
      setRequestProperty("Content-Type", "application/x-www-form-urlencoded; charset=UTF-8")
      setRequestProperty("Origin", "https://www.birdreport.cn")
      setRequestProperty("Referer", target.referer)
      attachBirdreportCookies(this)
      setRequestProperty(
        "User-Agent",
        "Mozilla/5.0 (Linux; Android 14; Mobile) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Mobile Safari/537.36"
      )
      request.headers["timestamp"]?.takeIf { it.isNotBlank() }?.let { setRequestProperty("timestamp", it) }
      request.headers["requestid"]?.takeIf { it.isNotBlank() }?.let { setRequestProperty("requestId", it) }
      request.headers["sign"]?.takeIf { it.isNotBlank() }?.let { setRequestProperty("sign", it) }
    }

    val requestBody = request.body.toByteArray(StandardCharsets.UTF_8)
    connection.outputStream.use { output ->
      output.write(requestBody)
    }

    return try {
      val statusCode = connection.responseCode
      val contentType = connection.contentType ?: "application/json; charset=UTF-8"
      storeBirdreportCookies(connection)
      val body = readConnectionBody(connection, statusCode)
      LocalResponse(statusCode = statusCode, contentType = contentType, body = body)
    } finally {
      connection.disconnect()
    }
  }

  private fun proxyCaptchaImage(request: LocalRequest): LocalResponse {
    if (request.method != "GET") {
      return jsonResponse(405, """{"success":false,"error":"Method not allowed"}""")
    }

    val remotePath = "https://api.birdreport.cn/front/code/visited/generate?timestamp=${System.currentTimeMillis()}"
    val connection = (URL(remotePath).openConnection() as HttpURLConnection).apply {
      requestMethod = "GET"
      connectTimeout = 15000
      readTimeout = 30000
      instanceFollowRedirects = false
      setRequestProperty("Accept", "image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8")
      setRequestProperty("Accept-Encoding", "identity")
      setRequestProperty("Origin", "https://www.birdreport.cn")
      setRequestProperty("Referer", "https://www.birdreport.cn/home/code/verify.html")
      setRequestProperty(
        "User-Agent",
        "Mozilla/5.0 (Linux; Android 14; Mobile) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Mobile Safari/537.36"
      )
      attachBirdreportCookies(this)
    }

    return try {
      val statusCode = connection.responseCode
      val contentType = connection.contentType ?: "image/jpeg"
      storeBirdreportCookies(connection)
      val body = readConnectionBody(connection, statusCode)
      LocalResponse(statusCode = statusCode, contentType = contentType, body = body)
    } finally {
      connection.disconnect()
    }
  }

  private fun proxyCaptchaVerify(request: LocalRequest): LocalResponse {
    if (request.method != "POST") {
      return jsonResponse(405, """{"success":false,"error":"Method not allowed"}""")
    }

    val remotePath = "https://api.birdreport.cn/front/code/visited/verify"
    val connection = (URL(remotePath).openConnection() as HttpURLConnection).apply {
      requestMethod = "POST"
      connectTimeout = 15000
      readTimeout = 30000
      doOutput = true
      instanceFollowRedirects = false
      setRequestProperty("Accept", "application/json, text/plain, */*")
      setRequestProperty("Accept-Encoding", "identity")
      setRequestProperty("Content-Type", "application/json; charset=UTF-8")
      setRequestProperty("Origin", "https://www.birdreport.cn")
      setRequestProperty("Referer", "https://www.birdreport.cn/home/code/verify.html")
      setRequestProperty(
        "User-Agent",
        "Mozilla/5.0 (Linux; Android 14; Mobile) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Mobile Safari/537.36"
      )
      attachBirdreportCookies(this)
    }

    val requestBody = request.body.toByteArray(StandardCharsets.UTF_8)
    connection.outputStream.use { output ->
      output.write(requestBody)
    }

    return try {
      val statusCode = connection.responseCode
      val contentType = connection.contentType ?: "application/json; charset=UTF-8"
      storeBirdreportCookies(connection)
      val body = readConnectionBody(connection, statusCode)
      LocalResponse(statusCode = statusCode, contentType = contentType, body = body)
    } finally {
      connection.disconnect()
    }
  }

  private fun attachBirdreportCookies(connection: HttpURLConnection) {
    if (birdreportCookies.isEmpty()) {
      return
    }

    val cookieHeader = birdreportCookies.entries.joinToString("; ") { (name, value) -> "$name=$value" }
    connection.setRequestProperty("Cookie", cookieHeader)
  }

  private fun storeBirdreportCookies(connection: HttpURLConnection) {
    val values = connection.headerFields.entries
      .filter { (name, _) -> name != null && name.equals("Set-Cookie", ignoreCase = true) }
      .flatMap { it.value ?: emptyList() }

    for (header in values) {
      try {
        for (cookie in HttpCookie.parse(header)) {
          birdreportCookies[cookie.name] = cookie.value
        }
      } catch (error: Exception) {
        Log.w(TAG, "Failed to parse BirdReport cookie", error)
      }
    }
  }

  private fun readConnectionBody(connection: HttpURLConnection, statusCode: Int): ByteArray {
    val stream = if (statusCode in 200..299) connection.inputStream else connection.errorStream
    if (stream == null) {
      return ByteArray(0)
    }

    return stream.use { input ->
      val buffer = ByteArray(8192)
      val output = ByteArrayOutputStream()
      while (true) {
        val count = input.read(buffer)
        if (count <= 0) {
          break
        }
        output.write(buffer, 0, count)
      }
      output.toByteArray()
    }
  }

  private fun writeResponse(output: OutputStream, response: LocalResponse) {
    output.use { stream ->
      val headerText = buildString {
        append("HTTP/1.1 ${response.statusCode} ${reasonPhrase(response.statusCode)}\r\n")
        append("Content-Type: ${response.contentType}\r\n")
        append("Content-Length: ${response.body.size}\r\n")
        append("Access-Control-Allow-Origin: *\r\n")
        append("Access-Control-Allow-Headers: Content-Type, timestamp, requestId, sign, X-Requested-With\r\n")
        append("Access-Control-Allow-Methods: GET, POST, OPTIONS\r\n")
        append("Access-Control-Allow-Private-Network: true\r\n")
        append("Cache-Control: no-store\r\n")
        append("Connection: close\r\n")
        append("\r\n")
      }
      stream.write(headerText.toByteArray(StandardCharsets.UTF_8))
      stream.write(response.body)
      stream.flush()
    }
  }

  private fun jsonResponse(statusCode: Int, body: String): LocalResponse {
    return LocalResponse(
      statusCode = statusCode,
      contentType = "application/json; charset=UTF-8",
      body = body.toByteArray(StandardCharsets.UTF_8)
    )
  }

  private fun reasonPhrase(statusCode: Int): String {
    return when (statusCode) {
      200 -> "OK"
      400 -> "Bad Request"
      404 -> "Not Found"
      405 -> "Method Not Allowed"
      500 -> "Internal Server Error"
      else -> "OK"
    }
  }

  private fun escapeJson(value: String): String {
    return value
      .replace("\\", "\\\\")
      .replace("\"", "\\\"")
      .replace("\r", "\\r")
      .replace("\n", "\\n")
  }

  private data class EndpointTarget(
    val remotePath: String,
    val referer: String
  )

  private data class LocalRequest(
    val method: String,
    val path: String,
    val headers: Map<String, String>,
    val body: String
  )

  private data class LocalResponse(
    val statusCode: Int,
    val contentType: String,
    val body: ByteArray
  )

  companion object {
    private const val TAG = "BeauBirdLocalServer"
    private const val HOST = "127.0.0.1"
    private const val PORT = 8787

    private val STATIC_ASSET_PATHS = mapOf(
      "/" to "index.html",
      "/index.html" to "index.html",
      "/style.css" to "style.css",
      "/script.js" to "script.js",
      "/vendor/jquery.min.js" to "vendor/jquery.min.js",
      "/vendor/crypto-js.min.js" to "vendor/crypto-js.min.js",
      "/vendor/jqueryAjax.js" to "vendor/jqueryAjax.js",
      "/vendor/aes.util.js" to "vendor/aes.util.js",
      "/data/zhejiang-birdreport-species.json" to "data/zhejiang-birdreport-species.json",
      "/data/zhejiang-birdreport-species.js" to "data/zhejiang-birdreport-species.js"
    )

    private val CONTENT_TYPES = mapOf(
      "/" to "text/html; charset=UTF-8",
      "/index.html" to "text/html; charset=UTF-8",
      "/style.css" to "text/css; charset=UTF-8",
      "/script.js" to "application/javascript; charset=UTF-8",
      "/vendor/jquery.min.js" to "application/javascript; charset=UTF-8",
      "/vendor/crypto-js.min.js" to "application/javascript; charset=UTF-8",
      "/vendor/jqueryAjax.js" to "application/javascript; charset=UTF-8",
      "/vendor/aes.util.js" to "application/javascript; charset=UTF-8",
      "/data/zhejiang-birdreport-species.json" to "application/json; charset=UTF-8",
      "/data/zhejiang-birdreport-species.js" to "application/javascript; charset=UTF-8"
    )
  }
}
