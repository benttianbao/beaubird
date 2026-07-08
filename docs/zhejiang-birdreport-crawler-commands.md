# 浙江 BirdReport 爬虫命令手册

下面命令都在项目根目录 `F:\beaubird` 里运行，使用 PowerShell。

## 1. 正式抓取/续跑

第一次抓取、后续补抓新报告、中途停止后继续，都用这一条：

```powershell
node tools/crawl-zhejiang-birdreport.mjs --manual-captcha --open-captcha
```

说明：

- 默认写入 `data/birdreport-zhejiang.sqlite`
- 默认追加原始流水到 `data/birdreport-zhejiang.jsonl`
- 默认断点续跑，会跳过 SQLite 里已有的 `report_id`
- 默认启用快进续跑：脚本会记住每类报告完整处理到第几页，重跑时先扫描首页补新，再跳到水位线附近继续
- 遇到验证码时，会保存图片到 `data/birdreport-captcha.png`，自动打开图片，然后让你在终端输入验证码
- 终端会显示验证码频率，例如第几次输入提示、距离上次验证码多久、并发请求被合并等待了几次

如果你已经在旧版本脚本里落了很多数据，第一次换新版跑时建议加一次：

```powershell
node tools/crawl-zhejiang-birdreport.mjs --manual-captcha --open-captcha --bootstrap-progress-from-db
```

它会按 SQLite 里现有 `reports` 数量初始化水位线。之后正常用第一条命令即可。

## 2. 更慢更稳地续跑

如果被拒绝访问、经常触发验证码，改用这一条：

```powershell
node tools/crawl-zhejiang-birdreport.mjs --manual-captcha --open-captcha --detail-concurrency 1 --max-retries 5 --retry-base-ms 30000
```

如果只是想观察验证码频率，不需要加降速参数；只有你决定主动拉开请求间隔时，再额外加 `--request-delay-ms 1000` 这类参数。

## 3. 5 个并发抓取

速度更快，但更容易触发验证码：

```powershell
node tools/crawl-zhejiang-birdreport.mjs --manual-captcha --open-captcha --detail-concurrency 5 --max-retries 5 --retry-base-ms 30000
```

5 并发时，如果多个详情请求同时撞上验证码，脚本现在只会打开一次验证码图并等待一次输入，其他请求会等这次验证通过后继续重试。

## 4. 小样本测试

只抓普通报告 5 份、标红报告 5 份，用来确认环境正常：

```powershell
node tools/crawl-zhejiang-birdreport.mjs --manual-captcha --open-captcha --limit-reports 5
```

## 5. 查看当前进度

查看已保存的报告数量和鸟种记录数量：

```powershell
node -e "const { DatabaseSync } = require('node:sqlite'); const db=new DatabaseSync('data/birdreport-zhejiang.sqlite'); console.log(db.prepare('select count(*) reports from reports').get()); console.log(db.prepare('select count(*) observations from observations').get()); db.close();"
```

查看普通报告/标红报告分别保存了多少：

```powershell
node -e "const { DatabaseSync } = require('node:sqlite'); const db=new DatabaseSync('data/birdreport-zhejiang.sqlite'); console.log(db.prepare('select report_kind, count(*) count from reports group by report_kind').all()); db.close();"
```

## 6. 检查标红报告是否过滤干净

标红报告里不应该保存 `is_red_species=1` 的鸟种：

```powershell
node -e "const { DatabaseSync } = require('node:sqlite'); const db=new DatabaseSync('data/birdreport-zhejiang.sqlite'); console.log(db.prepare(\"select count(*) red_saved_in_flagged_reports from observations join reports using(report_id) where reports.report_kind='flagged' and observations.is_red_species=1\").get()); db.close();"
```

正常结果应该是 `0`。

## 7. 强制刷新已有报告

默认续跑会跳过已有报告。如果你怀疑旧报告被用户修改过，想重新抓一遍已有报告，用：

```powershell
node tools/crawl-zhejiang-birdreport.mjs --manual-captcha --open-captcha --no-resume
```

注意：这会重新抓取已有报告，耗时明显更长，也更容易触发验证码。

## 8. 自定义验证码图片路径

如果想把验证码图片保存到桌面并自动打开：

```powershell
node tools/crawl-zhejiang-birdreport.mjs --manual-captcha --open-captcha --captcha-path "C:\Users\WJH\Desktop\birdreport-captcha.png"
```

## 9. 遇到验证码就暂停

如果你不想手动输入验证码，而是希望触发验证码后直接暂停：

```powershell
node tools/crawl-zhejiang-birdreport.mjs --no-manual-captcha
```

之后等一段时间，再用正式抓取命令续跑即可。

## 10. 查看脚本全部参数

```powershell
node tools/crawl-zhejiang-birdreport.mjs --help
```

## 11. 关闭快进续跑

如果你想完全保守地从第 1 页重新核对，但仍然跳过已入库报告，可以用：

```powershell
node tools/crawl-zhejiang-birdreport.mjs --manual-captcha --open-captcha --no-fast-resume
```

默认会在水位线前重叠检查 5 页。如果你想扩大保护范围，例如重叠 20 页：

```powershell
node tools/crawl-zhejiang-birdreport.mjs --manual-captcha --open-captcha --fast-resume-overlap-pages 20
```
