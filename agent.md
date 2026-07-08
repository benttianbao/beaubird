# BeauBird Agent Guide

## 项目速览

BeauBird 是一个观鸟助手项目，包含可直接打开的网页、Node 登录站点、企业微信稀有鸟机器人、BirdReport 本地代理和 Android WebView 应用。核心功能围绕 BirdReport 查询、浙江稀有鸟监测、未解锁鸟种统计、eBird 当季分析和鸟类预习 PPT。

主要入口：
- `index.html`、`script.js`、`style.css`：网页主界面、交互逻辑和样式。
- `ebird-seasonal-core.js`：eBird 浙江当季分析核心逻辑。
- `bird-prep-ppt-core.js`：鸟类预习 PPT 匹配和 `.pptx` 生成核心逻辑。
- `birdreport-proxy.ps1`：本地 BirdReport 代理，默认 `http://127.0.0.1:8787`。
- `server/site/`：Node 登录站点、后台管理、同源 BirdReport 代理。
- `server/wecom-rare-bot/`：企业微信浙江稀有鸟记录机器人。
- `android/`：Android WebView 包装，会同步根目录网页资源到 APK assets。
- `tools/`：测试、数据刷新和辅助脚本。

## 必守约束

- 禁止批量删除文件或目录。
- 不要使用 `del /s`、`rd /s`、`rmdir /s`、`Remove-Item -Recurse`、`rm -rf`。
- 如需删除文件，只能一次删除一个明确路径的文件，例如 `Remove-Item "C:\path\to\file.txt"`。
- 如果需要批量删除文件，应停止操作并询问用户，让用户手动删除。
- 不要提交真实密钥、账号、`.env`、SQLite 数据库或本地构建产物。
- 当前工作树可能已有用户改动，修改前先看 `git status -sb`，不要回滚无关变更。

## 运行与配置

本地网页：
- 直接打开 `index.html`。
- BirdReport 相关功能需要先运行 `.\birdreport-proxy.ps1`，或在 PowerShell 执行策略受限时运行 `start-birdreport-proxy.cmd`。

Node 登录站点：
- 需要 Node.js 24+，因为 `server/site` 使用内置 `node:sqlite`。
- 复制配置：`Copy-Item server\site\.env.example server\site\.env`。
- 创建管理员：`node server\site\cli.js create-admin --username admin`。
- 启动：`.\start-site.cmd`，默认 `http://127.0.0.1:3000`。

企业微信机器人：
- 复制配置：`Copy-Item server\wecom-rare-bot\.env.example server\wecom-rare-bot\.env`。
- 启动：`start-wecom-rare-bot.cmd` 或 `node server\wecom-rare-bot\server.js`。
- 默认监听 `127.0.0.1:8791`。

Android：
- 需要 JDK 17 和 Android/Gradle 环境。
- 构建前会通过 `syncWebAssets` 同步根目录网页资源、`vendor/` 和 `data/` 文件。
- 常用构建命令：

```powershell
cd android
$env:GRADLE_USER_HOME='F:\beaubird\.gradle-home'
.\gradlew.bat :app:assembleDebug
```

## 云端部署地址

- 默认云服务器公网地址：`120.26.231.157`。
- 以后给用户生成云端部署、SSH、Nginx、回调地址或环境变量命令时，直接使用这个地址，不要使用 `example.com`、`your-server` 或其他占位符。
- 企业微信机器人云端配置里，`WECOM_PUBLIC_BASE_URL` 默认写成 `http://120.26.231.157`，用于生成 BirdReport 验证码图片链接。

## 常用验证

优先运行与改动相关的最小检查：

```powershell
node --check script.js
node tools\test-bird-prep-ppt-core.js
node tools\test-bird-prep-ui.js
node tools\test-birdreport-proxy-default.js
node tools\test-ebird-seasonal-prediction.js
node server\site\cli.test.js
node server\site\site.test.js
```

注意：
- `tools\test-site-birdreport-lingod.js` 会访问真实 BirdReport 上游，只在用户明确需要真实联调时运行。
- Android APK 构建比普通 Node 测试更重，只在 Android 相关改动或发布检查时运行。

## 开发约定

- 这个仓库没有统一 `package.json`，多数检查是直接执行独立 Node 脚本。
- Node 代码主要使用 CommonJS 和内置模块，优先沿用现有风格。
- 浏览器和 Node 共用的核心模块采用 UMD 风格，例如 `ebird-seasonal-core.js` 和 `bird-prep-ppt-core.js`。
- `script.js` 很大，改动时尽量局部、可回归；能放到核心模块并测试的逻辑，优先放到核心模块。
- UI 改动要同时考虑桌面网页和 Android WebView，避免依赖远程前端资源。
- BirdReport 相关请求分为本地代理 `127.0.0.1:8787` 和 Node 站点同源 `/api/birdreport/*` 两种路径，改动时都要留意。
- 修改鸟类数据或浙江名录时，确认 `.json`、浏览器可读 `.js` 数据和相关测试是否需要同步更新。

