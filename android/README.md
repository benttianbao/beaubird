# BeauBird Android

这个目录把当前仓库根目录下的 `index.html`、`style.css`、`script.js` 打进 Android 应用，同时在应用内启动一个本地 `127.0.0.1:8787` 服务：

- `GET /`、`/index.html`、`/style.css`、`/script.js` 直接返回内置页面资源
- `POST /api/birdreport/*` 由应用代发到 BirdReport
- 页面继续沿用现有前端逻辑，所以桌面版和 APK 版共用同一套查询界面

## 构建方式

1. 安装 JDK 17。
2. 安装 Android Studio（推荐）或本机 Gradle 8.x + Android SDK。
3. 用 Android Studio 打开 [android](/f:/beaubird/android)。
4. 等待同步后执行 `Build > Build Bundle(s) / APK(s) > Build APK(s)`。

如果你用命令行并且本机已经有 Gradle，可在 [android](/f:/beaubird/android) 目录执行：

```powershell
gradle assembleDebug
```

生成的调试包默认在：

```text
android/app/build/outputs/apk/debug/app-debug.apk
```

## 说明

- 当前这个开发环境里没有安装 `java`、`gradle` 和 Android SDK，所以我这次已经把 Android 工程和代理逻辑落到仓库里，但还没法在这里直接产出最终 APK。
- 如果你希望我继续把“实际 APK 编译”也做完，我可以下一步继续帮你补齐本机构建链并尝试出包。
