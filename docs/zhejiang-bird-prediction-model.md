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

历史 cache v1 已于 2026-07-17 随完整 development 五折生成：

- 缓存：`data/prediction-models/development-cache/zhejiang-v1-20260715-spatial-oof.sqlite`
- SHA-256：`6009b8664635154778557f0996f1cd2cba262d0e1f23a253db497f21b7b6665a`
- 文件大小：16,814,080 bytes
- `quick_check=ok`、`freelist_count=0`；schema 只含 `metadata`、`folds`、`contexts`、`taxa`、`scores`

cache v1 只适用于下述 2026-07-17 历史诊断；严格 v2 评分器会拒绝其缺少 outer×inner 证据的 schema。缓存生成参数仍是在完整 development 命令中增加：

```powershell
  --write-spatial-oof-cache data\prediction-models\development-cache\zhejiang-v1-20260715-spatial-oof.sqlite
```

缓存生成后，独立评分命令为：

```powershell
node tools\score-zhejiang-spatial-oof-cache.js `
  --cache data\prediction-models\development-cache\zhejiang-v1-20260715-spatial-oof.sqlite `
  --snapshot data\prediction-snapshots\zhejiang-v1-20260715.sqlite `
  --spatial-split-manifest docs\zhejiang-v1-20260715-spatial-splits.json `
  --output data\prediction-models\development-cache\zhejiang-v1-20260715-spatial-candidates-next.json `
  --workers 4
