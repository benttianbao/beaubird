# 浙江 BirdReport 爬虫命令手册

下面命令都在项目根目录 `F:\beaubird` 里运行，使用 PowerShell。

## 1. 正式抓取/续跑

第一次抓取、后续补抓新报告、中途停止后继续，都用这一条：

```powershell
node tools/crawl-zhejiang-birdreport.mjs --workers 3
```

说明：

- 默认写入 `data/birdreport-zhejiang.sqlite`
- 默认追加原始流水到 `data/birdreport-zhejiang.jsonl`
- 默认启动 3 个独立会话 worker，可用 `--workers 1` 到 `--workers 5` 调整
- 每个 worker 有独立 Cookie、请求节流状态和验证码文件，例如 `data/birdreport-captcha.worker-01.png`
- 默认断点续跑，会跳过 SQLite 里已有的 `report_id`
- 主线程会先原子占领 `report_id` 并串行写入 SQLite/JSONL，同一运行中不同 worker 不会重复抓取或重复入库
- 默认启用快进续跑：脚本只保存连续完整页水位线，重跑时先扫描首页补新，再从水位线前 5 页并发续跑
- 每份报告会请求官方详情元数据和鸟种表；鸟种表固定携带 `limit: 1500`，不会再只保存前 10 种
- `reports` 同时保存 `point_id`、原始 `location`（`经度,纬度`）、`longitude`、`latitude`，供后续点位预测使用
- 已有报告会自动补上上述 SQLite 列；如需补采旧报告的点位字段，使用一次 `--no-resume` 重新抓取对应范围
- 遇到验证码时，各 worker 使用自己的验证码会话和图片，不与其他 worker 合并等待
- 默认使用 `ml/captcha-recognition/model-finetune1.pkl` 无限自动预测；每次预测或校验失败都会获取该 worker 的新验证码
- BirdReport 返回 429、500、502、503、504 等临时服务错误时会指数退避并持续重试，最长等待间隔为 60 秒，不会越过失败页水位线
- 校验失败的验证码图片会保存到 `ml/captcha-recognition/dataset/yanzhengma_false`，文件名格式为“错误验证码_时间.png”
- 终端和 `crawl_meta.worker_stats_json` 会记录各 worker 的验证码触发次数
- 按一次 `Ctrl+C` 会停止分配新页面，完成当前写入并保存连续水位线；再次运行同一命令即可多 worker 续跑

如果你已经在旧版本脚本里落了很多数据，第一次换新版跑时建议加一次：

```powershell
node tools/crawl-zhejiang-birdreport.mjs --workers 3 --bootstrap-progress-from-db
```

它会按 SQLite 里现有 `reports` 数量初始化水位线。之后正常用第一条命令即可。

## 2. 更慢更稳地续跑

如果被拒绝访问、经常触发验证码，改用这一条：

```powershell
node tools/crawl-zhejiang-birdreport.mjs --workers 1 --max-retries 5 --retry-base-ms 30000
```

如果只是想观察验证码频率，不需要加降速参数；只有你决定主动拉开请求间隔时，再额外加 `--request-delay-ms 1000` 这类参数。

临时网关错误默认无限重试。如果需要限制次数，例如最多尝试 20 次：

```powershell
node tools/crawl-zhejiang-birdreport.mjs --workers 3 --transient-retry-max-attempts 20
```

## 3. 5 个并发抓取

速度更快，但更容易触发验证码：

```powershell
node tools/crawl-zhejiang-birdreport.mjs --workers 5 --max-retries 5 --retry-base-ms 30000
```

5 worker 同时撞上验证码时，会各自获取、预测和校验自己的验证码，互不等待。

## 4. 小样本测试

只抓普通报告 5 份、标红报告 5 份，用来确认环境正常：

```powershell
node tools/crawl-zhejiang-birdreport.mjs --workers 3 --limit-reports 5
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
node tools/crawl-zhejiang-birdreport.mjs --workers 3 --no-resume
```

注意：这会重新抓取已有报告，耗时明显更长，也更容易触发验证码。

## 8. 自定义验证码图片路径

如果想把各 worker 的验证码图片保存到桌面（脚本会自动追加 `.worker-01` 等编号）：

```powershell
node tools/crawl-zhejiang-birdreport.mjs --workers 3 --captcha-path "C:\Users\WJH\Desktop\birdreport-captcha.png"
```

## 9. 自定义自动验证码模型

默认使用：

```text
ml/captcha-recognition/model-finetune1.pkl
```

如果要换成其他 `.pkl` 模型：

```powershell
node tools/crawl-zhejiang-birdreport.mjs --workers 3 --captcha-model-path "ml\captcha-recognition\model-finetune.pkl"
```

如果希望模型一直尝试，不达到次数上限就退回手动输入：

```powershell
node tools/crawl-zhejiang-birdreport.mjs --workers 3 --auto-captcha-max-attempts 0
```

## 10. 遇到验证码就暂停

如果你不想手动输入验证码，而是希望触发验证码后直接暂停：

```powershell
node tools/crawl-zhejiang-birdreport.mjs --no-auto-captcha --no-manual-captcha
```

之后等一段时间，再用正式抓取命令续跑即可。

## 11. 查看脚本全部参数

```powershell
node tools/crawl-zhejiang-birdreport.mjs --help
```

## 12. 关闭快进续跑

如果你想完全保守地从第 1 页重新核对，但仍然跳过已入库报告，可以用：

```powershell
node tools/crawl-zhejiang-birdreport.mjs --workers 3 --no-fast-resume
```

默认会在水位线前重叠检查 5 页。如果你想扩大保护范围，例如重叠 20 页：

```powershell
node tools/crawl-zhejiang-birdreport.mjs --workers 3 --fast-resume-overlap-pages 20
```