## 发布前检查

发布版本时同步检查：
- `README.md` 当前版本和版本记录。
- `android/app/build.gradle` 的 `versionName` 和 `versionCode`。
- `server/site/.env.example` 是否仍与服务端默认值一致。
- README 中列出的本地测试。
- 如发布 Android APK，运行 `.\gradlew.bat :app:assembleDebug`。
## 2026-05-14 Macaulay Library 鸟种预习 PPT 调试记录

### 已实现改动

- 鸟种预习 PPT 已从 iNaturalist 方案切换为 Macaulay Library 优先方案。
- 前端 `index.html` / `script.js` / `style.css` 增加：
  - “添加 Macaulay Library 图片”开关，默认开启。
  - “我确认这些图片用于自己有权使用的 PPT，并保留 Macaulay Library 署名”确认框。
  - 生成 PPT 时按鸟种逐个匹配图片，进度文案形如“正在匹配 Macaulay 图片 1/1：白腹凤鹛”。
  - 单个鸟种图片搜索或下载失败会跳过，不中断整份 PPT。
- `bird-prep-ppt-core.js` 已支持 slide.photo：
  - 写入 `ppt/media/imageN.*`。
  - 写入 slide image relationship。
  - 写入 image content type。
  - 在左侧图片区嵌入图片，图片下方写 Macaulay Library、ML 编号、摄影者/清单和来源链接。
- `server/site/app.js` 增加同源媒体代理：
  - `GET /api/media/macaulay/search?taxonCode=...`
  - `GET /api/media/macaulay/search?q=...`
  - `GET /api/media/macaulay/asset/:mlId`
- `birdreport-proxy.ps1` 增加本地媒体代理：
  - `GET /api/media/macaulay/search?taxonCode=...`
  - `GET /api/media/macaulay/search?q=...`
  - `GET /api/media/macaulay/asset/:mlId`
- README 已补充 Macaulay 图片的权利确认和署名说明。

### 已加测试

- `tools/test-bird-prep-ppt-core.js` 覆盖图片媒体文件、slide rel、content type、`<p:pic>` 和署名文本。
- `tools/test-bird-prep-ui.js` 覆盖 Macaulay 图片开关和确认提示。
- `server/site/site.test.js` 覆盖 Node 站点 Macaulay search 和 asset 代理。
- `tools/test-birdreport-proxy-default.js` 覆盖本地 PowerShell 代理的 Macaulay endpoint，并追加了 catalog redirect/空响应回归检查。

### 已通过验证

```powershell
node --check script.js
node --check bird-prep-ppt-core.js
node --check server\site\app.js
node tools\test-bird-prep-ppt-core.js
node tools\test-bird-prep-ui.js
node tools\test-birdreport-proxy-default.js
node server\site\site.test.js
$script = Get-Content -Raw -LiteralPath '.\birdreport-proxy.ps1'; [void][scriptblock]::Create($script)
```

`server/site/site.test.js` 会打印 Node SQLite experimental warning，属于现有测试提示，不代表失败。

### 今天复现到的现象

用户本地已启动代理后，按以下条件生成 PPT，仍然没有下载/嵌入图片：

- 省：浙江省
- 市：杭州市
- 区：西湖区
- 日期：2026-05-13
- 鸟种：列表第一个
- 勾选 Macaulay Library 图片开关和署名确认

用同样条件通过 BirdReport 代理查到，排序后的第一个鸟种是：

```text
白腹凤鹛
latinname: Erpornis zantholeuca
taxon_id: 4666
recordcount: 1
```

页面逻辑会 fallback 到：

```text
/api/media/macaulay/search?q=Erpornis%20zantholeuca
```

因为本地没有 eBird API Key 时，无法预先通过 eBird taxonomy 把 `latinname` 映射成 `taxonCode`，所以会用 q 搜索。

### 今天定位到并已修的一个问题

本地 PowerShell 代理原先复用 `Invoke-BirdreportCurlRequest`，但 Macaulay catalog 请求会发生 redirect；没有 `--location` 时容易拿到空 body。空 body 又会触发：

```text
使用“1”个参数调用“GetString”时发生异常:“数组不能为空。参数名: bytes”
```

已修：

- `Invoke-BirdreportCurlRequest` 增加 `[switch] $FollowRedirects`。
- `Invoke-MacaulayCurlRequest` 调用时传 `-FollowRedirects`。
- search endpoint 对空 `BodyBytes` 返回 `{"results":[]}`，不再抛 500。

