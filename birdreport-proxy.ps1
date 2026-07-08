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
    [string] $Accept = "application/json, text/plain, */*",
    [switch] $FollowRedirects
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

    if ($FollowRedirects) {
      $curlArgs += @("--location")
    }

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

function Invoke-MacaulayCurlRequest {
  param(
    [Parameter(Mandatory = $true)] [string] $RemotePath,
    [string] $Accept = "text/html,application/xhtml+xml"
  )

  return Invoke-BirdreportCurlRequest `
    -RemotePath $RemotePath `
    -Referer "https://media.ebird.org/" `
    -Method "GET" `
    -Accept $Accept `
    -FollowRedirects
}

function ConvertFrom-HtmlText {
  param([string] $Value)
  return [System.Net.WebUtility]::HtmlDecode([string]$Value).Trim()
}

function Get-MacaulayAssetId {
  param([string] $Value)
  $match = [regex]::Match([string]$Value, "^(?:ML)?(\d+)$", [System.Text.RegularExpressions.RegexOptions]::IgnoreCase)
  if (-not $match.Success) {
    return ""
  }
  return $match.Groups[1].Value
}

function Normalize-MacaulayQuery {
  param([string] $Value)
  return ([string]$Value).Trim().ToLowerInvariant() -replace "\s+", " "
}

function Get-MacaulayItemSpeciesCodes {
  param($Item)

  $codes = New-Object System.Collections.Generic.List[string]
  foreach ($value in @($Item.speciesCode, $Item.reportAs)) {
    $code = ([string]$value).Trim().ToLowerInvariant()
    if ($code) {
      $codes.Add($code)
    }
  }

  if ($Item.subjectData) {
    foreach ($subject in @($Item.subjectData)) {
      $code = ([string]$subject.speciesCode).Trim().ToLowerInvariant()
      if ($code) {
        $codes.Add($code)
      }
    }
  }

  return $codes
}

function Get-MacaulayItemNames {
  param($Item)

  $names = New-Object System.Collections.Generic.List[string]
  foreach ($value in @($Item.sciName, $Item.commonName)) {
    $name = ([string]$value).Trim()
    if ($name) {
      $names.Add($name)
    }
  }

  if ($Item.subjectData) {
    foreach ($subject in @($Item.subjectData)) {
      foreach ($value in @($subject.sciName, $subject.comName)) {
        $name = ([string]$value).Trim()
        if ($name) {
          $names.Add($name)
        }
      }
    }
  }

  return $names
}

function Test-MacaulayMediaMatch {
  param(
    $Item,
    [string] $TaxonCode,
    [string] $Query
  )

  if (([string]$Item.mediaType).Trim().ToLowerInvariant() -ne "photo") {
    return $false
  }

  $normalizedTaxonCode = ([string]$TaxonCode).Trim().ToLowerInvariant()
  if ($normalizedTaxonCode) {
    return @(Get-MacaulayItemSpeciesCodes -Item $Item).Contains($normalizedTaxonCode)
  }

  $normalizedQuery = Normalize-MacaulayQuery $Query
  if (-not $normalizedQuery) {
    return $true
  }

  foreach ($name in Get-MacaulayItemNames -Item $Item) {
    if ((Normalize-MacaulayQuery $name) -eq $normalizedQuery) {
      return $true
    }
  }
  return $false
}

function Get-MacaulaySearchResults {
  param(
    $Payload,
    [string] $TaxonCode,
    [string] $Query
  )

  $items = New-Object System.Collections.Generic.List[object]
  $seen = @{}
  $content = @()
  if ($Payload.results -and $Payload.results.content) {
    $content = @($Payload.results.content)
  } elseif ($Payload.content) {
    $content = @($Payload.content)
  }

  foreach ($entry in $content) {
    $assetId = Get-MacaulayAssetId -Value "$(if ($entry.assetId) { $entry.assetId } else { $entry.catalogId })"
    if (-not $assetId -or $seen.ContainsKey($assetId) -or -not (Test-MacaulayMediaMatch -Item $entry -TaxonCode $TaxonCode -Query $Query)) {
      continue
    }
    $seen[$assetId] = $true

    $rating = $null
    if ($entry.rating -ne $null -and ([string]$entry.rating).Trim()) {
      $rating = [double]$entry.rating
    }

    $previewUrl = if ($entry.largeUrl) {
      [string]$entry.largeUrl
    } elseif ($entry.mediaUrl) {
      [string]$entry.mediaUrl
    } else {
      "https://cdn.download.ams.birds.cornell.edu/api/v1/asset/$assetId/1200"
    }

    $sourceUrl = if ($entry.specimenUrl) {
      [string]$entry.specimenUrl
    } else {
      "https://macaulaylibrary.org/asset/$assetId"
    }

    $items.Add([pscustomobject]@{
      mlId = "ML$assetId"
      assetId = $assetId
      attribution = ([string]$entry.userDisplayName).Trim()
      rating = $rating
      checklistId = ([string]$entry.eBirdChecklistId).Trim()
      previewUrl = $previewUrl
      sourceUrl = $sourceUrl
    })

    if ($items.Count -ge 5) {
      break
    }
  }

  return $items
}

function Get-MacaulayCatalogSearchResults {
  param([string] $Html)

  $items = New-Object System.Collections.Generic.List[object]
  $seen = @{}
  $source = [string]$Html
  $searchIndex = $source.IndexOf('fetch:{"SearchPage:0"')
  if ($searchIndex -ge 0) {
    $source = $source.Substring($searchIndex)
  }

  $matches = [regex]::Matches($source, "(?:^|[,{])\s*assetId:(\d+)")
  foreach ($match in $matches) {
    $assetId = Get-MacaulayAssetId -Value $match.Groups[1].Value
    if (-not $assetId -or $seen.ContainsKey($assetId)) {
      continue
    }
    $seen[$assetId] = $true

    $start = $match.Index
    $nextItem = $source.IndexOf("},{ageSex:", $start + 1)
    $length = if ($nextItem -gt $start) { $nextItem - $start } else { [Math]::Min(3000, $source.Length - $start) }
    $itemSource = $source.Substring($start, $length)
    $rating = $null
    $ratingMatch = [regex]::Match($itemSource, "rating:([-+]?\d+(?:\.\d+)?)")
    if ($ratingMatch.Success) {
      $rating = [double]$ratingMatch.Groups[1].Value
    }
    $checklistMatch = [regex]::Match($itemSource, 'eBirdChecklistId:"([^"]*)"')
    $userMatch = [regex]::Match($itemSource, 'userDisplayName:"([^"]*)"')

    $items.Add([pscustomobject]@{
      mlId = "ML$assetId"
      assetId = $assetId
      attribution = if ($userMatch.Success) { $userMatch.Groups[1].Value } else { "" }
      rating = $rating
      checklistId = if ($checklistMatch.Success) { $checklistMatch.Groups[1].Value } else { "" }
      previewUrl = "https://cdn.download.ams.birds.cornell.edu/api/v1/asset/$assetId/1200"
      sourceUrl = "https://macaulaylibrary.org/asset/$assetId"
    })

    if ($items.Count -ge 5) {
      break
    }
  }

  return $items
}

function Resolve-MacaulayQueryTaxonCode {
  param([string] $Query)

  $trimmedQuery = ([string]$Query).Trim()
  if (-not $trimmedQuery) {
    return ""
  }

  $taxonomyUrl = "https://api.ebird.org/v2/ref/taxonomy/ebird?fmt=json&species=$([uri]::EscapeDataString($Query))&cat=species"
  $taxonomyResponse = Invoke-MacaulayCurlRequest -RemotePath $taxonomyUrl -Accept "application/json"
  $taxonomyBytes = @($taxonomyResponse.BodyBytes)
  if ($taxonomyBytes.Count -eq 0 -or -not ([string]$taxonomyResponse.ContentType).ToLowerInvariant().Contains("application/json")) {
    return ""
  }

  try {
    $payload = [System.Text.Encoding]::UTF8.GetString([byte[]]$taxonomyBytes) | ConvertFrom-Json
  } catch {
    return ""
  }

  $queryKey = Normalize-MacaulayQuery $trimmedQuery
  $items = @($payload)
  $match = $null
  foreach ($item in $items) {
    if ((Normalize-MacaulayQuery $item.sciName) -eq $queryKey -or (Normalize-MacaulayQuery $item.comName) -eq $queryKey) {
      $match = $item
      break
    }
  }
  if (-not $match -and $items.Count -gt 0) {
    $match = $items[0]
  }

  return ([string]$match.speciesCode).Trim()
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

      if ($path -eq "/api/media/macaulay/search") {
        if ($request.HttpMethod -ne "GET") {
          Write-JsonResponse -Context $context -StatusCode 405 -Body '{"success":false,"error":"Method not allowed"}'
          continue
        }

        $taxonCode = [string]$request.QueryString["taxonCode"]
        $query = [string]$request.QueryString["q"]
        if (-not $taxonCode -and -not $query) {
          Write-JsonResponse -Context $context -StatusCode 400 -Body '{"success":false,"error":"Missing Macaulay Library taxonCode or query"}'
          continue
        }

        if ($taxonCode) {
          $remoteUrl = "https://media.ebird.org/api/v1/search?taxonCode=$([uri]::EscapeDataString($taxonCode))&mediaType=photo&sort=rating_rank_desc&birdOnly=true&count=5"
        } else {
          $remoteUrl = "https://media.ebird.org/api/v1/search?q=$([uri]::EscapeDataString($query))&searchField=species&mediaType=photo&sort=rating_rank_desc&birdOnly=true&count=5"
        }
        $searchResponse = Invoke-MacaulayCurlRequest -RemotePath $remoteUrl -Accept "application/json"
        $searchBytes = @($searchResponse.BodyBytes)
        $results = @()
        if ($searchBytes.Count -gt 0 -and ([string]$searchResponse.ContentType).ToLowerInvariant().Contains("application/json")) {
          try {
            $searchJson = [System.Text.Encoding]::UTF8.GetString([byte[]]$searchBytes) | ConvertFrom-Json
            $results = @(Get-MacaulaySearchResults -Payload $searchJson -TaxonCode $taxonCode -Query $query)
          } catch {
            $results = @()
          }
        }

        if ($results.Count -eq 0 -and -not $taxonCode -and $query) {
          $resolvedTaxonCode = Resolve-MacaulayQueryTaxonCode -Query $query
          if ($resolvedTaxonCode) {
            $catalogUrl = "https://media.ebird.org/catalog?taxonCode=$([uri]::EscapeDataString($resolvedTaxonCode))&mediaType=photo&sort=rating_rank_desc&birdOnly=true"
            $catalogResponse = Invoke-MacaulayCurlRequest -RemotePath $catalogUrl -Accept "text/html"
            $catalogBytes = @($catalogResponse.BodyBytes)
            if ($catalogBytes.Count -gt 0) {
              $catalogHtml = [System.Text.Encoding]::UTF8.GetString([byte[]]$catalogBytes)
              $results = @(Get-MacaulayCatalogSearchResults -Html $catalogHtml)
            }
          }
        }

        if ($results.Count -eq 0) {
          if ($taxonCode) {
            $catalogUrl = "https://media.ebird.org/catalog?taxonCode=$([uri]::EscapeDataString($taxonCode))&mediaType=photo&sort=rating_rank_desc&birdOnly=true"
          } else {
            $catalogUrl = "https://media.ebird.org/catalog?q=$([uri]::EscapeDataString($query))&searchField=species&mediaType=photo&sort=rating_rank_desc&birdOnly=true"
          }
          $catalogResponse = Invoke-MacaulayCurlRequest -RemotePath $catalogUrl -Accept "text/html"
          $catalogBytes = @($catalogResponse.BodyBytes)
          if ($catalogBytes.Count -gt 0) {
            $catalogHtml = [System.Text.Encoding]::UTF8.GetString([byte[]]$catalogBytes)
            $results = @(Get-MacaulayCatalogSearchResults -Html $catalogHtml)
          }
        }

        $resultsJson = ($results | ConvertTo-Json -Depth 5 -Compress)
        if (-not $resultsJson) {
          $resultsJson = "[]"
        }
        Write-JsonResponse -Context $context -StatusCode 200 -Body "{`"results`":$resultsJson}"
        continue
      }

      if ($path -like "/api/media/macaulay/asset/*") {
        if ($request.HttpMethod -ne "GET") {
          Write-JsonResponse -Context $context -StatusCode 405 -Body '{"success":false,"error":"Method not allowed"}'
          continue
        }

        $rawAssetId = $path.Substring("/api/media/macaulay/asset/".Length)
        $assetId = Get-MacaulayAssetId -Value $rawAssetId
        if (-not $assetId) {
          Write-JsonResponse -Context $context -StatusCode 400 -Body '{"success":false,"error":"Invalid Macaulay Library asset id"}'
          continue
        }

        $assetUrl = "https://cdn.download.ams.birds.cornell.edu/api/v1/asset/$assetId/1200"
        $assetResponse = Invoke-MacaulayCurlRequest -RemotePath $assetUrl -Accept "image/jpeg,image/png"
        $assetContentType = ([string]$assetResponse.ContentType).Split(";")[0].ToLowerInvariant()
        if ($assetContentType -notin @("image/jpeg", "image/png")) {
          Write-JsonResponse -Context $context -StatusCode 502 -Body '{"success":false,"error":"Macaulay Library asset was not a supported image"}'
          continue
        }

        Write-ByteResponse -Context $context -StatusCode $assetResponse.StatusCode -BodyBytes $assetResponse.BodyBytes -ContentType $assetContentType
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
