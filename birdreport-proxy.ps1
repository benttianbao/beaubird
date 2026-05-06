$ErrorActionPreference = "Stop"

$listener = [System.Net.HttpListener]::new()
$port = if ($env:BEAUBIRD_PROXY_PORT) { [int]$env:BEAUBIRD_PROXY_PORT } else { 8787 }
$prefix = "http://127.0.0.1:$port/"
$listener.Prefixes.Add($prefix)

$endpointMap = @{
  "/api/birdreport/province" = @{
    RemotePath = "https://api.birdreport.cn/front/system/adcode/province"
    Referer = "https://www.birdreport.cn/home/search/page.html"
  }
  "/api/birdreport/city" = @{
    RemotePath = "https://api.birdreport.cn/front/system/adcode/city"
    Referer = "https://www.birdreport.cn/home/search/page.html"
  }
  "/api/birdreport/district" = @{
    RemotePath = "https://api.birdreport.cn/front/system/adcode/district"
    Referer = "https://www.birdreport.cn/home/search/page.html"
  }
  "/api/birdreport/taxon" = @{
    RemotePath = "https://api.birdreport.cn/front/record/activity/taxon"
    Referer = "https://www.birdreport.cn/home/search/taxon.html"
  }
  "/api/birdreport/record" = @{
    RemotePath = "https://api.birdreport.cn/front/record/search/page"
    Referer = "https://www.birdreport.cn/home/search/record.html"
  }
  "/api/birdreport/summary" = @{
    RemotePath = "https://api.birdreport.cn/front/record/chart/summary"
    Referer = "https://www.birdreport.cn/home/search/page.html"
  }
}

$birdreportCookieContainer = [System.Net.CookieContainer]::new()
$birdreportCookies = @{}

function Write-JsonResponse {
  param(
    [Parameter(Mandatory = $true)] $Context,
    [Parameter(Mandatory = $true)] [int] $StatusCode,
    [Parameter(Mandatory = $true)] [string] $Body
  )

  $response = $Context.Response
  $response.StatusCode = $StatusCode
  $response.ContentType = "application/json; charset=utf-8"
  $response.Headers["Access-Control-Allow-Origin"] = "*"
  $response.Headers["Access-Control-Allow-Headers"] = "Content-Type, timestamp, requestId, sign"
  $response.Headers["Access-Control-Allow-Methods"] = "POST, OPTIONS, GET"
  $bytes = [System.Text.Encoding]::UTF8.GetBytes($Body)
  $response.ContentLength64 = $bytes.Length
  $response.OutputStream.Write($bytes, 0, $bytes.Length)
  $response.OutputStream.Close()
}

function Write-ByteResponse {
  param(
    [Parameter(Mandatory = $true)] $Context,
    [Parameter(Mandatory = $true)] [int] $StatusCode,
    [Parameter(Mandatory = $true)] [byte[]] $BodyBytes,
    [string] $ContentType = "application/json; charset=utf-8"
  )

  $response = $Context.Response
  $response.StatusCode = $StatusCode
  $response.ContentType = $ContentType
  $response.Headers["Access-Control-Allow-Origin"] = "*"
  $response.Headers["Access-Control-Allow-Headers"] = "Content-Type, timestamp, requestId, sign"
  $response.Headers["Access-Control-Allow-Methods"] = "POST, OPTIONS, GET"
  $response.ContentLength64 = $BodyBytes.Length
  $response.OutputStream.Write($BodyBytes, 0, $BodyBytes.Length)
  $response.OutputStream.Close()
}

function Read-RequestBody {
  param([Parameter(Mandatory = $true)] $Request)

  $reader = [System.IO.StreamReader]::new($Request.InputStream, $Request.ContentEncoding)
  try {
    return $reader.ReadToEnd()
  } finally {
    $reader.Dispose()
  }
}

function Read-StreamBytes {
  param([Parameter(Mandatory = $true)] $Stream)

  $memory = [System.IO.MemoryStream]::new()
  try {
    $buffer = New-Object byte[] 8192
    while (($read = $Stream.Read($buffer, 0, $buffer.Length)) -gt 0) {
      $memory.Write($buffer, 0, $read)
    }
    return $memory.ToArray()
  } finally {
    $memory.Dispose()
  }
}

function Get-BirdreportCookieHeader {
  if ($birdreportCookies.Count -eq 0) {
    return ""
  }

  return ($birdreportCookies.GetEnumerator() | ForEach-Object { "$($_.Key)=$($_.Value)" }) -join "; "
}

function Store-BirdreportSetCookieHeaders {
  param([string[]] $HeaderLines)

  foreach ($line in $HeaderLines) {
    if ($line -notmatch "^\s*Set-Cookie\s*:\s*([^;]+)") {
      continue
    }

    $cookiePair = $Matches[1]
    $separator = $cookiePair.IndexOf("=")
    if ($separator -le 0) {
      continue
    }

    $name = $cookiePair.Substring(0, $separator).Trim()
    $value = $cookiePair.Substring($separator + 1).Trim()
    if ($name) {
      $birdreportCookies[$name] = $value
    }
  }
}

