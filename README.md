# BeauBird 观鸟助手

BeauBird 是一个面向观鸟记录查询和浙江鸟种监测的小工具，支持网页版和 Android APK。它把 eBird 区域最近观测、BirdReport 鸟种查询、浙江未解锁鸟种核对、浙江稀有鸟监测集中在同一个界面里。

当前版本：1.0.3

## 主要功能

- eBird 区域记录查询：输入 eBird API Key 和区域代码，查看最近观测记录。
- BirdReport 代理查询：按省、市、区、地点和日期查询 BirdReport 鸟种记录。
- 浙江未解锁鸟种查询：输入 BirdReport 记录用户名，按浙江 588 种名录计算已解锁和未解锁鸟种。
- 未解锁鸟种地点展开：点击鸟种名可加载该鸟种在浙江的公开观测地点。
- 未解锁鸟种导出：可直接导出包含“鸟类名称、目、科”的 CSV 表格。
- 浙江稀有鸟监测：以浙江历史记录次数小于等于 500 为基线，可手动或定时检查指定日期数据。
- Android 内置代理：APK 版内置本地代理，打开后可直接查询 BirdReport。

## 使用方式

### 网页版

直接打开 `index.html` 即可使用页面。  
如果要查询 BirdReport，需要先启动本地代理：

```powershell
.\birdreport-proxy.ps1
```

如果 PowerShell 提示“禁止运行脚本”或 execution policy 限制，优先双击或运行：

```cmd
start-birdreport-proxy.cmd
```

它会用 `-ExecutionPolicy Bypass` 启动同一个本地代理。

代理默认地址是：

```text
http://127.0.0.1:8787
```

页面中的 BirdReport 查询、未解锁鸟种、稀有鸟监测都会使用这个代理。

如果在未解锁鸟种区域点击“导出表格”，会直接导出 `CSV` 文件，字段为“鸟类名称、目、科”。

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

## 未解锁鸟种查询说明

在“未解锁”区域输入 BirdReport 记录用户名，例如：

```text
Lingod
```

查询结果会显示：

- 已解锁鸟种数
- 浙江名录总数
- 未解锁鸟种数
- 按浙江历史记录数排序的缺口列表
- 导出按钮，可直接导出未解锁鸟种 `CSV` 表格

网页端每行保留“地点”按钮；Android 端隐藏该按钮，直接点击鸟种名即可展开公开地点。

## 项目结构

```text
.
├── index.html                 # 主页面
├── script.js                  # 页面逻辑、BirdReport/eBird 查询、缓存与监测逻辑
├── style.css                  # 页面和 Android WebView 样式
├── birdreport-proxy.ps1       # 网页版 BirdReport 本地代理
├── data/
│   ├── zhejiang-birdreport-species.json
│   └── zhejiang-birdreport-species.js
├── tools/                     # 数据和辅助工具
└── android/                   # Android WebView 应用
```

## 版本记录

### 1.0.3

- 修复 BirdReport 代理稳定性：代理改用 `curl.exe` 转发上游请求，避免 `GetRequestStream` 发送失败。
- 将 jQuery、CryptoJS、BirdReport 签名和解码依赖改为本地 `vendor/` 文件，网页和 Android 都不再依赖远程脚本加载。
- 新增 `start-birdreport-proxy.cmd`，PowerShell 执行策略受限时可直接启动本地代理。
- Android 本地服务补充 `vendor/` 资源映射，APK 内可直接加载 BirdReport 查询依赖。
- 未解锁鸟种查询改为紧凑表格展示，减少 Android 页面占用空间。
- 未解锁鸟种支持整体展开 / 隐藏，悬浮按钮固定在模块内，长列表下拉后也能直接隐藏全部鸟种。
- 新增 Lingod 回归测试，验证未解锁鸟种查询结果为 `340/589`。
- 新增 eBird API 2.0 中文说明文档，并生成 Markdown、HTML 和 PDF 版本。
- Android 版本更新为 `versionName 1.0.3`、`versionCode 4`。

### 1.0.2

- BirdReport 查询结果和 eBird 区域结果改为更接近表格的展示方式，便于连续浏览大量记录。
- BirdReport 查询结果支持点击鸟种名称后查看当前筛选条件下的公开地点详情。
- 未解锁鸟种新增“导出表格”功能，可直接导出包含“鸟类名称、目、科”的 CSV 文件。
- 修复未解锁鸟种导出逻辑中排序函数调用错误导致按钮点击无反应的问题。
- Android 导出桥接补充文件保存能力，便于 APK 内直接导出 CSV。
- Android 版本更新为 `versionName 1.0.2`、`versionCode 3`。

### 1.0.1

- 修复未解锁鸟种查询中 `state.unlockedSpeciesCatalog.map is not a function` 的崩溃。
- 修复浙江名录排序调用错误导致 `297 / 0` 的问题。
- 修复旧坏缓存会恢复错误结果的问题。
- 优化 Android 未解锁鸟种列表：隐藏地点按钮，保留点击鸟种名展开地点。
- 增强未解锁鸟种列表的视觉区分，方便肉眼逐条查看。
- Android 版本更新为 `versionName 1.0.1`、`versionCode 2`。

### 1.0.0

- 初始版本。
- 支持 eBird 区域查询、BirdReport 代理查询、浙江未解锁鸟种查询和浙江稀有鸟监测。

## 发版检查清单

每次上传新版本前，同步检查并更新：

- `android/app/build.gradle` 中的 `versionName` 和 `versionCode`
- 本 README 的“当前版本”和“版本记录”
- 运行 `node --check script.js`
- 运行 `.\gradlew.bat :app:assembleDebug`
- 提交代码并打版本标签，例如 `v1.0.3`
