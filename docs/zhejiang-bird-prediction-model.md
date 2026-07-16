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

## 2026-07-16 诊断回测

修正空间/观察者外层折的嵌套校准后，校准点统一来自外层训练内部的分层时空 OOF 分数；不再用“省级×周”分数拟合后错误应用到区县、网格或点位分数。每个校准作用域另用最后一个内层年份做保护门验证，Brier 相对恶化超过 1% 或 ECE 恶化超过 0.01 时退回恒等映射。

- 诊断模型：`data/prediction-models/zhejiang-v1-20260715-calibration-diagnostic.sqlite`
- 模型 SHA-256：`d9e6f4070ea85c48cad1a402ee13774d09d943c805cb4096ed8ded88be809471`
- 报告 SHA-256：`b4d93310f90bd781bdc7ffabcbf448f9d22a7a3d2f93d9479baef136bca7dbf9`
- 构建耗时：7,939.271 秒
- `quick_check=ok`、freelist 为 0；公开制品不含训练报告、观察者哈希、训练检出或精确事件网格表
- 观察者 ID 覆盖率修正为 100%，不再因去重前计数而超过 100%

| 留出 | Brier Skill | ECE | Recall@20 相对基线 | 最大逐鸟 ECE | 结论 |
|---|---:|---:|---:|---:|---|
| 时间总体 | +10.78% | 0.0021 | +5.41pp | 0.0461 | 通过 |
| 2026 最终时间留出 | +12.78% | 0.0021 | +6.32pp | 0.0461 | 通过 |
| 空间 raw | -1.13% | 0.0092 | +1.00pp | 0.2031 | 未通过 |
| 空间 guard 校准后 | -0.17% | 0.0085 | +0.86pp | 0.2112 | 未通过 |
| 观察者 raw | +16.87% | 0.0018 | +8.84pp | 0.0253 | 通过 |
| 观察者 guard 校准后 | +16.08% | 0.0008 | +8.67pp | 0.0304 | 通过 |

诊断制品仍为 no-go，仅剩 `spatial.brierSkill` 与 `spatial.species_calibration.maximumEce` 两个失败项。旧三块空间折全部回退到区县，说明剩余问题集中在未知网格的行政区统计迁移与空间专用逐鸟校准，不需要继续引入观察者权重复杂度。

旧三块已经查看结果，只能继续作为开发诊断，不能再声称是独立发布测试。新的目标无关空间清单已在查看新结果前冻结：

- 清单：`docs/zhejiang-v1-20260715-spatial-splits.json`
- 文件 SHA-256：`7deafec542c95b1463c92fe6948831247666a22923921b22890bb24adac9accc`
- manifest 哈希：`400bcc27bde3bd30f03ef022b9f76175cd6093ea5afc98fcbfccb79bde234e4d`
- development：12 个锚点，覆盖 11 市，包含已查看的海盐、南湖、吴兴三块
- sealed release：11 个新锚点，覆盖 11 市，固定 5 折
- development 与 sealed release 的所有 H3 r6 一环缓冲全局无重叠

下一步只在 development 面板选择 novel-grid 的市/区县可转移有效暴露上限和空间专用校准；参数与代码提交冻结后，才允许首次打开 sealed release 五折。sealed 结果一旦查看，不得换点或继续把它用于调参。

开发调参的计算约束固定如下：

- 每个空间折先从 SQLite 聚合一次清单暴露、鸟种命中和支持度；市级 × 区县级的 25 组暴露上限候选复用同一份聚合，在内存中同时评分，禁止为每个参数组合重复执行聚合 SQL。
- 性能优化只改变计算路径，不减少时间、空间或观察者验证折，不抽掉鸟种，不放宽 Brier、ECE、Recall@20 或 NDCG@10 门槛。
- development 阶段始终把 sealed release 的 11 个锚点及其一环缓冲从训练、校准和验证中排除；sealed 面板必须用冻结清单的 manifest 哈希显式解封，首次查看后不得再据其结果调参。
- development 调参制品可使用 `evaluation-only`，跳过正向预测表和反向热点索引的物化；它强制标记为 `testOnly`、不能发布，也不能被线上模型当作完整制品加载。
- 参数冻结且 sealed release 五折通过后，最终正式构建必须使用 `full` 物化配置，覆盖每个受支持空间单元的 52 个周桶，并为全部公共鸟种生成反向热点；缺任何正向周桶或反向鸟种都会以 `ONLINE_INDEX_INCOMPLETE` 阻止制品生成。

