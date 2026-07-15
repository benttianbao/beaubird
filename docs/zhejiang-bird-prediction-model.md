# 浙江鸟种时空检出率模型

## 口径

模型输出定义为：一份与输入日期、地点相似的典型完整 BirdReport 清单中，某鸟种被记录到的历史概率。它不是生态学上的绝对存在概率，也不预测数量、小时级活动或未来天气变化。

首版 champion 是分层经验贝叶斯模型。日期使用 365 天循环核平滑，空间依次使用 `point_id → H3 r7 → H3 r6 → 区县 → 市 → 浙江省`；样本支持不足时自动回退，并返回实际层级、有效清单数、观察者数、支持年份、90% 区间和置信等级。正向与反向查询复用同一概率函数。

## 固定训练快照

当前 v1 固定使用：

- 快照：`data/prediction-snapshots/zhejiang-v1-20260715.sqlite`
- SHA-256：`92602be9b9c3aeb3d7c6cf966c459710a5a9bf6bc078e604a3805ab05fc0b16a`
- 数据日期：2008-07-17 至 2026-07-15
- 源报告：87,107；源鸟种明细：1,324,993；鸟种目录：589
- 86,552 份 normal 报告全部逐份完整
- 555 份 flagged 报告中，513 份满足“保存有效鸟种数 + 被剔除错误鸟种数 = 申报数”并可进入训练
- 训练同时使用完整 normal 报告，以及 flagged 报告内未标红、`outside_type != 1` 的有效鸟种
- 有效经纬度覆盖率 98.457%；原始 BD-09 转换为 WGS84 后计算 H3

爬虫继续运行不会改变此快照。新增报告只进入下一版快照与模型。

## 数据权重与偶发聚集

- 同一观察者、同一天、同一局部网格的总权重不超过 1。
- 生产统计以最近五年作为地方层训练窗口，并按三年半衰期降低旧清单权重；更早记录只参与省级和长期先验。
- 每个时间外推折按该折的 `Y-01-01` 重新计算半衰期和最近五年窗口；验证清单只做观察者/日期/网格限权，不做时间衰减。
- 正式发布回测使用全部折内达标鸟种的原始检出权重，不读取全量 `vagrant_candidate`，也不使用事件封顶，防止验证集参与候选标签判定。
- 生产阶段另行识别“偶发/追鸟聚集候选”：同鸟种记录按观察者×日期×H3 r7 去重，同格或一环相邻且间隔不超过三天的链式记录合并为事件；最大事件占比至少 80%，或仅一个支持年份时标记候选。仅候选鸟的单事件正例训练权重封顶为 1，并隐藏稳定精确概率。

“偶发/追鸟聚集候选”是数据模式标签，不等价于生态学上的迷鸟认定。

## 校准与发布门槛

- 核宽度从 7、14、21、28 天中，只用最终留出年前的时间折按 Brier 选择。
- 分层 Beta 先验强度按空间层级和鸟种流行度在训练折内选择。
- 独立正例至少 200：逐鸟种 beta calibration；30–199：按流行度共享校准器；少于 30：不展示伪精确百分比。
- 空间折按 H3 r6 整块留出并隔离一环；观察者折按观察者 ID 分组；每个外层折都只用外层训练部分重新选择带宽、先验和校准器。
- 时间、空间、观察者三类 Brier Skill 都必须严格大于 0；任一缺失、为 0 或负数均 no-go。
- 另外检查常见鸟/分组 ECE、Recall@20 和反向 NDCG@10。详细阈值与实际指标只认模型旁车 `.report.json` 中的 `releaseQuality`。

点位漂移是固定快照上的目标无关坐标质量过滤，不使用鸟种标签，但没有在每个留出折内重新拟合。报告中以 `fixed_snapshot_coordinate_qc_target_independent_not_refit_per_fold` 明示该限制。

## 构建与测试

复用已固定快照构建，不连接网站、不切换线上模型指针：

```powershell
node --max-old-space-size=8192 tools\build-zhejiang-prediction-model.js `
  --source data\prediction-snapshots\zhejiang-v1-20260715.sqlite `
  --source-is-snapshot `
  --snapshot data\prediction-snapshots\zhejiang-v1-20260715.sqlite `
  --output data\prediction-models\zhejiang-v1-20260715.sqlite `
  --model-version zhejiang-v1-20260715 `
  --no-publish `
  --confirm-coordinate-system bd09
```

测试：

```powershell
node --test tools\test-vagrant-events.js tools\test-zhejiang-prediction-model.js
```

构建完成后应同时生成：

- `zhejiang-v1-20260715.sqlite`
- `zhejiang-v1-20260715.sqlite.sha256`
- `zhejiang-v1-20260715.sqlite.report.json`
- `zhejiang-v1-20260715.sqlite.report.json.sha256`

公共模型会在 `VACUUM` 前删除报告 ID、观察者哈希、训练明细和精确事件网格表；运行制品只保留聚合统计、校准参数与正反向索引。

## 天气与 challenger

浙江历史天气可以从 CMA、ERA5-Land 或 NASA POWER 等来源补充，但首版 champion 不纳入天气。原因是查询未来十二个月季节窗口时无法获得未来实况天气，直接用历史实况训练会造成训练—服务偏移。后续天气模型只能作为独立 challenger，并使用查询时真实可得的气候常态、预报或滞后特征。

GBDT challenger 只针对正例充足鸟种离线训练；必须在至少两个时间折、空间留出和观察者留出上同时满足 Brier 改善至少 3%、ECE 不恶化超过 0.01、Top-K 不退化，才可进入候选替换名单。Node 线上栈不会加载 Python/joblib。
