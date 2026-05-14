# BeauBird 观鸟助手

BeauBird 是一个面向观鸟记录查询、浙江鸟种监测和鸟类预习的轻量工具。项目同时提供可直接打开的网页版本、Android WebView APK，以及带登录和后台管理的 Node 站点版本。

当前版本：1.4

## 主要功能

- eBird 区域记录查询：输入 eBird API Key 和区域代码，查看最近观测记录。
- eBird 浙江当季分析：固定使用 `CN-33`，按目标日期前后窗口统计多年历史记录，推算当季可能出现的鸟种。
- BirdReport 记录查询：按省、市、区、地点和日期查询 BirdReport 鸟种记录。
- 鸟类预习 PPT：按地区和日期范围查询鸟种，支持搜索、多选和生成浏览器端 `.pptx` 课件。
- 预习鸟种过滤：可输入 BirdReport 用户名，只保留该用户尚未解锁的鸟种用于预习。
- 浙江未解锁鸟种查询：按浙江名录统计某个 BirdReport 用户已解锁和未解锁鸟种。
- 未解锁鸟种地点展开：点击鸟种名可加载该鸟种在浙江的公开观测地点。
- 未解锁鸟种导出：导出包含“鸟类名称、目、科”的 CSV 表格。
- 浙江稀有鸟监测：以浙江历史记录次数小于等于 500 为基线，手动或定时检查指定日期数据。
- Android 内置代理：APK 版内置本地服务，可直接查询 BirdReport。
- Node 站点登录：用账号系统保护 BeauBird 页面，并通过同源 API 代理 BirdReport 请求。

## 使用方式

### 网页版

直接打开 `index.html` 即可使用页面。

如果需要查询 BirdReport，先启动本地代理：

```powershell
.\birdreport-proxy.ps1
```

如果 PowerShell 提示禁止运行脚本或受 execution policy 限制，可以运行：

```cmd
start-birdreport-proxy.cmd
```

本地代理默认地址：

```text
http://127.0.0.1:8787
```

页面中的 BirdReport 查询、未解锁鸟种、稀有鸟监测和预习 PPT 都会使用这个代理。直接双击打开本地页面时，代理地址使用 `http://127.0.0.1:8787`；部署到 Node 站点后，网页端默认使用当前站点同源 `/api/birdreport/*` 代理。

### Node 登录站点

Node 站点把 BeauBird 网页放到一个本地服务后面，统一处理登录、会话、后台管理和 BirdReport 同源代理。它需要 Node.js 24 或更新版本，因为服务端使用内置 `node:sqlite`。

复制并按需调整配置：

```powershell
Copy-Item server\site\.env.example server\site\.env
```

默认配置：

```text
BEAUBIRD_SITE_HOST=127.0.0.1
BEAUBIRD_SITE_PORT=3000
BEAUBIRD_SITE_DATABASE=data/site.sqlite
BEAUBIRD_SITE_SECURE_COOKIES=0
```

创建第一个管理员：

```powershell
node server\site\cli.js create-admin --username admin
```

启动站点：

```powershell
.\start-site.cmd
```

默认访问地址：

```text
http://127.0.0.1:3000
```

站点功能：

- 未登录访问 `/` 会跳转到 `/login`。
- 管理后台地址为 `/admin`，仅 `admin` 角色可访问。
- 管理员可新增用户、禁用或启用用户、重置临时密码。
- 新用户和被重置密码的用户，下一次登录必须先修改密码。
- 登录失败按 IP 和用户名计数，连续失败会短时锁定。
- BirdReport 请求走同源 `/api/birdreport/*`，浏览器不再需要访问服务器自己的 `127.0.0.1:8787`。

数据文件默认写入 `data/site.sqlite`，以及 SQLite 的 `data/site.sqlite-*` 辅助文件。这些文件已在 `.gitignore` 中忽略，不会提交到 Git。

### Ubuntu + Nginx 部署

建议两个 Node 服务都只监听本机地址：

```text
BeauBird 站点：127.0.0.1:3000
企业微信机器人：127.0.0.1:8791
```

公网只开放 Nginx 的 `80/443`。示例配置见 `nginx/site-auth-ubuntu.conf`：

- `/`、`/login`、`/admin`、`/api/*` 转发到 `http://127.0.0.1:3000`
- `/wecom/rare-bot` 转发到 `http://127.0.0.1:8791/wecom/rare-bot`
- `/site/health` 由网站服务响应
- `/wecom/health` 转发到机器人服务的 `/health`