function Read-CurlResponseMetadata {
  param([Parameter(Mandatory = $true)] [string] $HeaderPath)

  $statusCode = 200
  $contentType = "application/json; charset=utf-8"
  if (-not (Test-Path -LiteralPath $HeaderPath)) {
    return @{
      StatusCode = $statusCode
      ContentType = $contentType
    }
  }

  $headerLines = Get-Content -LiteralPath $HeaderPath
  Store-BirdreportSetCookieHeaders -HeaderLines $headerLines

  foreach ($line in $headerLines) {
    if ($line -match "^HTTP/\S+\s+(\d+)") {
      $statusCode = [int]$Matches[1]
    } elseif ($line -match "^\s*Content-Type\s*:\s*(.+)$") {
      $contentType = $Matches[1].Trim()
    }
  }

  return @{
    StatusCode = $statusCode
    ContentType = if ($contentType) { $contentType } else { "application/json; charset=utf-8" }
  }
}

function Invoke-BirdreportCurlRequest {
  param(
    [Parameter(Mandatory = $true)] [string] $RemotePath,
    [Parameter(Mandatory = $true)] [string] $Referer,
    [Parameter(Mandatory = $true)] [string] $Method,
    [string] $Body = "",
    [string] $ContentType = "application/json; charset=UTF-8",
    [hashtable] $Headers = @{},
    [string] $Accept = "application/json, text/plain, */*"
  )

  $tempRoot = [System.IO.Path]::GetTempPath()
  $requestBodyPath = [System.IO.Path]::Combine($tempRoot, "beaubird-birdreport-request-$([guid]::NewGuid().ToString("N")).txt")
  $responseBodyPath = [System.IO.Path]::Combine($tempRoot, "beaubird-birdreport-response-$([guid]::NewGuid().ToString("N")).bin")
  $responseHeaderPath = [System.IO.Path]::Combine($tempRoot, "beaubird-birdreport-header-$([guid]::NewGuid().ToString("N")).txt")

  try {
    $curlArgs = @(
      "--silent",
      "--show-error",
      "--max-time", "45",
      "--connect-timeout", "15",
      "--request", $Method,
      "--url", $RemotePath,
      "--output", $responseBodyPath,
      "--dump-header", $responseHeaderPath,
      "--header", "Accept: $Accept",
      "--header", "Accept-Encoding: identity",
      "--header", "Origin: https://www.birdreport.cn",
      "--header", "Referer: $Referer",
      "--header", "User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36"
    )

    $cookieHeader = Get-BirdreportCookieHeader
    if ($cookieHeader) {
      $curlArgs += @("--header", "Cookie: $cookieHeader")
    }

    foreach ($key in $Headers.Keys) {
      $value = [string]$Headers[$key]
      if ($value) {
        $curlArgs += @("--header", "${key}: $value")
      }
    }

    if ($Method -eq "POST") {
      [System.IO.File]::WriteAllText($requestBodyPath, $Body, [System.Text.Encoding]::UTF8)
      $curlArgs += @("--header", "Content-Type: $ContentType", "--data-binary", "@$requestBodyPath")
    }

    $curlOutput = & curl.exe @curlArgs 2>&1
    $curlExitCode = $LASTEXITCODE
    if ($curlExitCode -ne 0) {
      $details = ($curlOutput | Out-String).Trim()
      if (-not $details) {
        $details = "curl.exe exited with code $curlExitCode"
      }
      throw "BirdReport curl relay failed: $details"
    }

    $metadata = Read-CurlResponseMetadata -HeaderPath $responseHeaderPath
    $bodyBytes = if (Test-Path -LiteralPath $responseBodyPath) {
      [System.IO.File]::ReadAllBytes($responseBodyPath)
    } else {
      [byte[]]::new(0)
    }

    return @{
      StatusCode = $metadata.StatusCode
      ContentType = $metadata.ContentType
      BodyBytes = $bodyBytes
    }
  } finally {
    Remove-Item -LiteralPath $requestBodyPath -ErrorAction SilentlyContinue
    Remove-Item -LiteralPath $responseBodyPath -ErrorAction SilentlyContinue
    Remove-Item -LiteralPath $responseHeaderPath -ErrorAction SilentlyContinue
  }
}