单线程 development-cap-tuning 基准已于 2026-07-16 完成：

- 制品：`data/prediction-models/zhejiang-v1-20260715-development-cap-tuning.sqlite`
- 模型 SHA-256：`6cd19d2d4fcd14c6b48122eed8937e84ccd4713f60a8aa3b24582ee6b7d5c96a`
- 报告 SHA-256：`efa29bcf69565f1588b2d52a649990ee76cf2fbf9642e2f660d2deae543eba1b`
- 耗时：8,964.7 秒；`quick_check=ok`、freelist 为 0、无私有训练表；`evaluation-only` 因而正向/反向索引均为 0 行且不可发布
- 冻结 development 五折空间 Brier Skill `+2.6312%`、ECE `0.00582`、Recall@20 相对基线 `+2.8467pp`
- 唯一剩余失败项：`spatial.species_calibration.maximumEce`；最差逐鸟 ECE `0.12117`，鸟种 ID `4356`
- development OOF Brier 选择的行政层有效暴露上限：`species_200_plus={city:100,district:10}`、`group_80_199={city:100,district:10}`、`group_30_79={city:100,district:300}`
- `sealedPanelViewed=false`，密封面板仍未查看

候选评分支持 `--workers N`。主线程仍对每折只执行一次 SQLite 聚合；紧凑数值证据固定按 4,096 条记录切块后交给 Worker Threads，最多每个 worker 一个在途缓冲，结果严格按固定 jobId 顺序归并。worker 数量只改变调度，不改变任务分块、鸟种、验证折或求和顺序；自动测试要求 `workers=1/2/4` 的结果完全一致。

实际数据 `workers=4` 复跑也已完成：

- 制品：`data/prediction-models/zhejiang-v1-20260715-development-cap-tuning-w4.sqlite`
- 模型 SHA-256：`94abca097a279d51d3e73844652817484f4ea1119ecaf16a0cdb16bea6709817`
- 报告 SHA-256：`e7474209976bafa3743f2fe619bcf7582cbf570f5cf306364cbc6435cadb2348`
- 构建耗时：8,829.6 秒，比单线程构建记录少 131.7 秒（约 1.47%）；峰值内存约 3.21 GB，并在折间释放
- 时间、空间 raw/最终、观察者指标以及五个空间折的 raw/最终指标逐字段完全一致
- 75 个候选全部保留；候选聚合 Brier 最大绝对差 `1.54e-15`，聚合 loss 最大绝对差 `2.15e-10`，都来自浮点归并容差且不改变所选矩阵
- 五折均记录 `workerCount=4`、`chunkRecords=4096`，任务记录数分别为 `79035/110200/50295/45026/62880`
- `quick_check=ok`、freelist 为 0、无私有训练表，模型与报告 SHA sidecar 均匹配；因此多核实现通过真实数据一致性门槛

空间专用校准继续复用每折首次聚合产生的紧凑评分行，不再为时间校准诊断或空间校准重复执行聚合 SQL。五个 development 折逐一作为 held-out：当前折的校准器只能由另外四折拟合；正例至少 200 的鸟种逐鸟拟合，30–199 按既有流行度组共享。各作用域只有在五折交叉拟合结果的 Brier 相对恶化不超过 1% 且 ECE 恶化不超过 0.01 时才接受，否则回退恒等映射。最终生产校准参数只在接受作用域上用全部 development OOF 行重拟合；sealed 面板仍不得参与拟合、筛选或保护门判断。

### Development OOF 充分统计缓存

逐鸟行政层迁移上限和稳健校准器的开发调试使用独立的 development-only OOF 缓存。缓存只在完整五折 development 聚合成功后一次性原子写入；它保存匿名折号、折内上下文序号、公共鸟种 ID、各外折及排除全部 sealed buffer 后的 development-pool 公共正例数、标签/权重、基线概率，以及重建 25 组市级 × 区县级上限所需的省/市/区县未封顶数值证据。它不保存报告 ID、观察者、经纬度、地点名称、H3/点位/行政单元 ID，也不保存 sealed 结果；名单判定也不读取 sealed 标签。