启用 HTTPS 后，把 `server/site/.env` 中的 `BEAUBIRD_SITE_SECURE_COOKIES` 设为 `1`。

### Android APK

Android 版会自动启动应用内代理，不需要手动运行 `birdreport-proxy.ps1`。

构建 Debug APK：

```powershell
cd android
$env:GRADLE_USER_HOME='F:\beaubird\.gradle-home'
.\gradlew.bat :app:assembleDebug
```

构建产物：

```text
android/app/build/outputs/apk/debug/app-debug.apk
```

## 鸟类预习 PPT

在“预习 PPT”区域中，先确认代理地址：

- 本地直接打开页面：`http://127.0.0.1:8787`
- Node 站点：当前站点地址，同源请求 `/api/birdreport/*`

然后选择省份、城市、可选区县、可选地点和日期范围，点击“查询地区鸟种”。结果会进入可搜索多选列表，可用“全选当前列表”或逐项勾选决定要生成的鸟种。

可选输入 BirdReport 用户名后，页面会查询该用户已解锁鸟种，并从预习列表中排除这些鸟种。如果查询用户记录失败，页面会保留未过滤结果并给出提示。

生成 PPT 时会用 BirdReport 返回的中文鸟名精确匹配 `all_birds_full.json` 中的 `name` 字段。匹配成功的鸟种会生成一页 16:9 幻灯片，左侧为图片占位区，右侧最上方显示简介，下面包含外形、识别、习性生境、分布、繁殖和叫声摘要；没有本地简介的鸟种会被跳过，并在页面提示中列出。

可选勾选“添加 Macaulay Library 图片”。页面会通过代理按鸟种学名 / eBird taxon code 查询 Macaulay Library，每个鸟种最多嵌入 1 张照片，并在幻灯片中保留 ML 编号、摄影者和来源链接。Macaulay Library 媒体通常需要确认使用权或授权；生成前需勾选确认，未找到图片或下载失败时会保留原图片占位区。

为了支持直接双击打开 `index.html`，项目同时提供自动生成的 `all_birds_full.js`。页面会优先懒加载该 JS 全局数据，失败时再回退读取 JSON。

## 未解锁鸟种查询

在“未解锁”区域输入 BirdReport 记录用户名，例如：

```text
1234
```

查询结果会显示：

- 已解锁鸟种数
- 浙江名录总数
- 未解锁鸟种数
- 按浙江历史记录数排序的缺口列表
- 导出按钮，可导出未解锁鸟种 CSV 表格

网页版每行保留“地点”按钮；Android 端隐藏该按钮，直接点击鸟种名即可展开公开地点。

## eBird 浙江当季分析

在 eBird 模块的“浙江当季可能出现鸟种”中，选择目标日期、历史年份数和前后天数后点击分析。功能固定使用 `CN-33`，会读取多年同日期窗口的历史记录，并结合最近 30 天浙江记录标记是否已经确认出现。

默认参数：

- 历史年份：10 年
- 日期窗口：目标日期前后 7 天
- 区域：浙江 `CN-33`

结果基于 eBird 历史提交记录推算出现可能性，不代表未列出的鸟种不会出现，也不会写入个人记录。

## 项目结构

```text
.
├── index.html                      # 主页面
├── script.js                       # 页面逻辑、BirdReport/eBird 查询、缓存和监测逻辑
├── style.css                       # 页面和 Android WebView 样式
├── ebird-seasonal-core.js          # eBird 浙江当季分析逻辑
├── bird-prep-ppt-core.js           # 鸟类预习 PPT 匹配和 PPTX 生成逻辑
├── all_birds_full.json             # PPT 鸟类简介原始数据
├── all_birds_full.js               # PPT 浏览器直读数据
├── birdreport-proxy.ps1            # 网页版本地 BirdReport 代理
├── start-birdreport-proxy.cmd      # 本地代理启动脚本
├── start-site.cmd                  # Node 站点启动脚本
├── data/                           # 浙江名录和运行数据目录
├── docs/site-auth-admin.md         # 站点登录和后台管理说明
├── nginx/site-auth-ubuntu.conf     # Ubuntu + Nginx 示例配置
├── server/site/                    # 登录站点、后台管理和同源代理
├── server/wecom-rare-bot/          # 企业微信稀有鸟机器人
├── tools/                          # 数据、测试和辅助工具
├── vendor/                         # 本地前端依赖
└── android/                        # Android WebView 应用
```

## 测试

常用本地检查：