function Invoke-BirdreportRelay {
  param(
    [Parameter(Mandatory = $true)] [string] $RemotePath,
    [Parameter(Mandatory = $true)] [string] $Referer,
    [Parameter(Mandatory = $true)] [string] $Body,
    [Parameter(Mandatory = $true)] $Request
  )

  $headers = @{
    "Origin" = "https://www.birdreport.cn"
    "Referer" = $Referer
    "User-Agent" = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36"
    "Accept" = "application/json, text/plain, */*"
    "timestamp" = $Request.Headers["timestamp"]
    "requestId" = $Request.Headers["requestId"]
    "sign" = $Request.Headers["sign"]
  }

  return Invoke-BirdreportCurlRequest `
    -RemotePath $RemotePath `
    -Referer $Referer `
    -Method "POST" `
    -Body $Body `
    -ContentType "application/x-www-form-urlencoded; charset=UTF-8" `
    -Headers @{
      timestamp = $headers["timestamp"]
      requestId = $headers["requestId"]
      sign = $headers["sign"]
    }

  $request = [System.Net.HttpWebRequest]::Create($RemotePath)
  $request.Method = "POST"
  $request.CookieContainer = $birdreportCookieContainer
  $request.Accept = $headers["Accept"]
  $request.UserAgent = $headers["User-Agent"]
  $request.Referer = $headers["Referer"]
  $request.ContentType = "application/x-www-form-urlencoded; charset=UTF-8"
  $request.AutomaticDecompression = [System.Net.DecompressionMethods]::GZip -bor [System.Net.DecompressionMethods]::Deflate
  $request.Headers["Origin"] = $headers["Origin"]
  $request.Headers["timestamp"] = $headers["timestamp"]
  $request.Headers["requestId"] = $headers["requestId"]
  $request.Headers["sign"] = $headers["sign"]

  $bodyBytes = [System.Text.Encoding]::UTF8.GetBytes($Body)
  $request.ContentLength = $bodyBytes.Length
  $requestStream = $request.GetRequestStream()
  try {
    $requestStream.Write($bodyBytes, 0, $bodyBytes.Length)
  } finally {
    $requestStream.Dispose()
  }

  try {
    $response = [System.Net.HttpWebResponse]$request.GetResponse()
    try {
      $stream = $response.GetResponseStream()
      try {
        return @{
          StatusCode = [int]$response.StatusCode
          ContentType = if ($response.ContentType) { $response.ContentType } else { "application/json; charset=utf-8" }
          BodyBytes = Read-StreamBytes -Stream $stream
        }
      } finally {
        if ($stream) {
          $stream.Dispose()
        }
      }
    } finally {
      $response.Dispose()
    }
  } catch [System.Net.WebException] {
    $errorResponse = $_.Exception.Response
    if ($errorResponse) {
      try {
        $stream = $errorResponse.GetResponseStream()
        try {
          return @{
            StatusCode = [int]([System.Net.HttpWebResponse]$errorResponse).StatusCode
            ContentType = if ($errorResponse.ContentType) { $errorResponse.ContentType } else { "application/json; charset=utf-8" }
            BodyBytes = Read-StreamBytes -Stream $stream
          }
        } finally {
          if ($stream) {
            $stream.Dispose()
          }
        }
      } finally {
        $errorResponse.Dispose()
      }
    }
    throw
  }
}

function Invoke-BirdreportPlainRequest {
  param(
    [Parameter(Mandatory = $true)] [string] $RemotePath,
    [Parameter(Mandatory = $true)] [string] $Referer,
    [Parameter(Mandatory = $true)] [string] $Method,
    [string] $Body = "",
    [string] $ContentType = "application/json; charset=UTF-8"
  )

  return Invoke-BirdreportCurlRequest `
    -RemotePath $RemotePath `
    -Referer $Referer `
    -Method $Method `
    -Body $Body `
    -ContentType $ContentType `
    -Accept $(if ($RemotePath -like "*/generate*") { "image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8" } else { "application/json, text/plain, */*" })

  $request = [System.Net.HttpWebRequest]::Create($RemotePath)
  $request.Method = $Method
  $request.CookieContainer = $birdreportCookieContainer
  $request.Accept = "application/json, text/plain, */*"
  $request.UserAgent = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36"
  $request.Referer = $Referer
  $request.AutomaticDecompression = [System.Net.DecompressionMethods]::GZip -bor [System.Net.DecompressionMethods]::Deflate
  $request.Headers["Origin"] = "https://www.birdreport.cn"

  if ($Method -eq "POST") {
    $request.ContentType = $ContentType
    $bodyBytes = [System.Text.Encoding]::UTF8.GetBytes($Body)
    $request.ContentLength = $bodyBytes.Length
    $requestStream = $request.GetRequestStream()
    try {
      $requestStream.Write($bodyBytes, 0, $bodyBytes.Length)
    } finally {
      $requestStream.Dispose()
    }
  }

  try {
    $response = [System.Net.HttpWebResponse]$request.GetResponse()
    try {
      $stream = $response.GetResponseStream()
      try {
        return @{
          StatusCode = [int]$response.StatusCode
          ContentType = if ($response.ContentType) { $response.ContentType } else { "application/json; charset=utf-8" }
          BodyBytes = Read-StreamBytes -Stream $stream
        }
      } finally {
        if ($stream) {
          $stream.Dispose()
        }
      }
    } finally {
      $response.Dispose()
    }
  } catch [System.Net.WebException] {
    $errorResponse = $_.Exception.Response
    if ($errorResponse) {
      try {
        $stream = $errorResponse.GetResponseStream()
        try {
          return @{
            StatusCode = [int]([System.Net.HttpWebResponse]$errorResponse).StatusCode
            ContentType = if ($errorResponse.ContentType) { $errorResponse.ContentType } else { "application/json; charset=utf-8" }
            BodyBytes = Read-StreamBytes -Stream $stream
          }
        } finally {
          if ($stream) {
            $stream.Dispose()
          }
        }
      } finally {
        $errorResponse.Dispose()
      }
    }
    throw
  }
}