缓存同时绑定快照 SHA、split 文件 SHA、split manifest hash、五折及上游证据生成契约。证据生成器哈希与下游评分器哈希分开；仅修改独立候选评分器或诊断报告代码不要求重新执行 SQLite 聚合。当前为保守绑定，证据生成器哈希仍覆盖整个模型构建器及相关证据模块，因此构建器中即使是不影响充分统计的改动也可能使缓存失效；后续只有把 OOF 生成核心抽成独立模块后才能进一步缩小失效范围。缓存和评分报告都属于 development diagnostic，不能直接供参数冻结、sealed 解封或正式发布使用。

当前已完成的 development 制品在报告生成前删除了内存 OOF 行，并在删除训练私表后执行了 `VACUUM`，因此不能从现有 `.report.json` 或 evaluation-only SQLite 安全回填缓存。首次生成仍需在缓存实现通过短测试后执行一次完整 development；之后可反复离线评分，不再为每组候选重跑聚合。

下一次完整 development 生成缓存时，在原命令中增加：

```powershell
  --write-spatial-oof-cache data\prediction-models\development-cache\zhejiang-v1-20260715-spatial-oof.sqlite
```

缓存生成后，独立评分命令为：

```powershell
node tools\score-zhejiang-spatial-oof-cache.js `
  --cache data\prediction-models\development-cache\zhejiang-v1-20260715-spatial-oof.sqlite `
  --snapshot data\prediction-snapshots\zhejiang-v1-20260715.sqlite `
  --spatial-split-manifest docs\zhejiang-v1-20260715-spatial-splits.json `
  --output data\prediction-models\development-cache\zhejiang-v1-20260715-spatial-candidates.json `
  --workers 4
```

评分器固定使用已经定义的 25 组上限和 4,096 行分块。正例至少 200 的鸟种在每个 held-out 折上只用其余四折选择逐鸟上限，再对该折完整重算 Brier、十箱 ECE、逐鸟/共享组最大 ECE 和 Recall@20；生产候选仅用全部五个 development 折重选。截距校准、温度缩放及不同 ridge 的 beta 校准器也分别执行四折拟合、一折验证，并同时执行逐作用域及整体 Brier 相对恶化不超过 1%、ECE 恶化不超过 0.01 的保护门。十箱汇总只由逐行新概率重新生成，不能把旧报告中的箱级近似变换当正式评分。

逐作用域保护门和校准器族推荐仍使用同一批 development OOF 标签做开发选择，所以离线报告中的质量门结果不是无偏发布指标；选定方案、扩展 runtime/参数 schema 并冻结代码后，必须重新运行完整 development 才能形成正式 go/no-go 依据。逐鸟上限的生产诊断名单使用缓存绑定的 development-pool 正例数，因此覆盖该开发池内全部 `positive_count >= 200` 公共鸟种，同时不接触 sealed 保留单元；若某个边界鸟种在五个外折中从未达到 200，它仍可获得全五折逐鸟上限诊断，但由于没有逐鸟作用域的 4/1 校准保护门，不生成该鸟的生产逐鸟校准器。

当前 runtime 和空间参数制品仍只支持按流行度组查询行政层上限，因此逐鸟候选即使改善 development，也只能先作为诊断。只有在另行扩展运行时和参数 schema、重新完成全部 development 折并通过所有门槛后，才可能进入冻结流程。

## 构建与测试

复用已固定快照构建，不连接网站、不切换线上模型指针：

```powershell
node --max-old-space-size=8192 tools\build-zhejiang-prediction-model.js `
  --source data\prediction-snapshots\zhejiang-v1-20260715.sqlite `
  --source-is-snapshot `
  --snapshot data\prediction-snapshots\zhejiang-v1-20260715.sqlite `
  --output data\prediction-models\zhejiang-v1-20260715.sqlite `
  --model-version zhejiang-v1-20260715 `
  --spatial-split-manifest docs\zhejiang-v1-20260715-spatial-splits.json `
  --spatial-panel development `
  --workers 4 `
  --evaluation-only `
  --no-publish `
  --confirm-coordinate-system bd09
```

development 五折全部通过后才允许冻结参数；冻结工具会校验快照 SHA、split manifest hash、五折数、`sealedPanelViewed=false`、行政层上限矩阵和所有 `spatial.*` 门槛：