```powershell
node --check script.js
node tools\test-bird-prep-ppt-core.js
node tools\test-bird-prep-ui.js
node tools\test-birdreport-proxy-default.js
node tools\test-ebird-seasonal-prediction.js
node server\site\cli.test.js
node server\site\site.test.js
```

可选真实 BirdReport 联调：

```powershell
node tools\test-site-birdreport-lingod.js
```

该联调会访问真实上游服务，不作为离线提交前的必跑检查。

## 版本记录

### 1.4

- 新增带登录保护的 Node 站点，支持登录、后台用户管理、强制改密和登录失败短时锁定。
- 新增同源 BirdReport 代理，部署到站点后网页端默认使用 `/api/birdreport/*`。
- 新增 Ubuntu + Nginx 示例配置，网站和企业微信机器人可共用公网域名。
- 鸟类预习 PPT 支持区县、地点和可选用户名过滤，便于只预习某个用户未解锁的鸟种。
- 鸟类预习 PPT 改用 `all_birds_full.json` / `all_birds_full.js`，每页右侧最上方显示鸟种简介，并移除旧版 `china_bird_results` 数据文件。
- 鸟类预习 PPT 支持可选嵌入 Macaulay Library 图片，生成时保留 ML 编号、摄影者和来源链接。
- Node 站点静态资源白名单支持 `all_birds_full` 数据文件，修复云端生成 PPT 时简介数据 404 的问题。
- 鸟类简介数据改为懒加载，避免阻塞初始页面。
- 新增站点、代理默认值、PPT 工作台、Macaulay 图片代理和 eBird 当季分析的本地测试。

### 1.0.3

- 修复 BirdReport 代理稳定性：代理改用 `curl.exe` 转发上游请求，避免 `GetRequestStream` 发送失败。
- 将 jQuery、CryptoJS、BirdReport 签名和解码依赖改为本地 `vendor/` 文件，网页和 Android 都不再依赖远程脚本加载。
- 新增 `start-birdreport-proxy.cmd`，PowerShell 执行策略受限时可直接启动本地代理。
- Android 本地服务补充 `vendor/` 资源映射，APK 内可直接加载 BirdReport 查询依赖。
- 未解锁鸟种查询改为紧凑表格展示，减少 Android 页面占用空间。
- 未解锁鸟种支持整体展开和隐藏，长列表下拉后也能直接隐藏全部鸟种。
- 新增 Lingod 回归测试，验证未解锁鸟种查询结果为 `340/589`。
- 新增 eBird API 2.0 中文说明文档，并生成 Markdown、HTML 和 PDF 版本。
- Android 版本更新为 `versionName 1.0.3`、`versionCode 4`。

### 1.0.2

- BirdReport 查询结果和 eBird 区域结果改为更接近表格的展示方式，便于连续浏览大量记录。
- BirdReport 查询结果支持点击鸟种名称后查看当前筛选条件下的公开地点详情。
- 未解锁鸟种新增“导出表格”功能，可导出包含“鸟类名称、目、科”的 CSV 文件。
- 修复未解锁鸟种导出逻辑中排序函数调用错误导致按钮点击无反应的问题。
- Android 导出桥接补充文件保存能力，便于 APK 内直接导出 CSV。
- Android 版本更新为 `versionName 1.0.2`、`versionCode 3`。

### 1.0.1

- 修复未解锁鸟种查询中 `state.unlockedSpeciesCatalog.map is not a function` 的崩溃。
- 修复浙江名录排序调用错误导致 `297 / 0` 的问题。
- 修复旧坏缓存会恢复错误结果的问题。
- 优化 Android 未解锁鸟种列表：隐藏地点按钮，保留点击鸟种名展开地点。
- 增强未解锁鸟种列表的视觉区分，方便逐条查看。
- Android 版本更新为 `versionName 1.0.1`、`versionCode 2`。

### 1.0.0

- 初始版本。
- 支持 eBird 区域查询、BirdReport 代理查询、浙江未解锁鸟种查询和浙江稀有鸟监测。

## 发布检查清单

每次上传新版本前，同步检查并更新：

- `android/app/build.gradle` 中的 `versionName` 和 `versionCode`
- README 的“当前版本”和“版本记录”
- `server/site/.env.example` 是否仍与服务端默认值一致
- 运行 `node --check script.js`
- 运行 README “测试”章节中的本地测试命令
- 如发布 Android APK，运行 `.\gradlew.bat :app:assembleDebug`
- 提交代码并按需要打版本标签，例如 `v1.4`