Write-Host "BirdReport proxy listening on $prefix"
Write-Host "Allowed endpoints:"
$endpointMap.Keys | ForEach-Object { Write-Host "  $_" }

$listener.Start()

try {
  while ($listener.IsListening) {
    $context = $listener.GetContext()
    $request = $context.Request
    $path = $request.Url.AbsolutePath

    try {
      if ($request.HttpMethod -eq "OPTIONS") {
        Write-JsonResponse -Context $context -StatusCode 200 -Body '{"success":true}'
        continue
      }

      if ($path -eq "/health") {
        Write-JsonResponse -Context $context -StatusCode 200 -Body '{"success":true,"service":"birdreport-proxy"}'
        continue
      }

      if ($path -eq "/api/birdreport/captcha") {
        if ($request.HttpMethod -ne "GET") {
          Write-JsonResponse -Context $context -StatusCode 405 -Body '{"success":false,"error":"Method not allowed"}'
          continue
        }

        $captchaUrl = "https://api.birdreport.cn/front/code/visited/generate?timestamp=$([DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds())"
        $captchaResponse = Invoke-BirdreportPlainRequest -RemotePath $captchaUrl -Referer "https://www.birdreport.cn/home/code/verify.html" -Method "GET"
        Write-ByteResponse -Context $context -StatusCode $captchaResponse.StatusCode -BodyBytes $captchaResponse.BodyBytes -ContentType $captchaResponse.ContentType
        continue
      }

      if ($path -eq "/api/birdreport/verify") {
        if ($request.HttpMethod -ne "POST") {
          Write-JsonResponse -Context $context -StatusCode 405 -Body '{"success":false,"error":"Method not allowed"}'
          continue
        }

        $body = Read-RequestBody -Request $request
        $verifyResponse = Invoke-BirdreportPlainRequest -RemotePath "https://api.birdreport.cn/front/code/visited/verify" -Referer "https://www.birdreport.cn/home/code/verify.html" -Method "POST" -Body $body -ContentType "application/json; charset=UTF-8"
        Write-ByteResponse -Context $context -StatusCode $verifyResponse.StatusCode -BodyBytes $verifyResponse.BodyBytes -ContentType $verifyResponse.ContentType
        continue
      }

      if (-not $endpointMap.ContainsKey($path)) {
        Write-JsonResponse -Context $context -StatusCode 404 -Body '{"success":false,"error":"Unknown endpoint"}'
        continue
      }

      if ($request.HttpMethod -ne "POST") {
        Write-JsonResponse -Context $context -StatusCode 405 -Body '{"success":false,"error":"Method not allowed"}'
        continue
      }

      $target = $endpointMap[$path]
      $body = Read-RequestBody -Request $request
      $relayResponse = Invoke-BirdreportRelay -RemotePath $target.RemotePath -Referer $target.Referer -Body $body -Request $request
      Write-ByteResponse -Context $context -StatusCode $relayResponse.StatusCode -BodyBytes $relayResponse.BodyBytes -ContentType $relayResponse.ContentType
    } catch {
      $statusCode = 500
      $message = $_.Exception.Message

      if ($_.Exception.Response) {
        try {
          $statusCode = [int]$_.Exception.Response.StatusCode
          $stream = $_.Exception.Response.GetResponseStream()
          if ($stream) {
            $bytes = Read-StreamBytes -Stream $stream
            try {
              if ($bytes -and $bytes.Length -gt 0) {
                Write-ByteResponse -Context $context -StatusCode $statusCode -BodyBytes $bytes
                continue
              }
            } finally {
              $stream.Dispose()
            }
          }
        } catch {
        }
      }

      $fallback = @{ success = $false; error = $message } | ConvertTo-Json -Compress
      Write-JsonResponse -Context $context -StatusCode $statusCode -Body $fallback
    }
  }
} finally {
  $listener.Stop()
  $listener.Close()
}
