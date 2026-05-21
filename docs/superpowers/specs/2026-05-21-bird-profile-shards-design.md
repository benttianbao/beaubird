# Bird Profile Shards Design

## 背景

BeauBird 1.6 已经把 `all_birds_full.json` / `all_birds_full.js` 改为懒加载，避免阻塞初始页面。但生成预习 PPT 时仍会一次性读取完整鸟类简介数据。当前两份完整数据文件各约 26 MB，在本地网页、Node 站点和 Android WebView 中都会带来加载和打包压力。

本轮优化只调整鸟类简介数据的加载和静态资源组织，不改变现有用户功能、页面流程、PPT 内容规则或 API 返回形状。

## 目标

- 生成 PPT 时优先按所选鸟种加载简介分片，而不是读取完整 26 MB 数据。
- 保持直接打开 `index.html`、Node 登录站点、Android WebView 三种运行方式可用。
- 保留现有完整 `all_birds_full.json` / `all_birds_full.js` 回退路径，降低上线风险。
- 更新测试，覆盖分片生成、懒加载路径、Node 静态资源和 Android assets。

## 非目标

- 不删除或缩减现有 `all_birds_full.json` / `all_birds_full.js`。
- 不改变鸟类预习 PPT 的 UI、筛选逻辑、多选逻辑、Macaulay 图片逻辑或 PPT 版式。
- 不引入构建工具或依赖打包流程。
- 不批量删除文件或目录。

## 数据结构

新增 `data/bird-profiles/` 作为生成产物目录：

- `index.json`：小索引，记录鸟名到分片文件的映射。
- `index.js`：`file://` 直开场景的索引回退脚本，写入浏览器全局变量。
- `shard-000.json`、`shard-001.json` 等：鸟类简介分片。
- `shard-000.js`、`shard-001.js` 等：对应分片的 `file://` 回退脚本。

索引记录以标准化中文鸟名为 key，值至少包含分片文件名和原始鸟名。分片内保留现有简介字段，包括 `name`、`english_name`、`scientific_name`、`overview`、`appearance`、`call`、`habits`、`breeding`、`identification`、`protection`、`distribution`、`other`。字段名不做破坏性迁移。

分片大小以记录数为基准，默认每片约 200 条，便于本地文件、Node 静态服务和 Android assets 统一处理。

## 加载流程

`script.js` 中生成 PPT 前的简介加载改为两层策略：

1. 根据当前选中的鸟种名称加载 `data/bird-profiles/index.json`。
2. 从索引中找出命中的分片文件，只请求这些分片。
3. 用加载到的简介记录构建现有 `window.BeauBirdPrepPpt.buildBirdProfileIndex()` 所需的 Map。
4. 如果索引或分片加载失败，并且当前环境允许，则回退到现有完整 `all_birds_full.json`。
5. 如果本地 `file://` 读取 JSON 失败，则继续回退到现有完整 `all_birds_full.js`。

为支持直接打开 `index.html`，JSON 路径失败时新增 JS 分片回退：

1. 加载 `data/bird-profiles/index.js`。
2. 根据索引按需加载对应的 `shard-*.js`。
3. 从全局缓存中取出命中的简介记录。

如果分片路径和完整数据路径都失败，继续显示现有错误提示，不新增用户必须理解的新错误状态。

## 静态资源

Node 站点：

- 允许访问 `data/bird-profiles/index.json`、`index.js`、`shard-*.json`、`shard-*.js`。
- 保持登录保护和现有静态资源白名单风格。

Android WebView：

- Gradle assets include 增加 `data/bird-profiles` 目录下的索引和分片。
- `BeauBirdLocalServer.kt` 增加对应路径映射和 content type。
- 不改变 Android 内置 BirdReport 服务行为。

## 测试

新增 `tools/test-bird-profile-shards.js`，覆盖：

- 生成脚本能从 `all_birds_full.json` 产出索引和分片。
- 索引能按标准化鸟名找到对应分片。
- 分片内保留 PPT 生成需要的原字段。
- JS 回退产物写入预期全局变量。

更新 `tools/test-bird-prep-ui.js`，覆盖：

- `script.js` 包含分片索引和分片加载路径。
- `index.html` 仍不在首屏加载完整 `all_birds_full.js`。
- Node 站点静态资源规则包含 `data/bird-profiles`。
- Android assets 和 content type 包含分片资源。

保留并运行既有检查：

- `node --check script.js`
- `node tools\test-bird-profile-shards.js`
- `node tools\test-bird-prep-ui.js`
- `node tools\test-bird-prep-ppt-core.js`
- `node server\site\site.test.js`

## 风险与回退

主要风险是索引命名、分片路径或 `file://` 回退脚本加载不一致，导致生成 PPT 时找不到简介。通过保留完整数据回退、增加单元测试和继续复用 `buildBirdProfileIndex()` 来降低风险。

如果分片上线后出现问题，可以只把 `script.js` 的优先加载路径切回完整数据路径；完整 `all_birds_full.json` / `all_birds_full.js` 仍保留，因此不需要恢复大文件。