注意：用户后来重新试了功能仍然有问题，所以这个修复可能只是解决了其中一层，明天还要继续查真实页面/真实代理链路。

### 明天优先排查

1. 让用户先重启本地代理，确认运行的是最新 `birdreport-proxy.ps1`。
2. 直接访问或用命令检查：

```powershell
Invoke-WebRequest -UseBasicParsing "http://127.0.0.1:8787/api/media/macaulay/search?q=Erpornis%20zantholeuca"
```

期望不是 500，且最好有 `results`。

3. 如果 `results: []`，说明 Macaulay 当前 catalog HTML 解析器抓不到真实 asset；需要查看跳转后的真实 HTML/页面状态，可能要改为从页面内 JSON/state、asset API、或更可靠的 Macaulay/eBird 媒体接口解析。
4. 如果 search 有结果但 PPT 没图，检查 `/api/media/macaulay/asset/<id>` 的 status、content-type、body size；再检查 `script.js` 的 `readImageDimensions` 和生成出的 `.pptx` 是否含 `ppt/media/image1.*`。
5. 尽量用浏览器 devtools/Chrome 插件复现页面。今天 `@chrome` / browser-use 通道连接超时；如果继续失败，可以临时用 Node/PowerShell 直接打代理接口补证据。

## 2026-05-14 Macaulay 图片下载失败后续修复

用户再次反馈“还是无法下载图片”后，继续定位到真正的失败点：

- Macaulay catalog/q 搜索不可靠，`q=Erpornis zantholeuca` 会被页面重定向并丢失 q，返回泛化 catalog。
- 正确命中白腹凤鹛需要 eBird taxon code：`whbyuh1`。
- 当前 eBird taxonomy endpoint 可无 token 访问，因此前端不应在没有 eBird API Key 时直接跳过 taxonomy 匹配。
- Macaulay JSON 里真实可下载图片地址是 `https://cdn.download.ams.birds.cornell.edu/api/v1/asset/<assetId>/1200`。
- 之前实现用的是 `api/v2/asset/<assetId>/default/preview`，真实请求返回 404 XML，所以图片下载失败。

已修：

- `script.js`
  - `loadBirdPrepMacaulayTaxonomyBySciName` 不再要求 eBird API Key。
  - `fetchBirdPrepEbirdTaxonomy(apiKey)` 只有在 apiKey 存在时才加 `X-eBirdApiToken` header。
- `server/site/app.js`
  - Macaulay search 改用 `https://media.ebird.org/api/v1/search?...&count=5` JSON。
  - search 结果从 `results.content` 规范化出 `assetId`、`userDisplayName`、`rating`、`eBirdChecklistId`、`largeUrl/mediaUrl`。
  - asset 下载改用 `https://cdn.download.ams.birds.cornell.edu/api/v1/asset/<assetId>/1200`。
  - q fallback 会按 sciName/commonName 精确过滤，避免错误嵌入泛化搜索返回的其他鸟种图片。
- `birdreport-proxy.ps1`
  - 本地 Macaulay search 同样改用 `api/v1/search` JSON。
  - 本地 asset 下载同样改用 `api/v1/asset/<assetId>/1200`。
  - 增加 speciesCode/query 过滤逻辑，避免 q fallback 错配。
- 测试已同步更新：
  - `server/site/site.test.js`
  - `tools/test-birdreport-proxy-default.js`
  - `tools/test-bird-prep-ui.js`

真实链路 smoke test 已成功：

```text
speciesCode: whbyuh1
assetId: 574811651
photographer: Parthasarathi Chakrabarti
downloaded imageBytes: 107516
generated pptxBytes: 130657
PPT contains: ppt/media/image1.jpg
slide rel points to: media/image1.jpg
slide XML contains: <p:pic> and ML574811651
```

已通过验证：

```powershell
node --check script.js
node --check bird-prep-ppt-core.js
node --check server\site\app.js
node tools\test-bird-prep-ppt-core.js
node tools\test-bird-prep-ui.js
node tools\test-birdreport-proxy-default.js
node server\site\site.test.js
$script = Get-Content -Raw -LiteralPath '.\birdreport-proxy.ps1'; [void][scriptblock]::Create($script)
```

注意：当前工具环境里 `@chrome` / browser-use 连接仍然超时，且 PowerShell `HttpListener` 在沙箱内报 `Operation is not supported on this platform`，所以页面级点击流程没有通过 Chrome 自动化完成；但真实外部网络链路和 PPT 文件内部结构已经验证成功。用户本地使用前需要重启本地代理，确保运行的是最新 `birdreport-proxy.ps1`。
