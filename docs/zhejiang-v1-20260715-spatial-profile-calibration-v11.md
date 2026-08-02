# v11 多尺度原型条件校准诊断

状态：唯一 development 诊断已完成；结论为 No-Go；停止原型条件校准路径。未查看 sealed，未发布，未覆盖默认模型，也未执行运行时集成。

## v10 终态

v10 产物、报告和诊断缓存完整，SHA sidecar 均匹配，SQLite `quick_check=ok`、`freelist_count=0`、外键无错误。默认模型 SHA-256 仍为 `c4d8f759cdb9275b9d9171877d80b339e8796342dd262b380cf99360108ac582`。

正式结论仍是 Development No-Go，唯一失败项为 `spatial.species_calibration.maximumEce`：

- 最大逐鸟种 ECE：`0.10829956319678036`
- 固定门槛：`0.05`
- 超过门槛的鸟种：32
- spatial Brier Skill：`0.05642857380918209`
- spatial overall ECE：`0.004081352313500836`
- spatial Recall@20 delta：`0.05550597893985365`

因此失败不是 pooled calibration、Brier 或排序问题。

## 诊断证据

v10 的 727 个 outer 匿名上下文只落入 6 个公开多尺度原型。`profile_14` 覆盖 296 个上下文，评估权重 `533.6696521988952`，约占总权重 47.85%。在多个最差鸟种上，它贡献主要残差；同一鸟种在不同原型之间还会出现相反偏差。

这支持测试“空间原型条件校准”，但不授权直接集成。

## 冻结假设

契约 `zhejiang_multiscale_profile_beta_calibration_v1` 只改变校准 scope：

- control：当前鸟种或 prevalence group Beta calibration；
- candidate：正例数至少 200 的鸟种使用 `taxon × public profile` Beta calibration；
- 其余鸟种继续使用原 prevalence group；
- 5 个 development outer folds 做 leave-one-fold-out 交叉拟合；
- 每个 candidate scope 仍使用原有 Brier/ECE 非退化保护；
- 不使用 `season_week`，不改邻居策略、特征原型、质量门槛或默认模型。

候选只有同时满足以下条件才可进入下一阶段：

1. control 精确复现 v10 正式 spatial 指标；
2. 每个 outer fold 和 pooled 指标均通过非退化保护；
3. 最大逐鸟种 ECE 严格优于 control；
4. 所有冻结 spatial 质量门槛全部通过。

即使候选通过，也只能准备单独冻结的运行时集成和完整 development 重验证，不能运行 sealed。

## v11 诊断结果

唯一候选评分已按冻结命令完成，诊断报告 SHA-256 为 `d222fafb6749da4b22fc1aa31ceee2e827444ea6cba7a83742b842ff5e926c92`，sidecar 匹配。

- control 最大逐鸟种 ECE：`0.10829956319678026`
- candidate 最大逐鸟种 ECE：`0.11273245808796035`
- 最大逐鸟种 ECE 变化：`+0.004432894891180095`，未实现严格改善
- candidate spatial Brier Skill：`0.06562711011244793`
- candidate overall ECE：`0.0044587066369613385`
- candidate Recall@20 delta：`0.05541674103159022`
- pooled Brier 相对变化：`-0.009748638044647852`，整体有所改善
- outer fold 1 Brier 相对恶化：`0.012839649593558223`，超过冻结上限 `0.01`
- scope 保护：957 个接受、1,252 个拒绝

候选同时违反“每折保护”“最差逐鸟种 ECE 必须严格改善”和“最大逐鸟种 ECE ≤ 0.05”三项要求，因此 `runtimeIntegrationEligible=false`。按预登记停止该校准路径，下一步只能重新评估特征分辨率；不得放宽门槛、继续调参、物化 reference 或查看 sealed。

默认模型 SHA-256 复核仍为 `c4d8f759cdb9275b9d9171877d80b339e8796342dd262b380cf99360108ac582`。

## 相关文件

- 预登记：`docs/zhejiang-v1-20260715-spatial-profile-calibration-v11-preregistration.json`
- 候选实现：`server/prediction/spatial-profile-calibration-candidate.js`
- 评分入口：`tools/score-zhejiang-spatial-profile-calibration.js`
- 预检入口：`tools/preflight-zhejiang-spatial-profile-calibration.js`
- 测试：`tools/test-zhejiang-spatial-profile-calibration.js`
- 预检输出：`data/prediction-models/development-cache/zhejiang-v1-20260715-spatial-profile-calibration-v11-preflight.json`
- 候选输出：`data/prediction-models/development-cache/zhejiang-v1-20260715-spatial-profile-calibration-v11.json`

唯一候选评分命令已经运行一次。预登记要求 `singleDiagnosticRunOnly=true`，不得覆盖或重复运行该输出。