```powershell
node tools\freeze-zhejiang-spatial-parameters.js `
  --report data\prediction-models\zhejiang-v1-20260715-development-spatial-calibration-w4.sqlite.report.json `
  --spatial-split-manifest docs\zhejiang-v1-20260715-spatial-splits.json `
  --output data\prediction-models\zhejiang-v1-20260715-spatial-parameters.json
```

sealed release 只能执行一次。它必须显式确认冻结 manifest hash，并加载上一步的参数；缺参数、快照不匹配、development 报告未过空间门槛都会 fail closed：

```powershell
node --max-old-space-size=8192 tools\build-zhejiang-prediction-model.js `
  --source data\prediction-snapshots\zhejiang-v1-20260715.sqlite `
  --source-is-snapshot `
  --snapshot data\prediction-snapshots\zhejiang-v1-20260715.sqlite `
  --output data\prediction-models\zhejiang-v1-20260715-sealed-release.sqlite `
  --model-version zhejiang-v1-20260715-sealed-release `
  --spatial-split-manifest docs\zhejiang-v1-20260715-spatial-splits.json `
  --spatial-panel sealed-release `
  --spatial-parameters data\prediction-models\zhejiang-v1-20260715-spatial-parameters.json `
  --confirm-open-sealed-spatial-panel 400bcc27bde3bd30f03ef022b9f76175cd6093ea5afc98fcbfccb79bde234e4d `
  --workers 4 `
  --evaluation-only `
  --no-publish `
  --confirm-coordinate-system bd09
```

只有 sealed 构建的全部发布门槛均通过时，才把结果冻结成不可调参的评估收据。收据绑定快照、空间参数文件、split、sealed 报告及全部可执行建模文件的实现 SHA-256：

```powershell
node tools\freeze-zhejiang-sealed-evaluation.js `
  --report data\prediction-models\zhejiang-v1-20260715-sealed-release.sqlite.report.json `
  --spatial-parameters data\prediction-models\zhejiang-v1-20260715-spatial-parameters.json `
  --spatial-split-manifest docs\zhejiang-v1-20260715-spatial-splits.json `
  --output data\prediction-models\zhejiang-v1-20260715-sealed-evaluation-receipt.json
```

最终正式构建不再打开 sealed 面板，而是以 development 模式仅校验同一 split manifest，再复用密封收据中的空间评估；时间折和观察者折仍完整重跑。带收据的构建强制为非 testOnly 的 `full` 物化，且实现代码哈希必须与 sealed 构建完全一致：

```powershell
node --max-old-space-size=8192 tools\build-zhejiang-prediction-model.js `
  --source data\prediction-snapshots\zhejiang-v1-20260715.sqlite `
  --source-is-snapshot `
  --snapshot data\prediction-snapshots\zhejiang-v1-20260715.sqlite `
  --output data\prediction-models\zhejiang-v1-20260715.sqlite `
  --model-version zhejiang-v1-20260715 `
  --spatial-split-manifest docs\zhejiang-v1-20260715-spatial-splits.json `
  --spatial-panel development `
  --spatial-parameters data\prediction-models\zhejiang-v1-20260715-spatial-parameters.json `
  --sealed-evaluation-receipt data\prediction-models\zhejiang-v1-20260715-sealed-evaluation-receipt.json `
  --workers 4 `
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

上面的命令是 development 调参命令，因此会跳过线上索引物化。正式发布构建不得带 `--evaluation-only`，并继续使用生产默认 `forwardTopK=100`、`reverseTopK=300`；构建器会额外验证所有受支持空间单元均有完整 52 周正向桶、全部公共鸟种均进入反向热点索引。

## 天气与 challenger

浙江历史天气可以从 CMA、ERA5-Land 或 NASA POWER 等来源补充，但首版 champion 不纳入天气。原因是查询未来十二个月季节窗口时无法获得未来实况天气，直接用历史实况训练会造成训练—服务偏移。后续天气模型只能作为独立 challenger，并使用查询时真实可得的气候常态、预报或滞后特征。

GBDT challenger 只针对正例充足鸟种离线训练；必须在至少两个时间折、空间留出和观察者留出上同时满足 Brier 改善至少 3%、ECE 不恶化超过 0.01、Top-K 不退化，才可进入候选替换名单。Node 线上栈不会加载 Python/joblib。