```

评分器固定使用已经定义的 25 组上限和 4,096 行分块。逐鸟 cap 先保留 pooled Brier 距最佳不超过 0.1% 的候选，再按训练折最坏相对 Brier regret、平均 regret、pooled Brier 和候选 ID 确定性选择。校准器候选固定为 15 组：恒等映射；ridge 0.1 的截距/温度校准及 0.25、0.5、0.75、1.0 shrinkage；完整 ridge 0.001/0.1 beta；ridge 1 beta 及 0.25、0.5、0.75、1.0 shrinkage。评分 API 拒绝未预登记的 ridge、shrinkage 或候选顺序，完整候选 manifest 及保护门共同绑定 SHA-256。

每个 outer held-out 折只用其余四折的标签执行内层 3 折拟合、1 折选择，再用四折重拟合所选 scope family 并验证 outer 折。报告逐折保存 inner/outer 折来源、cap 策略、family/ridge/shrinkage、保护门、拟合参数以及 selection/validation SHA。篡改 outer held-out 标签只会改变 validation SHA，不会改变该折 selection SHA；`workers=1/2/4` 的自动测试结果完全一致。逐作用域和整体保护门仍要求 Brier 相对恶化不超过 1%、ECE 恶化不超过 0.01；最终完整 Brier/ECE/Recall 门槛不变。

现有 cache v1 没有为每个 outer×inner 三折组合重新生成行政层空间证据，内层缓存证据可能包含 outer 折训练统计；inner scope 资格也使用缓存折的训练正例数，而不是三折 distinct observer-group 重新计数。因此这里的嵌套选择只保证“缓存标签层面”的 outer 隔离，仍是 development diagnostic，不是端到端无偏 release 指标。严格正式化必须重建 outer×inner 证据，并在扩展 runtime/参数 schema 后重新运行完整 development。十箱汇总只由逐行新概率重新生成，但仍不得被当作正式发布结果。

#### 2026-07-17 固定批次离线结果

- 固定候选 manifest SHA-256：`452653b08530fa30568f530e2bb55cdaf5fc188cca9ebf98563239dc1cf046ec`
- 4-worker 报告：`data/prediction-models/development-cache/zhejiang-v1-20260715-spatial-candidates-nested-fixed-v1-w4.json`，SHA-256 `40c2e451cbaecb1a09622df8903af298c34a115f2351776f2d1de512b3afec4d`
- 1-worker 复跑：`data/prediction-models/development-cache/zhejiang-v1-20260715-spatial-candidates-nested-fixed-v1-w1.json`，SHA-256 `4da7bddf7151c9d141b68711d1487140dd09bfb3aa986a5d7f588079f3d24668`
- 删除仅允许变化的 `generatedAt`、`scoring.workers` 后，两份完整 JSON 完全一致；投影 SHA-256 均为 `9f2eea6105adcdd346b58128cc7e6cee6f045b21edae0800c3959907fd89af27`
- Brier Skill `+3.0535863609%`、ECE `0.0048678038973248875`、Recall@20 delta `+2.4361948956pp`
- 共享校准组最大 ECE `0.00017673993094259626`
- 逐鸟最大 ECE `0.11765780718704699`，最差为 `taxon_id=5013` 暗绿绣眼鸟；白头鹎 `taxon_id=4866` 为 `0.10302528100804287`
- 报告截取的最差 30 种中有 25 种超过 `maximumSpeciesEce=0.05`
- 唯一失败仍为 `spatial.species_calibration.maximumEce`

固定批次结论为 **no-go**。失败来自明显的逐折异质性，不是 worker 调度或确定性归并噪声；按预登记约束不追加候选、不降低门槛、不冻结参数、不打开 sealed，也不启动下一次完整 development 回测。

#### 2026-07-21 严格 cache v2 与候选批次预登记

下一次且仅下一次长 development 缓存生成改用 schema v2。五个 outer 折各保存四个 inner held-out 折：outer 证据训练集排除该 outer 的 H3 r6 锚点及一环缓冲和全部 sealed 缓冲；每个 inner 证据训练集再额外排除该 inner 的锚点及一环缓冲。inner `positive_count` 必须在对应三折训练集上按已知观察者的 distinct `group_key` 精确重算，同时保存 outer-training 与 development-pool 计数用于固定各阶段 scope 资格。缓存总计必须为 5 个 outer、20 个 inner；任一折号、训练折补集、计数关系或绑定哈希不匹配即 fail closed。

v2 继续只保存公共鸟种 ID、匿名 outer/inner 折号、折内稠密上下文序号、标签/权重、基线/原始概率和未封顶省市区县充分统计；禁止保存报告 ID、观察者、原始坐标、地点、H3、点位或精确行政单元标识。外层标签不进入该外层的 cap/family/scope 决策；自动测试必须同时证明修改 outer held-out 标签不改变 selection SHA，而修改对应严格 inner 标签会改变选择证据。

本批次在查看 v2 离线结果前固定如下，不得运行后再追加候选：

- 行政层上限仍仅为已经定义的 25 组 `city×district` 组合。逐鸟 pooled Brier 距最佳不超过 0.1% 的候选进入稳定集，按最坏内折 regret、平均 regret、pooled Brier、候选 ID 排序；若所选 cap 的最坏内折相对 Brier regret 超过 5%，回退到当前按流行度组的基础 cap。
- 校准器固定为 13 组：恒等映射；ridge 0.1 的截距校准与温度缩放各使用 `0.25/0.5/0.75/1.0` shrinkage；ridge 1 的 beta calibration 使用 `0.25/0.5/0.75/1.0` shrinkage。删除 v1 中容易过拟合的完整 ridge 0.001/0.1 beta，不允许自由输入 ridge、shrinkage 或候选顺序。
- 每个 outer 内按三折拟合、一折验证覆盖全部四个 inner 折。作用域候选必须在 pooled 及每个可评估 inner 折同时满足 Brier 相对恶化不超过 1%、ECE 恶化不超过 0.01，且候选最坏 inner-fold ECE 不得高于原始最坏 inner-fold ECE；合格项依次按最坏折 ECE、pooled ECE、最坏折 Brier 恶化、较小 shrinkage、family ID 排序。无合格项回退恒等映射；混合后的整体结果也必须在 pooled 与每个 inner 折重新通过同一保护门。
- outer 验证仍汇总全部五个 development 折并执行完整 Brier Skill、ECE、逐鸟/共享组 ECE、Recall@20 门槛；十箱 ECE 只由逐行概率重算，不替代正式完整 development 回测。`maximumSpeciesEce=0.05` 及其他门槛均不变。

预登记的首次 v2 长运行输出为 `data/prediction-models/zhejiang-v1-20260715-development-strict-cache-v2.sqlite`，紧凑缓存为 `data/prediction-models/development-cache/zhejiang-v1-20260715-spatial-oof-v2.sqlite`；随后固定离线报告输出为 `data/prediction-models/development-cache/zhejiang-v1-20260715-spatial-candidates-strict-v2-w4.json`。先完成 schema/隐私/确定性和反泄漏短测，再启动一次长缓存生成；生成后先离线评分。若仍有任一门槛失败，立即 no-go，不扩展 runtime/schema、不冻结参数、不打开 sealed；只有全部通过才进入 runtime/schema 正式化和完整 development 复验。

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
